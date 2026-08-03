import { JobDefinitionEntity } from './job-definition.entity';
import { JobRunEntity } from './job-run.entity';

export const jobEntities = [JobDefinitionEntity, JobRunEntity] as const;

export { JobDefinitionEntity, JobRunEntity };
