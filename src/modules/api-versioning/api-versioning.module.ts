import { Global, Module } from '@nestjs/common';

import { ApiVersionMiddleware } from './api-version.middleware';

@Global()
@Module({
  providers: [ApiVersionMiddleware],
  exports: [ApiVersionMiddleware],
})
export class ApiVersioningModule {}
