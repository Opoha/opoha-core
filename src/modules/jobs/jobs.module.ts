import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';
import { BullMqJobQueueAdapter } from './bullmq-job-queue.adapter';
import { jobEntities } from './entities';
import { InMemoryJobQueueAdapter } from './in-memory-job-queue.adapter';
import { JOB_QUEUE_ADAPTER } from './job-queue.adapter';
import { JobsService } from './jobs.service';
import { ScheduledJobRegistry } from './scheduled-job.registry';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([...jobEntities])],
  providers: [
    ScheduledJobRegistry,
    InMemoryJobQueueAdapter,
    BullMqJobQueueAdapter,
    {
      provide: JOB_QUEUE_ADAPTER,
      inject: [ConfigService, InMemoryJobQueueAdapter, BullMqJobQueueAdapter],
      useFactory: (
        config: ConfigService,
        memory: InMemoryJobQueueAdapter,
        bullmq: BullMqJobQueueAdapter,
      ) => {
        const mode = config.get('OPOHA_JOB_QUEUE');
        return mode === 'bullmq' ? bullmq : memory;
      },
    },
    JobsService,
  ],
  exports: [
    JobsService,
    ScheduledJobRegistry,
    JOB_QUEUE_ADAPTER,
    TypeOrmModule,
  ],
})
export class JobsModule {}
