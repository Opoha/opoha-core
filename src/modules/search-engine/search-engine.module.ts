import { Global, Module } from '@nestjs/common';

import { AuthModule } from '../auth/public';
import { EventBusModule } from '../event-bus/event-bus.module';
import { SearchEngine } from './search-engine.service';
import { SearchIndexListener } from './search-index.listener';
import { SearchProviderRegistry } from './search-provider.registry';
import { SearchResolver } from './search.resolver';

@Global()
@Module({
  imports: [AuthModule, EventBusModule],
  providers: [SearchProviderRegistry, SearchEngine, SearchResolver, SearchIndexListener],
  exports: [SearchProviderRegistry, SearchEngine],
})
export class SearchEngineModule {}
