import type { Role } from '../generated/prisma/enums.js';

export const USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  role: true,
  contractMinutesPerWeek: true,
  timezone: true,
  passwordHash: true,
  microsoftId: true,
  createdAt: true,
  updatedAt: true,
  memberships: {
    select: { team: { select: { id: true, name: true } } },
    orderBy: { team: { name: 'asc' } },
  },
} as const;

interface SelectedUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: Role;
  contractMinutesPerWeek: number;
  timezone: string;
  passwordHash: string | null;
  microsoftId: string | null;
  createdAt: Date;
  updatedAt: Date;
  memberships: { team: { id: string; name: string } }[];
}

export interface UserResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: Role;
  contractMinutesPerWeek: number;
  timezone: string;
  status: 'ACTIVE' | 'INVITED';
  teams: { id: string; name: string }[];
  createdAt: Date;
  updatedAt: Date;
}

export function presentUser(user: SelectedUser): UserResponse {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    contractMinutesPerWeek: user.contractMinutesPerWeek,
    timezone: user.timezone,
    status: user.passwordHash || user.microsoftId ? 'ACTIVE' : 'INVITED',
    teams: user.memberships.map(({ team }) => team),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
