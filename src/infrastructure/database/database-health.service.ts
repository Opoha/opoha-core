import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseHealthService {
  constructor(private readonly dataSource: DataSource) {}

  async ping(): Promise<boolean> {
    await this.dataSource.query('SELECT 1');
    return true;
  }
}
