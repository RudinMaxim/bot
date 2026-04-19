import 'reflect-metadata';
import { readFileSync } from 'fs';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { SearchAgentService } from '../src/domain/ai/agents/search/search.agent';
import { AGENT_NAME } from '../src/domain/ai/common/constants';

type Expectation =
    | { kind: 'must_hit'; ids: string[] } // expect one of these in top-1
    | { kind: 'may_hit'; ids: string[] } // allow top-3 placement
    | { kind: 'must_not'; ids: string[] } // these ids MUST NOT appear in top-3
    | { kind: 'unsupported' }; // no card in corpus for this — top-1 similarity should be low

interface RegressionCase {
    group: string;
    query: string;
    expect: Expectation;
    comment?: string;
}

// Minimum similarity at which we consider top-1 "confident". Anything below is
// treated as weak retrieval (OK for unsupported cases, a signal for must_hit).
const CONFIDENT_SIMILARITY = 0.55;

const CASES: RegressionCase[] = [
    // -------- A. Verbatim-like queries (baseline sanity, should be easy) --------
    { group: 'A-baseline', query: 'Есть ли паркинг в ЖК Мыс?', expect: { kind: 'must_hit', ids: ['parking-availability'] } },
    { group: 'A-baseline', query: 'Какие форматы жилья есть?', expect: { kind: 'must_hit', ids: ['housing-formats'] } },
    { group: 'A-baseline', query: 'Когда срок сдачи?', expect: { kind: 'must_hit', ids: ['handover-timing'] } },
    { group: 'A-baseline', query: 'Какое ближайшее метро?', expect: { kind: 'must_hit', ids: ['nearest-metro'] } },
    { group: 'A-baseline', query: 'Кто застройщик?', expect: { kind: 'must_hit', ids: ['developer-overview', 'developer-scale', 'developer-details'] } },

    // -------- B. Conversational / colloquial rephrasing --------
    { group: 'B-colloquial', query: 'Машину где оставлять?', expect: { kind: 'must_hit', ids: ['parking-availability'] }, comment: 'разговорный парафраз темы паркинга' },
    { group: 'B-colloquial', query: 'А ключи когда отдадут?', expect: { kind: 'must_hit', ids: ['handover-timing'] } },
    { group: 'B-colloquial', query: 'Куда едем до метро?', expect: { kind: 'must_hit', ids: ['nearest-metro'] }, comment: 'неуклюжий парафраз' },
    { group: 'B-colloquial', query: 'Можно в ипотеку взять?', expect: { kind: 'must_hit', ids: ['mortgage-programs'] } },
    { group: 'B-colloquial', query: 'С материнским капиталом получится?', expect: { kind: 'must_hit', ids: ['maternity-capital'] } },
    { group: 'B-colloquial', query: 'Частями платить можно?', expect: { kind: 'must_hit', ids: ['installment-plan'] }, comment: 'рассрочка, но слово "рассрочка" не используется' },
    { group: 'B-colloquial', query: 'Свою квартиру в зачёт возьмут?', expect: { kind: 'must_hit', ids: ['trade-in-program', 'trade-in-details'] } },
    { group: 'B-colloquial', query: 'Комплекс — для кого вообще? премиум, бизнес?', expect: { kind: 'must_hit', ids: ['housing-class', 'project-premium-class'] } },

    // -------- C. Typos / punctuation noise --------
    { group: 'C-typos', query: 'паркин есть?', expect: { kind: 'must_hit', ids: ['parking-availability'] } },
    { group: 'C-typos', query: 'Когда сдача жк мыс??', expect: { kind: 'must_hit', ids: ['handover-timing'] } },
    { group: 'C-typos', query: 'метро рядом с мысом какое', expect: { kind: 'must_hit', ids: ['nearest-metro'] } },
    { group: 'C-typos', query: 'застройщек кто', expect: { kind: 'must_hit', ids: ['developer-overview', 'developer-scale', 'developer-details'] } },

    // -------- D. Adjacent-topic boundary (easy to confuse) --------
    { group: 'D-boundary', query: 'Что для ребенка на территории сделано?', expect: { kind: 'must_hit', ids: ['children-lifestyle', 'quarter-sports-playgrounds', 'quarter-amenities-detailed'] } },
    { group: 'D-boundary', query: 'Где дети могут побегать прямо во дворе?', expect: { kind: 'must_hit', ids: ['quarter-sports-playgrounds', 'children-lifestyle', 'quarter-amenities-detailed'] } },
    { group: 'D-boundary', query: 'Что есть из спорта, кроме площадок?', expect: { kind: 'may_hit', ids: ['sports-palace', 'sports-palace-details'] }, comment: 'просим именно спортивный объект, не детские площадки' },
    { group: 'D-boundary', query: 'Прогуляться в парке или у воды можно?', expect: { kind: 'must_hit', ids: ['quarter-greenery'] } },
    { group: 'D-boundary', query: 'Какие магазины на территории самого ЖК?', expect: { kind: 'must_hit', ids: ['quarter-services'] }, comment: 'внутри территории vs рядом' },
    { group: 'D-boundary', query: 'Что с магазинами рядом, вне ЖК?', expect: { kind: 'must_hit', ids: ['nearby-retail-and-cafes'] } },
    { group: 'D-boundary', query: 'Сколько корпусов всего в проекте?', expect: { kind: 'must_hit', ids: ['building-counts'] } },
    { group: 'D-boundary', query: 'Расскажи про урбан-блоки, чем они отличаются?', expect: { kind: 'must_hit', ids: ['urban-blocks'] } },
    { group: 'D-boundary', query: 'Коттеджи — это отдельные дома или секции?', expect: { kind: 'must_hit', ids: ['cottages', 'cottages-types'] } },

    // -------- E. Mixed-topic queries (user asks two things at once) --------
    { group: 'E-mixed', query: 'Паркинг и кладовые — всё сразу в комплекте?', expect: { kind: 'may_hit', ids: ['parking-availability'] }, comment: 'про кладовые в corpus нет — но паркинг не должен промахнуться' },
    { group: 'E-mixed', query: 'Ипотека с использованием маткапитала работает?', expect: { kind: 'may_hit', ids: ['mortgage-programs', 'maternity-capital'] } },
    { group: 'E-mixed', query: 'Когда сдают и какой договор?', expect: { kind: 'may_hit', ids: ['handover-timing', 'contract-type'] } },

    // -------- F. Unsupported / out-of-scope (must NOT pretend to answer) --------
    { group: 'F-unsupported', query: 'Когда будет ближайший день открытых дверей?', expect: { kind: 'unsupported' } },
    { group: 'F-unsupported', query: 'Есть ли у меня бронь на квартиру номер 15?', expect: { kind: 'unsupported' } },
    { group: 'F-unsupported', query: 'Какая погода сегодня в районе ЖК?', expect: { kind: 'unsupported' } },
    { group: 'F-unsupported', query: 'Можно ли заселить кошку?', expect: { kind: 'unsupported' }, comment: 'pet-policy нет в corpus' },
    { group: 'F-unsupported', query: 'Как добраться общественным транспортом из Тулы?', expect: { kind: 'unsupported' } },
    { group: 'F-unsupported', query: 'Какая управляющая компания будет?', expect: { kind: 'unsupported' } },

    // -------- G. Negative / traps (word matches but wrong topic) --------
    { group: 'G-trap', query: 'А шумоизоляция на окнах какая?', expect: { kind: 'unsupported' }, comment: 'тема не в corpus, не должен притянуть concept/overview' },
    { group: 'G-trap', query: 'Есть ли школа прямо на территории?', expect: { kind: 'may_hit', ids: ['nearby-social-infrastructure', 'social-infrastructure-details'] }, comment: 'школа есть — допустим either social card' },

    // -------- H. New cards — prices, discounts, building details --------
    { group: 'H-prices', query: 'Сколько стоит квартира в урбан-блоке?', expect: { kind: 'must_hit', ids: ['urban-blocks-price-range'] } },
    { group: 'H-prices', query: 'Какая цена коттеджа?', expect: { kind: 'must_hit', ids: ['cottages-price-range'] } },
    { group: 'H-prices', query: 'Скидки на Волгу и Сибирь?', expect: { kind: 'must_hit', ids: ['promotions', 'promotions-details'] } },
    { group: 'H-prices', query: 'Есть ли акции на коттеджи?', expect: { kind: 'must_hit', ids: ['promotions', 'promotions-details'] } },

    // -------- I. New cards — building details --------
    { group: 'I-buildings', query: 'Из чего построены урбан-блоки?', expect: { kind: 'must_hit', ids: ['urban-blocks-building-details', 'urban-blocks'] } },
    { group: 'I-buildings', query: 'Сколько лифтов в подъезде?', expect: { kind: 'must_hit', ids: ['urban-blocks-building-details', 'urban-blocks'] } },
    { group: 'I-buildings', query: 'Есть ли камины в клубных домах?', expect: { kind: 'must_hit', ids: ['club-houses-features', 'club-houses'] } },
    { group: 'I-buildings', query: 'Какие планировки в клубных домах?', expect: { kind: 'must_hit', ids: ['club-houses-floor-plans', 'club-houses'] } },
    { group: 'I-buildings', query: 'Сколько комнат в клубном доме?', expect: { kind: 'must_hit', ids: ['club-houses-floor-plans', 'club-houses'] } },
    { group: 'I-buildings', query: 'Какие типы коттеджей по площади?', expect: { kind: 'must_hit', ids: ['cottages-types', 'cottages'] } },
    { group: 'I-buildings', query: 'Гараж на сколько машин в коттедже?', expect: { kind: 'must_hit', ids: ['cottages-types', 'cottages'] } },
    { group: 'I-buildings', query: 'Какие планировки таунхаусов?', expect: { kind: 'must_hit', ids: ['townhouses-plan-types', 'townhouses'] } },

    // -------- J. New cards — sports & amenities detail --------
    { group: 'J-amenities', query: 'Сколько бассейнов во дворце спорта?', expect: { kind: 'must_hit', ids: ['sports-palace-details', 'sports-palace'] } },
    { group: 'J-amenities', query: 'Есть ли падел-корты?', expect: { kind: 'must_hit', ids: ['sports-palace-details', 'sports-palace'] } },
    { group: 'J-amenities', query: 'Какая площадь фитнес-зала?', expect: { kind: 'must_hit', ids: ['sports-palace-details', 'sports-palace'] } },
    { group: 'J-amenities', query: 'Сколько детских площадок?', expect: { kind: 'must_hit', ids: ['quarter-amenities-detailed', 'quarter-sports-playgrounds'] } },
    { group: 'J-amenities', query: 'Есть ли площадка для собак?', expect: { kind: 'must_hit', ids: ['quarter-amenities-detailed', 'quarter-community-spaces'] } },
    { group: 'J-amenities', query: 'Длина велодорожек на территории?', expect: { kind: 'must_hit', ids: ['quarter-amenities-detailed', 'quarter-routes'] } },
    { group: 'J-amenities', query: 'Есть ли детский сад и школа?', expect: { kind: 'must_hit', ids: ['social-infrastructure-details', 'nearby-social-infrastructure'] } },

    // -------- K. New cards — mortgage detail --------
    { group: 'K-mortgage', query: 'Какой лимит семейной ипотеки?', expect: { kind: 'must_hit', ids: ['mortgage-family-details'] } },
    { group: 'K-mortgage', query: 'Условия IT ипотеки?', expect: { kind: 'must_hit', ids: ['mortgage-it-details'] } },
    { group: 'K-mortgage', query: 'Ставка обычной ипотеки без льгот?', expect: { kind: 'must_hit', ids: ['mortgage-standard-details'] } },
    { group: 'K-mortgage', query: 'Есть ли военная ипотека?', expect: { kind: 'must_hit', ids: ['mortgage-military-planned'] } },
    { group: 'K-mortgage', query: 'Какие документы нужны для ипотеки?', expect: { kind: 'must_hit', ids: ['faq-mortgage-docs', 'faq-mortgage-application'] } },
    { group: 'K-mortgage', query: 'Иностранец может оформить ипотеку?', expect: { kind: 'must_hit', ids: ['faq-mortgage-application'] } },
    { group: 'K-mortgage', query: 'Сколько рассматривают ипотечную заявку?', expect: { kind: 'must_hit', ids: ['faq-mortgage-timeline'] } },
    { group: 'K-mortgage', query: 'Можно ли досрочно погасить ипотеку?', expect: { kind: 'must_hit', ids: ['faq-mortgage-timeline'] } },

    // -------- L. New cards — trade-in detail --------
    { group: 'L-tradein', query: 'На сколько дней фиксируется цена по trade-in?', expect: { kind: 'must_hit', ids: ['trade-in-details', 'trade-in-program'] } },
    { group: 'L-tradein', query: 'Примут ли коттедж по trade-in?', expect: { kind: 'must_hit', ids: ['trade-in-exclusions'] } },
    { group: 'L-tradein', query: 'Какие ограничения в программе trade-in?', expect: { kind: 'must_hit', ids: ['trade-in-exclusions', 'trade-in-details'] } },

    // -------- M. New cards — developer detail --------
    { group: 'M-developer', query: 'Когда основана MR Group?', expect: { kind: 'must_hit', ids: ['developer-details', 'developer-overview'] } },
    { group: 'M-developer', query: 'С какими культурными институциями сотрудничает MR Group?', expect: { kind: 'must_hit', ids: ['developer-cultural-partners'] } },
    { group: 'M-developer', query: 'Сколько домов построила MR Group?', expect: { kind: 'must_hit', ids: ['developer-details', 'developer-scale'] } },

    // -------- N. New cards — FAQ process --------
    { group: 'N-faq', query: 'Сроки регистрации ДДУ в Росреестре?', expect: { kind: 'must_hit', ids: ['faq-rosreestr-timing'] } },
    { group: 'N-faq', query: 'Как получить ЭЦП для подписания договора?', expect: { kind: 'must_hit', ids: ['faq-electronic-signature'] } },
    { group: 'N-faq', query: 'Нужно ли уведомлять застройщика о переуступке?', expect: { kind: 'must_hit', ids: ['faq-assignment'] } },
    { group: 'N-faq', query: 'Обязательно ли страхование при ипотеке?', expect: { kind: 'must_hit', ids: ['faq-insurance'] } },
    { group: 'N-faq', query: 'Как происходит приёмка квартиры?', expect: { kind: 'must_hit', ids: ['faq-handover-procedure', 'faq-handover-documents'] } },
    { group: 'N-faq', query: 'Где находится офис заселения MR Group?', expect: { kind: 'must_hit', ids: ['faq-handover-office'] } },
    { group: 'N-faq', query: 'Что делать если площадь изменилась по обмерам БТИ?', expect: { kind: 'must_hit', ids: ['faq-bti-area-changes'] } },
    { group: 'N-faq', query: 'Как согласовать перепланировку?', expect: { kind: 'must_hit', ids: ['faq-renovation-permits'] } },
    { group: 'N-faq', query: 'С какого момента начисляется коммуналка?', expect: { kind: 'must_hit', ids: ['faq-utilities-billing'] } },
    { group: 'N-faq', query: 'Контакты пресс-службы MR Group?', expect: { kind: 'must_hit', ids: ['faq-contacts'] } },
    { group: 'N-faq', query: 'Как зарегистрировать право собственности?', expect: { kind: 'must_hit', ids: ['faq-ownership-registration'] } },
    { group: 'N-faq', query: 'Платная ли регистрация ДДУ?', expect: { kind: 'must_hit', ids: ['faq-registration-ddu-free'] } },
    { group: 'N-faq', query: 'Как изменить контактные данные в договоре?', expect: { kind: 'must_hit', ids: ['faq-client-data-change'] } },
    { group: 'N-faq', query: 'Что взять с собой на приёмку квартиры?', expect: { kind: 'must_hit', ids: ['faq-handover-documents'] } },
    { group: 'N-faq', query: 'Не могу лично приехать на осмотр, можно по доверенности?', expect: { kind: 'must_hit', ids: ['faq-power-of-attorney-handover'] } },
    { group: 'N-faq', query: 'Какой интернет-провайдер будет в комплексе?', expect: { kind: 'must_hit', ids: ['faq-internet-provider'] } },

    // -------- O. Drive times & location detail --------
    { group: 'O-location', query: 'Сколько ехать до госпиталя Лапино?', expect: { kind: 'must_hit', ids: ['drive-times'] } },
    { group: 'O-location', query: 'Далеко ли до Москва-Сити?', expect: { kind: 'must_hit', ids: ['drive-times'] } },
    { group: 'O-location', query: 'Какой класс жилья — премиум или бизнес?', expect: { kind: 'must_hit', ids: ['housing-class', 'project-premium-class'] } },
];

