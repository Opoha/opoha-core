import { Field, ObjectType } from '@nestjs/graphql';

import { UserType } from './users/user.types';

@ObjectType({ description: 'JWT access token response (refresh lands in C-04)' })
export class AuthPayload {
  @Field()
  accessToken!: string;

  @Field(() => UserType)
  user!: UserType;
}
