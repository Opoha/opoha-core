import { Field, ObjectType } from '@nestjs/graphql';

import { UserType } from './users/user.types';

@ObjectType({ description: 'Access + opaque refresh token pair for staff auth' })
export class AuthPayload {
  @Field(() => String)
  accessToken!: string;

  @Field(() => String, {
    description: 'Opaque refresh token — store securely; rotated on each refresh',
  })
  refreshToken!: string;

  @Field(() => UserType)
  user!: UserType;
}
