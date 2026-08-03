import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('AdminNavItem')
export class AdminNavItemType {
  @Field()
  id!: string;

  @Field()
  label!: string;

  @Field()
  path!: string;

  @Field({ nullable: true })
  icon?: string;

  @Field(() => Int, { nullable: true })
  order?: number;

  @Field({ nullable: true })
  permission?: string;
}

@ObjectType('AdminPageContribution')
export class AdminPageContributionType {
  @Field()
  id!: string;

  @Field()
  path!: string;

  @Field()
  title!: string;

  @Field({ nullable: true })
  permission?: string;
}

@ObjectType('AdminWidgetContribution')
export class AdminWidgetContributionType {
  @Field()
  id!: string;

  @Field()
  title!: string;

  @Field({ nullable: true })
  permission?: string;
}

@ObjectType('AdminSettingsContribution')
export class AdminSettingsContributionType {
  @Field()
  id!: string;

  @Field()
  title!: string;

  @Field()
  path!: string;

  @Field({ nullable: true })
  permission?: string;
}

@ObjectType('AdminTabContribution')
export class AdminTabContributionType {
  @Field()
  id!: string;

  @Field()
  label!: string;

  @Field({ nullable: true })
  permission?: string;
}

@ObjectType('AdminEntityTabs')
export class AdminEntityTabsType {
  @Field(() => [AdminTabContributionType], { nullable: true })
  product?: AdminTabContributionType[];

  @Field(() => [AdminTabContributionType], { nullable: true })
  order?: AdminTabContributionType[];

  @Field(() => [AdminTabContributionType], { nullable: true })
  customer?: AdminTabContributionType[];
}

@ObjectType('AdminPluginContribution')
export class AdminPluginContributionType {
  @Field()
  pluginId!: string;

  @Field(() => [AdminNavItemType])
  navigation!: AdminNavItemType[];

  @Field(() => [AdminPageContributionType])
  pages!: AdminPageContributionType[];

  @Field(() => [AdminWidgetContributionType])
  widgets!: AdminWidgetContributionType[];

  @Field(() => [AdminSettingsContributionType])
  settings!: AdminSettingsContributionType[];

  @Field(() => AdminEntityTabsType, { nullable: true })
  tabs?: AdminEntityTabsType;

  @Field(() => [String])
  permissions!: string[];
}

@ObjectType('AdminExtensionManifest')
export class AdminExtensionManifestType {
  @Field(() => [AdminPluginContributionType])
  plugins!: AdminPluginContributionType[];
}
