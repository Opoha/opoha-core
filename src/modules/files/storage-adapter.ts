/**
 * Storage adapter port — plugins implement; core never imports S3/localfs SDKs.
 * Shape mirrors `@opoha/plugin-sdk` StorageAdapter.
 */
export type StoragePutInput = {
  key: string;
  body: Uint8Array;
  contentType?: string;
  metadata?: Record<string, string>;
};

export type StoragePutResult = {
  key: string;
  size: number;
};

export type StorageAdapter = {
  readonly code: string;
  put(input: StoragePutInput): Promise<StoragePutResult>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
  getUrl?(key: string): Promise<string | undefined>;
};

export type RegisteredStorageAdapter = {
  pluginId: string;
  adapter: StorageAdapter;
  active: boolean;
};