interface CorpusItem { id: string; title: string; }

function loadCorpusTitleIndex(): Map<string, string> {
    const path = join(__dirname, '..', 'resources', 'knowledge-base', 'search-base', 'mys', 'ru.json');
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as { items: CorpusItem[] };
    const idx = new Map<string, string>();
    for (const item of parsed.items) idx.set(item.title.trim().toLowerCase(), item.id);
    return idx;
}

function extractTitle(content?: string): string | null {
    if (!content) return null;
    const m = content.match(/(^|\n)\s*title:\s*([^\n]+)/i);
    return m?.[2]?.trim() ?? null;
}

function resolveDocId(content: string | undefined, idx: Map<string, string>): string {
    const title = extractTitle(content);
    if (!title) return '(no-title)';
    return idx.get(title.toLowerCase()) ?? `?${title.slice(0, 40)}`;
}

function fmtSim(n: number | undefined): string {
    return typeof n === 'number' ? n.toFixed(3) : '-';
}

interface CaseOutcome {
    testCase: RegressionCase;
    topIds: string[];
    sims: number[];
    status: 'pass' | 'warn' | 'fail';
    note: string;
}

function evaluate(
    testCase: RegressionCase,
    topIds: string[],
    sims: number[],
): CaseOutcome {
    const expect = testCase.expect;
    const top1 = topIds[0];
    const top1Sim = sims[0] ?? 0;

    if (expect.kind === 'must_hit') {
        const inTop1 = !!top1 && expect.ids.includes(top1);
        const inTop3 = topIds.some((id) => expect.ids.includes(id));
        if (inTop1) return { testCase, topIds, sims, status: 'pass', note: 'top-1' };
        if (inTop3) return { testCase, topIds, sims, status: 'warn', note: `top-${topIds.findIndex((id) => expect.ids.includes(id)) + 1}` };
        return { testCase, topIds, sims, status: 'fail', note: `expected ${expect.ids.join('|')} not in top-3` };
    }

    if (expect.kind === 'may_hit') {
        const inTop3 = topIds.some((id) => expect.ids.includes(id));
        return inTop3
            ? { testCase, topIds, sims, status: 'pass', note: `top-${topIds.findIndex((id) => expect.ids.includes(id)) + 1}` }
            : { testCase, topIds, sims, status: 'warn', note: `${expect.ids.join('|')} missing in top-3` };
    }

    if (expect.kind === 'must_not') {
        const hit = topIds.find((id) => expect.ids.includes(id));
        return hit
            ? { testCase, topIds, sims, status: 'fail', note: `forbidden id ${hit} in top-3` }
            : { testCase, topIds, sims, status: 'pass', note: 'none of forbidden' };
    }

    // unsupported: we want top-1 similarity to be low or at least not a clean
    // confident match. Threshold is a heuristic for signal, not a gate.
    if (top1Sim >= CONFIDENT_SIMILARITY) {
        return {
            testCase,
            topIds,
            sims,
            status: 'warn',
            note: `confident top-1 ${top1}@${fmtSim(top1Sim)} — may hallucinate`,
        };
    }
    return { testCase, topIds, sims, status: 'pass', note: `low-confidence top-1 ${fmtSim(top1Sim)}` };
}

