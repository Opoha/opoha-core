import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/public';
import { EventBusModule } from '../event-bus/event-bus.module';
import { segmentEntities } from './entities';
import { SegmentEventsRegistrar } from './events/segment-events.registrar';
import { SegmentsResolver } from './segments.resolver';
import { SegmentsService } from './segments.service';

@Module({
  imports: [
    AuthModule,
    EventBusModule,
    TypeOrmModule.forFeature([...segmentEntities]),
  ],
  providers: [SegmentsService, SegmentsResolver, SegmentEventsRegistrar],
  exports: [SegmentsService, TypeOrmModule],
})
export class SegmentsModule {}
