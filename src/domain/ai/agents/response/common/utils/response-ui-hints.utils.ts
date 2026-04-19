import type { SupportedLocale } from 'src/domain/ai/common/utils';
import type { ResponseAgentInput } from '../types/response.types';
import type { ResponseUiHints } from '../types/response-internal.types';

type ResponseMetadataExtras = {
    contactFormRequired?: unknown;
    contactFormId?: unknown;
    siteActions?: unknown;
    siteActionsCount?: unknown;
    siteActionsTypes?: unknown;
};

export function extractUiHints(input: ResponseAgentInput): ResponseUiHints {
    const extras = (input.metadata?.extras ?? {}) as ResponseMetadataExtras;
    const actionsFromExtras = Array.isArray(extras.siteActions)
        ? (extras.siteActions as Array<{ type?: unknown }>)
        : [];

    const actionTypesFromActions = actionsFromExtras
        .map((action) =>
            typeof action?.type === 'string' ? action.type.trim() : '',
        )
        .filter((type) => type.length > 0);

    const actionTypesFromMetadata = Array.isArray(extras.siteActionsTypes)
        ? (extras.siteActionsTypes as unknown[])
              .filter((type): type is string => typeof type === 'string')
              .map((type) => type.trim())
              .filter((type) => type.length > 0)
        : [];

    const siteActionTypes = Array.from(
        new Set([...actionTypesFromMetadata, ...actionTypesFromActions]),
    );

    const siteActionsCount =
        typeof extras.siteActionsCount === 'number' &&
        Number.isFinite(extras.siteActionsCount)
            ? extras.siteActionsCount
            : Math.max(actionsFromExtras.length, siteActionTypes.length);

    return {
        contactFormRequired: Boolean(extras.contactFormRequired),
        contactFormId:
            typeof extras.contactFormId === 'string' &&
            extras.contactFormId.trim().length > 0
                ? extras.contactFormId.trim()
                : undefined,
        siteActionsAvailable: siteActionsCount > 0,
        siteActionTypes,
    };
}

export function alignResponseWithUiActions(
    response: string,
    locale: SupportedLocale,
    uiHints: ResponseUiHints,
): string {
    const normalized = response.trim();
    if (!normalized || !uiHints.siteActionsAvailable) {
        return normalized;
    }

    const sentences = normalized
        .split(/(?<=[.!?…])\s+/u)
        .map((sentence) => sentence.trim())
        .filter((sentence) => sentence.length > 0);

    const filteredSentences = sentences.filter(
        (sentence) => !isUiContradictionSentence(sentence, locale),
    );

    if (filteredSentences.length === sentences.length) {
        return normalized;
    }

    const intro =
        locale === 'en'
            ? 'I have already completed the action on the website and opened the relevant section.'
            : 'Я уже выполнил действие на сайте и открыл нужный раздел.';
    const fallback =
        locale === 'en'
            ? 'Please share the key parameters (budget, floor, finish), and I will refine the selection right away.'
            : 'Уточните ключевые параметры (бюджет, этаж, отделка), и я сразу уточню подбор.';
    const cleaned = filteredSentences.join(' ').trim();

    if (!cleaned) {
        return `${intro} ${fallback}`;
    }
    return `${intro} ${cleaned}`;
}

function isUiContradictionSentence(
    sentence: string,
    locale: SupportedLocale,
): boolean {
    if (!sentence) return false;

    const patterns =
        locale === 'en'
            ? [
                  /\bi cannot\b/i,
                  /\bi can't\b/i,
                  /\bi am unable\b/i,
                  /\bunable to\b/i,
                  /\bcould not\b/i,
                  /\bcan't provide\b/i,
                  /\bcannot provide\b/i,
              ]
            : [
                  /к сожалению/i,
                  /не могу/i,
                  /не удалось/i,
                  /не получится/i,
                  /не получается/i,
                  /не в состоянии/i,
              ];

    return patterns.some((pattern) => pattern.test(sentence));
}
