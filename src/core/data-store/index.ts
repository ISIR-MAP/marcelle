import { DataStore, DataStoreOptions } from './data-store';

export function dataStore(options?: Partial<DataStoreOptions>): DataStore {
  return new DataStore(options);
}

export type { DataStore, DataStoreOptions };
