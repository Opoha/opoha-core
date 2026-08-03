import { Args, Mutation, Resolver } from '@nestjs/graphql';

import { AuthService } from './auth.service';
import { AuthPayload } from './auth.types';

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation(() => AuthPayload, {
    name: 'login',
    description: 'Staff login — returns JWT access token (public)',
  })
  login(
    @Args('email', { type: () => String }) email: string,
    @Args('password', { type: () => String }) password: string,
  ): Promise<AuthPayload> {
    return this.authService.login(email, password);
  }
}
