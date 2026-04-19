import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { SearchBaseRefreshService } from '../src/domain/search-base/services';

interface CliOptions {
    locale?: string;
    force: boolean;
}

function parseArgs(argv: string[]): CliOptions {
    const options: CliOptions = {
        force: false,
    };

    for (const arg of argv) {
        if (arg === '--force') {
            options.force = true;
            continue;
        }

        if (arg.startsWith('--locale=')) {
            const locale = arg.slice('--locale='.length).trim();
            options.locale = locale || undefined;
            continue;
        }
    }

    return options;
}

async function bootstrap(): Promise<void> {
    const options = parseArgs(process.argv.slice(2));
    const app = await NestFactory.createApplicationContext(AppModule, {
        logger: ['error', 'warn', 'log'],
    });

    try {
        const refreshService = app.get(SearchBaseRefreshService);
        await refreshService.refreshSearchBaseEmbeddings({
            locale: options.locale,
            force: options.force,
        });

        process.stdout.write(
            `search-base refresh completed (force=${options.force}, locale=${options.locale ?? 'all'})\n`,
        );
    } finally {
        await app.close();
    }
}

bootstrap().catch((error) => {
    process.stderr.write(
        `search-base refresh failed: ${
            error instanceof Error ? error.message : String(error)
        }\n`,
    );
    process.exit(1);
});
