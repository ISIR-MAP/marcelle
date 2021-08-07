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
  x: tf.Tensor2D;
  y: tf.Tensor2D;
}

export async function getTensorFlowTrainingData(
  dataset: ServiceIterable<Instance<tf.TensorLike, string>>,
  labels: string[],
): Promise<TrainingData> {
  const xPromise = dataset
    .map((it) => it.x)
    .reduce((acc, x) => acc.concat(tf.tensor2d(x as number[][])), tf.tensor2d([], [0, 1]));
  const yPromise = dataset
    .map((it) => {
      const yProb = new Array(labels.length).fill(0);
      yProb[labels.indexOf(it.y)] = 1;
      return yProb;
    })
    .reduce((acc, y) => acc.concat(tf.tensor2d([y])), tf.tensor2d([], [0, labels.length]));
  const [x, y] = await Promise.all([xPromise, yPromise]);
  return { x, y };
}
export interface MLPClassifierOptions extends TFJSBaseModelOptions {
  layers: number[];
  epochs: number;
  batchSize: number;
  validationSplit: number;
}

export class MLPClassifier extends TFJSBaseModel<tf.TensorLike, ClassifierResults> {
  title = 'MLPClassifier';

  model: tf.Sequential;
  loadFn = tf.loadLayersModel;

  parameters: {
    layers: Stream<number[]>;
    epochs: Stream<number>;
    batchSize: Stream<number>;
    validationSplit: Stream<number>;
  };

  constructor({
    layers = [64, 32],
    epochs = 20,
    batchSize = 8,
    validationSplit = 0.25,
    ...rest
  }: Partial<MLPClassifierOptions> = {}) {
    super(rest);
    this.parameters = {
      layers: new Stream(layers, true),
      epochs: new Stream(epochs, true),
      batchSize: new Stream(batchSize, true),
      validationSplit: new Stream(validationSplit),
    };
  }

  @Catch
  async train(
    dataset: Dataset<tf.TensorLike, string> | ServiceIterable<Instance<tf.TensorLike, string>>,
  ): Promise<void> {
    const ds = isDataset(dataset) ? dataset.items() : dataset;
    const labels = Array.from(new Set(await ds.map(({ y }) => y).toArray()));
    setTimeout(async () => {
      const data = await getTensorFlowTrainingData(ds, labels);
      await this.trainData(data, labels);
    }, 100);
  }

  @Catch
  async trainData(data: TrainingData, labels: string[]): Promise<void> {
    this.labels = labels;
    this.$training.set({ status: 'start', epochs: this.parameters.epochs.value });
    const inputDim = data.x.shape[1];
    const numClasses = data.y.shape[1];
    this.buildModel(inputDim, numClasses);
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
    delete this.model;
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
  }

  fit(data: TrainingData, epochs = -1): void {
    const numEpochs = epochs > 0 ? epochs : this.parameters.epochs.value;
    this.model
      .fit(data.x, data.y, {
        batchSize: this.parameters.batchSize.value,
        epochs: numEpochs,
        shuffle: true,
        validationSplit: this.parameters.validationSplit.value,
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
        data.x.dispose();
        data.y.dispose();
      });
  }
}
