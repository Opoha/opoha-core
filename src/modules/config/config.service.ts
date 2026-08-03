import { Injectable } from '@nestjs/common';

import { type AppEnv, loadEnv } from './env.schema';

@Injectable()
export class ConfigService {
  private readonly env: AppEnv;

  constructor() {
    this.env = loadEnv();
  }

  get<K extends keyof AppEnv>(key: K): AppEnv[K] {
    return this.env[key];
  }

  getAll(): Readonly<AppEnv> {
    return this.env;
  }
}
