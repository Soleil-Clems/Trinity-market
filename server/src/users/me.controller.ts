import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/current-user.decorator.js';
import { ChangePasswordDto } from '../auth/dto/password.dto.js';
import { PasswordManagementService } from '../auth/password-management.service.js';
import { UpdateMeDto } from './dto/user.dto.js';
import { USER_SCHEMA } from './user.schema.js';
import { UsersService } from './users.service.js';

@ApiTags('me')
@ApiUnauthorizedResponse({ description: 'Non authentifié' })
@Controller('me')
export class MeController {
  constructor(
    private readonly users: UsersService,
    private readonly passwordManagement: PasswordManagementService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Mon compte' })
  @ApiOkResponse({ schema: USER_SCHEMA })
  findMe(@CurrentUser() user: AuthenticatedUser) {
    return this.users.findOne(user.id);
  }

  @Patch()
  @ApiOperation({
    summary: 'Modifie mon prénom, mon nom ou mon téléphone',
    description:
      "L'email et les heures contractuelles se modifient par le manager ou l'admin.",
  })
  @ApiOkResponse({ schema: USER_SCHEMA })
  @ApiUnprocessableEntityResponse({
    description: 'Champ invalide ou non modifiable',
  })
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateMeDto) {
    return this.users.update(user.id, body);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Supprime mon compte en l’anonymisant',
    description:
      'Toutes mes sessions sont révoquées. Mes pointages sont conservés.',
  })
  @ApiNoContentResponse()
  @ApiConflictResponse({ description: 'Je gère encore des équipes' })
  async deleteMe(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.users.anonymize(user.id);
  }

  @Patch('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Change mon mot de passe',
    description:
      'Exige le mot de passe actuel. Les autres sessions du compte sont révoquées, la session courante est conservée.',
  })
  @ApiNoContentResponse()
  @ApiUnprocessableEntityResponse({
    description:
      'Mot de passe actuel incorrect, ou nouveau mot de passe trop court ou trop courant',
  })
  @ApiTooManyRequestsResponse({
    description: '5 mots de passe actuels erronés en 15 minutes',
  })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ChangePasswordDto,
  ): Promise<void> {
    await this.passwordManagement.changePassword(
      user,
      body.currentPassword,
      body.newPassword,
    );
  }
}