async function bootstrap(): Promise<void> {
    const titleIndex = loadCorpusTitleIndex();
    const app = await NestFactory.createApplicationContext(AppModule, {
        logger: ['error', 'warn'],
    });

    try {
        const agent = app.get(SearchAgentService);
        const outcomes: CaseOutcome[] = [];

        for (let i = 0; i < CASES.length; i++) {
            const testCase = CASES[i];
            const result = await agent.process({
                sessionId: `regression-${i}`,
                timestamp: new Date().toISOString(),
                agents: [
                    {
                        agent_name: AGENT_NAME.SEARCH,
                        priority: 'high',
                        tasks: [{ instruction: testCase.query }],
                    },
                ],
            } as never);

            const docs = result.searchResults?.[0]?.results ?? [];
            const topIds = docs.slice(0, 3).map((d) => resolveDocId(d.content, titleIndex));
            const sims = docs.slice(0, 3).map((d) => d._additional?.certainty ?? 0);
            outcomes.push(evaluate(testCase, topIds, sims));
        }

        // --- print grouped table ---
        const groups = [...new Set(outcomes.map((o) => o.testCase.group))];
        process.stdout.write('\n# Regression report (mys, extended)\n\n');

        for (const group of groups) {
            const bucket = outcomes.filter((o) => o.testCase.group === group);
            process.stdout.write(`\n## ${group}\n\n`);
            process.stdout.write('| Query | Expect | Top-1 (sim) | Top-3 | Status |\n');
            process.stdout.write('|---|---|---|---|---|\n');
            for (const o of bucket) {
                const exp =
                    o.testCase.expect.kind === 'unsupported'
                        ? 'UNSUPPORTED'
                        : `${o.testCase.expect.kind.toUpperCase()}: ${('ids' in o.testCase.expect ? o.testCase.expect.ids : []).join('|')}`;
                const icon = o.status === 'pass' ? '✅' : o.status === 'warn' ? '⚠' : '❌';
                const top1 = `${o.topIds[0] ?? '-'} (${fmtSim(o.sims[0])})`;
                process.stdout.write(
                    `| ${o.testCase.query} | ${exp} | ${top1} | ${o.topIds.join(', ')} | ${icon} ${o.note} |\n`,
                );
            }
        }

        const pass = outcomes.filter((o) => o.status === 'pass').length;
        const warn = outcomes.filter((o) => o.status === 'warn').length;
        const fail = outcomes.filter((o) => o.status === 'fail').length;
        process.stdout.write(
            `\n# Summary: pass=${pass}, warn=${warn}, fail=${fail}, total=${outcomes.length}\n`,
        );
        if (fail + warn > 0) {
            process.stdout.write('\n## Problems\n');
            for (const o of outcomes.filter((x) => x.status !== 'pass')) {
                process.stdout.write(
                    `- [${o.status}] (${o.testCase.group}) "${o.testCase.query}" → ${o.note} | top=[${o.topIds.join(', ')}]\n`,
                );
            }
        }
    } finally {
        await app.close();
    }
}

bootstrap().catch((error) => {
    process.stderr.write(
        `regression failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
    );
    process.exit(1);
});
