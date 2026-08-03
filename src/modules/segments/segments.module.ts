import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EventBusModule } from '../event-bus/event-bus.module';
import { segmentEntities } from './entities';
import { SegmentEventsRegistrar } from './events/segment-events.registrar';
import { SegmentsService } from './segments.service';

@Module({
  imports: [EventBusModule, TypeOrmModule.forFeature([...segmentEntities])],
  providers: [SegmentsService, SegmentEventsRegistrar],
  exports: [SegmentsService, TypeOrmModule],
})
export class SegmentsModule {}
