import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule } from './shared/swagger/swagger.module';
import { GlobalConfig, SecretsConfig } from './infrastructure/config';
import { SecurityModule } from './shared/security';
import { HttpExceptionFilter } from './shared/filters';
import {
    JsonLogger,
    LoggingInterceptor,
    requestContextMiddleware,
} from './shared/logging';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, { bufferLogs: true });
    const globalConfig = app.get(GlobalConfig);
    const secretsConfig = app.get(SecretsConfig);
    const logger = new JsonLogger(globalConfig.server.logLevel);
    app.useLogger(logger);
    Logger.overrideLogger(logger);
    app.setGlobalPrefix('api');
    app.use(requestContextMiddleware);
    app.enableVersioning({
        type: VersioningType.URI,
    });
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new LoggingInterceptor());
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
            forbidNonWhitelisted: true,
            disableErrorMessages: globalConfig.env.isProduction,
            validationError: { target: false, value: true },
        }),
    );

    SecurityModule.configure(app, secretsConfig);
    SwaggerModule.configure(app, globalConfig, secretsConfig);

    app.enableShutdownHooks();

    const port = globalConfig.server.port;
    await app.listen(port, globalConfig.server.host);

    logger.log(`HTTP server started on ${globalConfig.server.host}:${port}`);
}

void bootstrap();
