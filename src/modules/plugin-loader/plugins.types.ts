import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Admin settings contribution path for a plugin' })
export class PluginSettingsPathType {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  title!: string;

  @Field(() => String)
  path!: string;

  @Field(() => String, { nullable: true })
  permission?: string | null;
}

@ObjectType({ description: 'Discovered plugin runtime + durable admin state' })
export class PluginType {
  @Field(() => ID, { description: 'Plugin id (kebab-case)' })
  id!: string;

  @Field(() => String)
  version!: string;

  @Field(() => String, { nullable: true })
  displayName?: string | null;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => String, {
    description: 'Lifecycle state: discovered|installed|enabled|disabled|uninstalled',
  })
  state!: string;

  @Field(() => Boolean)
  booted!: boolean;

  @Field(() => Boolean, {
    description: 'Durable enabled preference from plugin_states',
  })
  enabled!: boolean;

  @Field(() => String, {
    nullable: true,
    description: 'Opaque JSON object string for admin configure',
  })
  configJson?: string | null;

  @Field(() => [String])
  dependsOn!: string[];

  @Field(() => [PluginSettingsPathType])
  settingsPaths!: PluginSettingsPathType[];
}

@InputType()
export class UpdatePluginConfigInput {
  @Field(() => String, {
    description: 'JSON object string (parsed server-side; must be a plain object)',
  })
  configJson!: string;
}
