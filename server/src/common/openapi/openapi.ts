import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

export const OPENAPI_PATH = 'api/docs';

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Time Manager API')
    .setDescription(
      'API REST de pointage de Trinity Market : utilisateurs, équipes, pointages et KPIs.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  return SwaggerModule.createDocument(app, config);
}

export function setupOpenApi(app: INestApplication): void {
  SwaggerModule.setup(OPENAPI_PATH, app, buildOpenApiDocument(app), {
    jsonDocumentUrl: `${OPENAPI_PATH}/openapi.json`,
    yamlDocumentUrl: `${OPENAPI_PATH}/openapi.yaml`,
  });
}
