export const USER_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    firstName: { type: 'string' },
    lastName: { type: 'string' },
    email: { type: 'string', format: 'email' },
    phone: { type: 'string', nullable: true, example: '+33612345678' },
    role: { type: 'string', enum: ['EMPLOYEE', 'MANAGER', 'ADMIN'] },
    contractMinutesPerWeek: { type: 'integer', example: 2100 },
    timezone: { type: 'string', example: 'Europe/Paris' },
    status: {
      type: 'string',
      enum: ['ACTIVE', 'INVITED'],
      description: 'INVITED tant que le lien d’activation n’a pas été utilisé',
    },
    teams: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
        },
      },
    },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

export const USER_PAGE_SCHEMA = {
  type: 'object',
  properties: {
    items: { type: 'array', items: USER_SCHEMA },
    page: { type: 'integer', example: 1 },
    pageSize: { type: 'integer', example: 20 },
    total: { type: 'integer', example: 42 },
  },
};
