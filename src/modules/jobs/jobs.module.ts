import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BullMqJobQueueAdapter } from './bullmq-job-queue.adapter';
import { jobEntities } from './entities';
import { JOB_QUEUE_ADAPTER } from './job-queue.adapter';
import { JobsService } from './jobs.service';
import { ScheduledJobRegistry } from './scheduled-job.registry';

/**
 * Core `jobs` module (Phase 8 A-02/A-03).
 *
 * `JOB_QUEUE_ADAPTER` resolves to {@link BullMqJobQueueAdapter}, which
 * delegates to the in-memory bridge until a real Redis/BullMQ worker is
 * wired (`OPOHA_JOB_QUEUE=bullmq`) — unit gates and CI stay Redis-free per
 * the work plan decision. See docs/readiness/jobs-cron-contracts.md.
 */
@Module({
  imports: [TypeOrmModule.forFeature([...jobEntities])],
  providers: [
    ScheduledJobRegistry,
    BullMqJobQueueAdapter,
    { provide: JOB_QUEUE_ADAPTER, useExisting: BullMqJobQueueAdapter },
    JobsService,
  ],
  exports: [JobsService, ScheduledJobRegistry, TypeOrmModule],
})
export class JobsModule {}
