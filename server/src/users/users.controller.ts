import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CanAccessUser } from '../auth/access/ownership.decorator.js';
import { Roles } from '../auth/access/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/current-user.decorator.js';
import {
  CreateUserDto,
  ListUsersQueryDto,
  UpdateUserDto,
} from './dto/user.dto.js';
import { USER_PAGE_SCHEMA, USER_SCHEMA } from './user.schema.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@ApiUnauthorizedResponse({ description: 'Non authentifié' })
@ApiForbiddenResponse({ description: 'Rôle ou périmètre insuffisant' })
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({
    summary: 'Liste paginée des utilisateurs visibles',
    description:
      "Un manager ne voit que lui-même et les membres de ses équipes, un admin toute l'entreprise. `search` cherche dans le prénom, le nom et l'email.",
  })
  @ApiOkResponse({ schema: USER_PAGE_SCHEMA })
  @ApiUnprocessableEntityResponse({ description: 'Paramètres invalides' })
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListUsersQueryDto,
  ) {
    return this.users.list(actor, query);
  }

  @Post()
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({
    summary: "Crée un compte et envoie le lien d'activation",
    description:
      "Un manager doit l'ajouter à au moins une de ses équipes (`teamIds`) et ne crée que des `EMPLOYEE`. Un admin choisit le rôle, les équipes sont facultatives.",
  })
  @ApiCreatedResponse({ schema: USER_SCHEMA })
  @ApiConflictResponse({ description: 'Email déjà utilisé' })
  @ApiUnprocessableEntityResponse({ description: 'Corps de requête invalide' })
  create(@CurrentUser() actor: AuthenticatedUser, @Body() body: CreateUserDto) {
    return this.users.create(actor, body);
  }

  @Get(':id')
  @CanAccessUser()
  @ApiOperation({ summary: 'Détail d’un utilisateur' })
  @ApiOkResponse({ schema: USER_SCHEMA })
  @ApiNotFoundResponse({ description: 'Compte supprimé (admin)' })
  findOne(@Param('id') id: string) {
    return this.users.findOne(id);
  }

  @Patch(':id')
  @Roles('MANAGER', 'ADMIN')
  @CanAccessUser()
  @ApiOperation({
    summary: 'Modifie prénom, nom, email, téléphone ou heures contractuelles',
  })
  @ApiOkResponse({ schema: USER_SCHEMA })
  @ApiNotFoundResponse({ description: 'Compte supprimé (admin)' })
  @ApiConflictResponse({ description: 'Email déjà utilisé' })
  @ApiUnprocessableEntityResponse({ description: 'Corps de requête invalide' })
  update(@Param('id') id: string, @Body() body: UpdateUserDto) {
    return this.users.update(id, body);
  }

  @Delete(':id')
  @Roles('MANAGER', 'ADMIN')
  @CanAccessUser()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Supprime le compte en l’anonymisant',
    description:
      'Nom, email, téléphone, identifiant Microsoft et mot de passe sont effacés, les sessions révoquées. Les pointages sont conservés.',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Compte déjà supprimé (admin)' })
  @ApiConflictResponse({
    description: 'Le compte gère encore des équipes',
  })
  async remove(@Param('id') id: string): Promise<void> {
    await this.users.anonymize(id);
  }
}
