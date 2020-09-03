import type { SvelteComponent } from 'svelte';
import type { Stream } from './stream';

export interface ModuleInternals {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  streams: Array<Stream<any>>;
  app?: SvelteComponent;
  readonly moduleType: string;
  [key: string]: unknown;
}

export interface Parametrable {
  parameters: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [name: string]: Stream<any>;
  };
}

export type ObjectId = string;

export interface Instance {
  id?: ObjectId;
  label: string;
  data: unknown;
  thumbnail?: string;
  features?: number[][];
  type?: string;
  [key: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export interface TrainingStatus {
  status: 'idle' | 'start' | 'epoch' | 'success' | 'error';
  epoch?: number;
  epochs?: number;
  data?: Record<string, unknown>;
}

export interface Prediction {
  id?: ObjectId;
  instanceId: ObjectId;
  label?: string;
  trueLabel?: string;
  confidences?: Record<string, number>;
  [key: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}