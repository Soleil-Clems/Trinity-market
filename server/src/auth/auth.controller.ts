import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Env } from '../config/env.js';
import { REFRESH_COOKIE_NAME } from './auth.constants.js';
import { AuthService, Session } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password.dto.js';
import { PasswordManagementService } from './password-management.service.js';
import { Public } from './public.decorator.js';
import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
} from './refresh-cookie.js';

const SESSION_SCHEMA = {
  type: 'object',
  properties: {
    accessToken: { type: 'string' },
    tokenType: { type: 'string', enum: ['Bearer'] },
    expiresIn: { type: 'integer', example: 900 },
    user: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        email: { type: 'string', format: 'email' },
        role: { type: 'string', enum: ['EMPLOYEE', 'MANAGER', 'ADMIN'] },
      },
    },
  },
};

@ApiTags('auth')
@Public()
@Controller('auth')
export class AuthController {
  private readonly secureCookie: boolean;

  constructor(
    private readonly auth: AuthService,
    private readonly passwordManagement: PasswordManagementService,
    config: ConfigService<Env, true>,
  ) {
    this.secureCookie =
      config.get('NODE_ENV', { infer: true }) === 'production';
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Connexion par email et mot de passe' })
  @ApiOkResponse({
    schema: SESSION_SCHEMA,
    description: `Pose aussi le cookie httpOnly ${REFRESH_COOKIE_NAME}`,
  })
  @ApiUnauthorizedResponse({ description: 'Email ou mot de passe invalide' })
  @ApiUnprocessableEntityResponse({ description: 'Corps de requête invalide' })
  @ApiTooManyRequestsResponse({
    description: '5 échecs en 15 minutes pour ce couple IP + email',
  })
  async login(
    @Body() body: LoginDto,
    @Ip() ip: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.respond(
      await this.auth.login(body.email, body.password, ip),
      response,
    );
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Envoie un lien de réinitialisation valable 30 minutes',
    description:
      "La réponse est la même que l'email corresponde à un compte ou non.",
  })
  @ApiAcceptedResponse({ description: 'Demande prise en compte' })
  @ApiUnprocessableEntityResponse({ description: 'Email invalide' })
  @ApiTooManyRequestsResponse({
    description: '5 demandes en 15 minutes pour ce couple IP + email',
  })
  async forgotPassword(
    @Body() body: ForgotPasswordDto,
    @Ip() ip: string,
  ): Promise<{ message: string }> {
    await this.passwordManagement.requestReset(body.email, ip);

    return {
      message: 'If an account matches this email, a reset link has been sent',
    };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Définit le mot de passe à partir d'un lien reçu par mail",
    description:
      "Accepte les liens de réinitialisation et d'activation. Toutes les sessions du compte sont révoquées.",
  })
  @ApiNoContentResponse()
  @ApiBadRequestResponse({
    description: 'Token inconnu, expiré ou déjà utilisé',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Mot de passe trop court ou trop courant',
  })
  async resetPassword(@Body() body: ResetPasswordDto): Promise<void> {
    await this.passwordManagement.resetPassword(body.token, body.password);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Renouvelle la session et remplace le refresh token',
    description: `Lit le cookie httpOnly ${REFRESH_COOKIE_NAME}, que le navigateur envoie tout seul après un login.`,
  })
  @ApiOkResponse({ schema: SESSION_SCHEMA })
  @ApiUnauthorizedResponse({
    description:
      'Refresh token absent, expiré, révoqué ou déjà utilisé (la session entière est alors révoquée)',
  })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      return this.respond(
        await this.auth.refresh(readRefreshCookie(request)),
        response,
      );
    } catch (error) {
      clearRefreshCookie(response, this.secureCookie);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Révoque la session et supprime le cookie',
    description: `Lit le cookie httpOnly ${REFRESH_COOKIE_NAME}, que le navigateur envoie tout seul après un login.`,
  })
  @ApiNoContentResponse()
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(readRefreshCookie(request));
    clearRefreshCookie(response, this.secureCookie);
  }

  private respond(session: Session, response: Response) {
    const { refreshToken, ...body } = session;

    setRefreshCookie(response, refreshToken, this.secureCookie);

    return body;
  }
}
