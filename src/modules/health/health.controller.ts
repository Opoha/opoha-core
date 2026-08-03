import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';

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
  async ready(): Promise<ReadinessResult> {
    const result = await this.health.readiness();
    if (result.status !== 'ok') {
      throw new ServiceUnavailableException({
        status: result.status,
        checks: result.checks,
        message: 'One or more readiness checks failed',
      });
    }
    return result;
  }
}
