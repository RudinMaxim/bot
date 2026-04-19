import {
    QUICK_REPLY_INTENT,
    QUICK_REPLY_KEY_SET,
    QUICK_REPLY_TEXT,
    type QuickReplyIntent,
    type QuickReplyTextKey,
} from 'src/domain/ai/agents/response/common/constants/response.const';
import { resolveLocale, t } from '../../../../shared/utils';

type SupportedLocale = ReturnType<typeof resolveLocale>;

type QuickReplyNormalizationResult = {
    content: string;
    intent?: QuickReplyIntent;
};

const QUICK_REPLY_INTENT_BY_KEY: Readonly<
    Partial<Record<QuickReplyTextKey, QuickReplyIntent>>
> = {
    [QUICK_REPLY_TEXT.SHOW_ALL_APARTMENTS]:
        QUICK_REPLY_INTENT.CHECK_AVAILABILITY,
    [QUICK_REPLY_TEXT.SIMILAR_OPTIONS]: QUICK_REPLY_INTENT.EXPLORE_SIMILAR,
    [QUICK_REPLY_TEXT.MORTGAGE_DISCOUNTS]: QUICK_REPLY_INTENT.ASK_PAYMENT,
    [QUICK_REPLY_TEXT.TRANSPORT_AREA]: QUICK_REPLY_INTENT.ASK_LOCATION,
    [QUICK_REPLY_TEXT.LAYOUTS_FINISHING]: QUICK_REPLY_INTENT.ASK_FEATURES,
    [QUICK_REPLY_TEXT.INFRASTRUCTURE_NEARBY]:
        QUICK_REPLY_INTENT.ASK_INFRASTRUCTURE,
    [QUICK_REPLY_TEXT.ABOUT_MR_GROUP]: QUICK_REPLY_INTENT.ASK_DEVELOPER,
    [QUICK_REPLY_TEXT.FACTS_MR_GROUP]: QUICK_REPLY_INTENT.ASK_DEVELOPER,
    [QUICK_REPLY_TEXT.CONSTRUCTION_PROGRESS]:
        QUICK_REPLY_INTENT.ASK_CONSTRUCTION,
    [QUICK_REPLY_TEXT.CONTINUE_SEARCH]: QUICK_REPLY_INTENT.CONTINUE_SEARCH,
    [QUICK_REPLY_TEXT.FACTS_MYS]: QUICK_REPLY_INTENT.ASK_FEATURES,
    [QUICK_REPLY_TEXT.PROS_CONS_MYS]: QUICK_REPLY_INTENT.ASK_INFRASTRUCTURE,
    [QUICK_REPLY_TEXT.COMPLETION_TIMELINES]:
        QUICK_REPLY_INTENT.ASK_CONSTRUCTION,
    [QUICK_REPLY_TEXT.PARKING_STORAGE]: QUICK_REPLY_INTENT.ASK_INFRASTRUCTURE,
    [QUICK_REPLY_TEXT.COMPARE_OTHER]: QUICK_REPLY_INTENT.CONTINUE_SEARCH,
    [QUICK_REPLY_TEXT.CURATE_CRITERIA]: QUICK_REPLY_INTENT.CONTINUE_SEARCH,
    [QUICK_REPLY_TEXT.PAYMENT_OPTIONS]: QUICK_REPLY_INTENT.ASK_PAYMENT,
    [QUICK_REPLY_TEXT.LEARN_CONSTRUCTION_PROGRESS]:
        QUICK_REPLY_INTENT.ASK_CONSTRUCTION,
    [QUICK_REPLY_TEXT.LEAVE_CONTACTS_FOR_CONSULTATION]:
        QUICK_REPLY_INTENT.REQUEST_CONSULTATION,
    [QUICK_REPLY_TEXT.LEAVE_CONTACTS]: QUICK_REPLY_INTENT.REQUEST_CONSULTATION,
    [QUICK_REPLY_TEXT.LEARN_DISCOUNTS]: QUICK_REPLY_INTENT.ASK_PAYMENT,
    [QUICK_REPLY_TEXT.DISCUSS_PURCHASE_TERMS]: QUICK_REPLY_INTENT.ASK_PAYMENT,
    [QUICK_REPLY_TEXT.TELL_MORTGAGE_DISCOUNTS]: QUICK_REPLY_INTENT.ASK_PAYMENT,
    [QUICK_REPLY_TEXT.HOW_TO_GET_THERE]: QUICK_REPLY_INTENT.ASK_LOCATION,
    [QUICK_REPLY_TEXT.CONSTRUCTION_STAGES]: QUICK_REPLY_INTENT.ASK_CONSTRUCTION,
    [QUICK_REPLY_TEXT.NEARBY_INFRASTRUCTURE]:
        QUICK_REPLY_INTENT.ASK_INFRASTRUCTURE,
    [QUICK_REPLY_TEXT.SHOW_LAYOUTS]: QUICK_REPLY_INTENT.ASK_FEATURES,
    [QUICK_REPLY_TEXT.FIND_SIMILAR_OPTIONS]: QUICK_REPLY_INTENT.EXPLORE_SIMILAR,
    [QUICK_REPLY_TEXT.SHOW_COTTAGES]: QUICK_REPLY_INTENT.CONTINUE_SEARCH,
};

export function normalizeQuickReplyInput(
    content: string,
    locale?: string,
): QuickReplyNormalizationResult {
    const trimmed = content.trim();
    if (!trimmed) {
        return { content };
    }

    const resolvedLocale = resolveLocale(locale);
    const matchedKey = resolveQuickReplyKey(trimmed, resolvedLocale);
    if (!matchedKey) {
        return { content };
    }

    const prompt =
        getTranslatedValue(
            `content.ai.quickReplyPrompts.${matchedKey}`,
            resolvedLocale,
        ) ??
        getTranslatedValue(
            `content.ai.quickReplies.${matchedKey}`,
            resolvedLocale,
        ) ??
        trimmed;

    return {
        content: prompt,
        intent: QUICK_REPLY_INTENT_BY_KEY[matchedKey],
    };
}

function resolveQuickReplyKey(
    value: string,
    locale: SupportedLocale,
): QuickReplyTextKey | undefined {
    if (QUICK_REPLY_KEY_SET.has(value)) {
        return value as QuickReplyTextKey;
    }

    const normalizedValue = value.trim().toLowerCase();
    const locales: SupportedLocale[] =
        locale === 'en' ? ['en', 'ru'] : ['ru', 'en'];

    for (const targetLocale of locales) {
        for (const key of QUICK_REPLY_KEY_SET) {
            const translated = getTranslatedValue(
                `content.ai.quickReplies.${key}`,
                targetLocale,
            );
            if (translated?.trim().toLowerCase() === normalizedValue) {
                return key as QuickReplyTextKey;
            }
        }
    }

    return undefined;
}

function getTranslatedValue(
    path: string,
    locale: SupportedLocale,
): string | undefined {
    const translated = t(path, undefined, locale);
    return translated === path ? undefined : translated;
}
