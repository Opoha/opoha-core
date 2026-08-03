import { Controller, Get, Inject } from '@nestjs/common';

import { HealthService } from './health.service';
import type { LivenessResult, ReadinessResult } from './health.service';

@Controller('health')
export class HealthController {
  constructor(@Inject(HealthService) private readonly health: HealthService) {}

  @Get('live')
  live(): LivenessResult {
    return this.health.liveness();
  }

  @Get('ready')
  ready(): ReadinessResult {
    return this.health.readiness();
  }
}
