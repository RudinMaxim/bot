import { Module } from '@nestjs/common';
import { LocalesModule } from 'src/domain/locales';
import {
    AiService,
    InputValidationService,
    SessionContextService,
    AgentOrchestratorService,
    MetricsService,
    FeedbackService,
    AiCancellationService,
    RetentionCleanupService,
    SpecialistCatalogService,
} from './services';
import { ConfigModule } from 'src/infrastructure/config';
import { VectorizationModule } from 'src/infrastructure/vectorization';
import { SearchBaseModule } from 'src/domain/search-base';
import {
    CoordinatorAgent,
    ResponseAgent,
    SearchAgent,
    SummarizationAgent,
    SummarizationRunnerService,
} from './agents';
import { CoordinatorPreRouterService } from './agents/coordinator/coordinator-pre-router.service';
import { ResponseQuickRepliesService } from './agents/response/common/services/response-quick-replies.service';
import {
    ActionLogRepository,
    FeedbackRepository,
    MetricsRepository,
    SessionContextRepository,
    MetricsLogRepository,
    QueryCacheRepository,
} from './repository';

@Module({
    imports: [ConfigModule, VectorizationModule, SearchBaseModule, LocalesModule],
    controllers: [],
    providers: [
        // Core service
        AiService,
        AgentOrchestratorService,

        // Supporting services
        InputValidationService,
        SessionContextService,
        ResponseQuickRepliesService,
        MetricsService,
        FeedbackService,
        AiCancellationService,
        RetentionCleanupService,
        SpecialistCatalogService,

        // Repository
        MetricsRepository,
        MetricsLogRepository,
        FeedbackRepository,
        ActionLogRepository,
        SessionContextRepository,
        QueryCacheRepository,

        // Agents
        CoordinatorAgent,
        CoordinatorPreRouterService,
        SearchAgent,
        ResponseAgent,
        SummarizationAgent,
        SummarizationRunnerService,
    ],
    exports: [
        AiService,
        MetricsService,
        FeedbackService,
        ActionLogRepository,
    ],
})
export class AiModule {}
