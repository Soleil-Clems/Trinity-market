import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Env } from '../config/env.js';
import { REFRESH_COOKIE_NAME } from './auth.constants.js';
import { AuthService, Session } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
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
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.respond(
      await this.auth.login(body.email, body.password),
      response,
    );
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
