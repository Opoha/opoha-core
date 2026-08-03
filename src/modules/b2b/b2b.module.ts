import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/public';
import { CustomerModule } from '../customer/public';
import { StoresModule } from '../stores/public';
import { B2bQuoteResolver } from './b2b-quote.resolver';
import { B2bQuoteService } from './b2b-quote.service';
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
  providers: [
    CompanyService,
    CompanyResolver,
    B2bQuoteService,
    B2bQuoteResolver,
    CompanyEventsRegistrar,
  ],
  exports: [CompanyService, B2bQuoteService, TypeOrmModule],
})
export class B2bModule {}
