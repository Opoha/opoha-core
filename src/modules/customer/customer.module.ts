import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/public';
import { CustomerAddressesResolver } from './customer-addresses.resolver';
import { CustomerAddressesService } from './customer-addresses.service';
import { CustomerGroupsResolver } from './customer-groups.resolver';
import { CustomerGroupsService } from './customer-groups.service';
import { CustomersResolver } from './customers.resolver';
import { CustomersService } from './customers.service';
import { customerEntities } from './entities';
import { CustomerEventsRegistrar } from './events/customer-events.registrar';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([...customerEntities])],
  providers: [
    CustomersService,
    CustomersResolver,
    CustomerAddressesService,
    CustomerAddressesResolver,
    CustomerGroupsService,
    CustomerGroupsResolver,
    CustomerEventsRegistrar,
  ],
  exports: [CustomersService, CustomerAddressesService, CustomerGroupsService, TypeOrmModule],
})
export class CustomerModule {}
