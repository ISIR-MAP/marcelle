import * as tf from '@tensorflow/tfjs';
import {
  Stream,
  logger,
  ClassifierResults,
  TFJSBaseModelOptions,
  TFJSBaseModel,
  Instance,
} from '../../core';
import type { ServiceIterable } from '../../core/data-store/service-iterable';
import { Dataset, isDataset } from '../../core/dataset';
import { Catch, TrainingError } from '../../utils/error-handling';

interface TrainingData {
  training_x: tf.Tensor2D;
  training_y: tf.Tensor2D;
  validation_x: tf.Tensor2D;
  validation_y: tf.Tensor2D;
}

function shuffleArray<T>(a: T[]): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * i);
    const temp = b[i];
    b[i] = b[j];
    b[j] = temp;
  }
  return b;
}

export async function dataSplit(
  dataset: ServiceIterable<Instance<tf.TensorLike, string>>,
  trainProportion: number,
  labels: string[],
): Promise<TrainingData> {
  const classes: Record<string, tf.TensorLike[]> = labels.reduce((c, l) => ({ ...c, [l]: [] }), {});
  for await (const { x, y } of dataset) {
    classes[y].push(x);
  }

  let data: TrainingData;
  tf.tidy(() => {
    data = {
      training_x: tf.tensor2d([], [0, 1]),
      training_y: tf.tensor2d([], [0, labels.length]),
      validation_x: tf.tensor2d([], [0, 1]),
      validation_y: tf.tensor2d([], [0, labels.length]),
    };
    for (const label of labels) {
      const instances = classes[label];
      const numInstances = instances.length;
      const shuffledInstances = shuffleArray(instances);
      const thresh = Math.floor(trainProportion * numInstances);
      const trainingInstances = shuffledInstances.slice(0, thresh);
      const validationInstances = shuffledInstances.slice(thresh, numInstances);
      const y = Array(labels.length).fill(0);
      y[labels.indexOf(label)] = 1;
      for (const features of trainingInstances) {
        if (data.training_x.shape[1] === 0) {
          data.training_x.shape[1] = (features as number[][])[0].length;
        }
        data.training_x = data.training_x.concat(tf.tensor2d(features as number[][]));
        data.training_y = data.training_y.concat(tf.tensor2d([y]));
      }
      for (const features of validationInstances) {
        if (data.validation_x.shape[1] === 0) {
          data.validation_x.shape[1] = (features as number[][])[0].length;
        }
        data.validation_x = data.validation_x.concat(tf.tensor2d(features as number[][]));
        data.validation_y = data.validation_y.concat(tf.tensor2d([y]));
      }
    }
    tf.keep(data.training_x);
    tf.keep(data.training_y);
    tf.keep(data.validation_x);
    tf.keep(data.validation_y);
  });
  return data;
}

export interface MLPClassifierOptions extends TFJSBaseModelOptions {
  layers: number[];
  epochs: number;
  batchSize: number;
  trainingSplit: number;
}

export class MLPClassifier extends TFJSBaseModel<tf.TensorLike, ClassifierResults> {
  title = 'MLPClassifier';

  model: tf.Sequential;
  loadFn = tf.loadLayersModel;

  parameters: {
    layers: Stream<number[]>;
    epochs: Stream<number>;
    batchSize: Stream<number>;
    trainingSplit: Stream<number>;
  };

  private data: {
    inputDim: number;
    numClasses: number;
  };

  constructor({
    layers = [64, 32],
    epochs = 20,
    batchSize = 8,
    trainingSplit = 0.75,
    ...rest
  }: Partial<MLPClassifierOptions> = {}) {
    super(rest);
    this.parameters = {
      layers: new Stream(layers, true),
      epochs: new Stream(epochs, true),
      batchSize: new Stream(batchSize, true),
      trainingSplit: new Stream(trainingSplit),
    };
  }

  @Catch
  async train(
    dataset: Dataset<tf.TensorLike, string> | ServiceIterable<Instance<tf.TensorLike, string>>,
  ): Promise<void> {
    const ds = isDataset(dataset) ? dataset.items() : dataset;
    const labels = Array.from(new Set(await ds.map(({ y }) => y).toArray()));
    setTimeout(async () => {
      const data = await dataSplit(ds, this.parameters.trainingSplit.value, labels);
      await this.trainData(data, labels);
    }, 100);
  }

  @Catch
  async trainData(data: TrainingData, labels: string[]): Promise<void> {
    this.labels = labels;
    this.$training.set({ status: 'start', epochs: this.parameters.epochs.value });
    const inputDim = data.training_x.shape[1];
    const numClasses = data.training_y.shape[1];
    if (!this.model || this.data?.inputDim !== inputDim || this.data?.numClasses !== numClasses) {
      this.buildModel(inputDim, numClasses);
    } else {
      this.clear();
    }
    this.fit(data);
  }

  async predict(x: tf.TensorLike): Promise<ClassifierResults> {
    if (!this.model) return { label: undefined, confidences: {} };
    return tf.tidy(() => {
      const pred = this.model.predict(tf.tensor(x)) as tf.Tensor2D;
      const label = this.labels[pred.gather(0).argMax().arraySync() as number];
      const softmaxes = pred.arraySync()[0];
      const confidences = softmaxes.reduce((c, y, i) => ({ ...c, [this.labels[i]]: y }), {});
      return { label, confidences };
    });
  }

  clear(): void {
    // delete this.model;
    if (this.model) {
      // set random weights
      const weights = this.model.getWeights();
      this.model.setWeights(weights.map((w) => tf.randomUniform(w.shape)));
    }
  }

  buildModel(inputDim: number, numClasses: number): void {
    logger.debug('[MLP] Building a model with layers:', this.parameters.layers);
    this.model = tf.sequential();
    for (const [i, units] of this.parameters.layers.value.entries()) {
      const layerParams: Parameters<typeof tf.layers.dense>[0] = {
        units,
        activation: 'relu', // potentially add kernel init
      };
      if (i === 0) {
        layerParams.inputDim = inputDim;
      }
      this.model.add(tf.layers.dense(layerParams));
    }

    this.model.add(
      tf.layers.dense({
        units: numClasses,
        activation: 'softmax',
      }),
    );
    const optimizer = tf.train.adam();
    this.model.compile({
      optimizer,
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'],
    });
    this.model.setFastWeightInitDuringBuild(true);
    this.data = {
      inputDim,
      numClasses,
    };
  }

  fit(data: TrainingData, epochs = -1): void {
    const numEpochs = epochs > 0 ? epochs : this.parameters.epochs.value;
    this.model
      .fit(data.training_x, data.training_y, {
        batchSize: this.parameters.batchSize.value,
        validationData: [data.validation_x, data.validation_y],
        epochs: numEpochs,
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            this.$training.set({
              status: 'epoch',
              epoch,
              epochs: this.parameters.epochs.value,
              data: {
                accuracy: logs.acc,
                loss: logs.loss,
                accuracyVal: logs.val_acc,
                lossVal: logs.val_loss,
              },
            });
          },
        },
      })
      .then((results) => {
        logger.debug('[MLP] Training has ended with results:', results);
        this.$training.set({
          status: 'success',
          data: {
            accuracy: results.history.acc,
            loss: results.history.loss,
            accuracyVal: results.history.val_acc,
            lossVal: results.history.val_loss,
          },
        });
      })
      .catch((error) => {
        this.$training.set({ status: 'error', data: error });
        throw new TrainingError(error.message);
      })
      .finally(() => {
        data.training_x.dispose();
        data.training_y.dispose();
        data.validation_x.dispose();
        data.validation_y.dispose();
      });
  }
}
