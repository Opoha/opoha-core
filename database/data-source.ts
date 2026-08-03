/**
 * CLI DataSource for TypeORM migrations and seeds.
 * Nest app uses TypeOrmModule.forRootAsync with the same DATABASE_URL + entities.
 */
import 'reflect-metadata';
import { config as loadDotenv } from 'dotenv';
import { DataSource } from 'typeorm';

import { authEntities } from '../src/modules/auth/entities';
import { AuthSpikeInit1722681855000 } from './migrations/1722681855000-AuthSpikeInit';

loadDotenv();

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is required for TypeORM DataSource');
}

export default new DataSource({
  type: 'postgres',
  url,
  entities: [...authEntities],
  migrations: [AuthSpikeInit1722681855000],
  synchronize: false,
});
