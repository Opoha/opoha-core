import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/public';
import { CustomerModule } from '../customer/public';
import { StoresModule } from '../stores/public';
import { CompanyResolver } from './company.resolver';
import { CompanyService } from './company.service';
import { b2bEntities } from './entities';
import { CompanyEventsRegistrar } from './events/company-events.registrar';

@Module({
  imports: [
    AuthModule,
    CustomerModule,
    StoresModule,
    TypeOrmModule.forFeature([...b2bEntities]),
  ],
  providers: [CompanyService, CompanyResolver, CompanyEventsRegistrar],
  exports: [CompanyService, TypeOrmModule],
})
export class B2bModule {}
