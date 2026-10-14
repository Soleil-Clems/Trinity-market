import { Body, Controller, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentUser } from './current-user.decorator.js';
import type { AuthenticatedUser } from './current-user.decorator.js';
import { ChangePasswordDto } from './dto/password.dto.js';
import { PasswordManagementService } from './password-management.service.js';

@ApiTags('me')
@Controller('me')
export class MePasswordController {
  constructor(private readonly passwordManagement: PasswordManagementService) {}

  @Patch('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Change le mot de passe de l’utilisateur connecté',
    description:
      'Exige le mot de passe actuel. Les autres sessions du compte sont révoquées, la session courante est conservée.',
  })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ description: 'Non authentifié' })
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
