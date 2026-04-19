import { Module, DynamicModule, INestApplication, Logger } from '@nestjs/common';
import {
    DocumentBuilder,
    SwaggerDocumentOptions,
    SwaggerModule as NestSwaggerModule,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import {
    ConfigModule,
    GlobalConfig,
    SecretsConfig,
} from 'src/infrastructure/config';

class swaggerConstants {
    private static instance: swaggerConstants;

    private constructor() {}

    public static getInstance(): swaggerConstants {
        if (!swaggerConstants.instance) {
            swaggerConstants.instance = new swaggerConstants();
        }
        return swaggerConstants.instance;
    }

    readonly TITLE = 'Developer AI - RESTFUL API';
    readonly VERSION = '0.1.0'; // Will be set from GlobalConfig
}

export const SwaggerConstants = swaggerConstants.getInstance();

@Module({})
export class SwaggerModule {
    static forRoot(): DynamicModule {
        return {
            module: SwaggerModule,
            imports: [ConfigModule],
        };
    }

    public static configure(
        app: INestApplication,
        globalConfig: GlobalConfig,
        _secrets: SecretsConfig,
    ): void {
        if (
            !globalConfig.server.swagger.enabled ||
            globalConfig.env.isProduction
        ) {
            return;
        }

        const swaggerPath = globalConfig.server.swagger.path;

        const config = new DocumentBuilder()
            .setTitle(SwaggerConstants.TITLE)
            .setVersion(globalConfig.server.version)
            .build();

        const options: SwaggerDocumentOptions = {
            operationIdFactory: (controllerKey: string, methodKey: string) =>
                `${controllerKey.replace('Controller', '')}_${methodKey}`,
            deepScanRoutes: true,
            ignoreGlobalPrefix: false,
        };

        const document = NestSwaggerModule.createDocument(app, config, options);

        app.use(
            swaggerPath + '-json',
            (_req: Request, res: Response) => {
                res.setHeader('Content-Type', 'application/json');
                res.send(document);
            },
        );

        NestSwaggerModule.setup(
            swaggerPath,
            app,
            document,
            {
                explorer: true,
                swaggerOptions: {
                    docExpansion: 'list',
                    filter: true,
                    showRequestDuration: true,
                    persistAuthorization: true,
                    displayOperationId: true,
                    operationsSorter: 'alpha',
                    tagsSorter: 'alpha',
                    defaultModelsExpandDepth: 2,
                    defaultModelExpandDepth: 3,
                    tryItOutEnabled: true,
                    requestSnippetsEnabled: true,
                },
                customSiteTitle: `${SwaggerConstants.TITLE} (Внутренняя документация)`,
            },
        );
    }

}
