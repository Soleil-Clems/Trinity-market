import { SetMetadata } from '@nestjs/common';

export const OWNERSHIP_KEY = 'ownership';

export interface OwnershipRule {
  resource: 'user' | 'team';
  param: string;
}

export const CanAccessUser = (param = 'id') =>
  SetMetadata(OWNERSHIP_KEY, {
    resource: 'user',
    param,
  } satisfies OwnershipRule);

export const CanAccessTeam = (param = 'id') =>
  SetMetadata(OWNERSHIP_KEY, {
    resource: 'team',
    param,
  } satisfies OwnershipRule);
