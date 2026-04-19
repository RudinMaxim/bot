export function normalizeResponseMarkdown(text: string): string {
    const normalized = String(text ?? '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<[^>]+>/g, '')
        .trim();

    if (!normalized) {
        return normalized;
    }

    const withoutTables = stripMarkdownTables(normalized);
    const normalizedHeadings = normalizeHeadings(withoutTables);
    const normalizedLists = normalizeSimpleLists(normalizedHeadings);
    const collapsedNewlines = normalizedLists
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    if (!collapsedNewlines.includes('\n') && collapsedNewlines.length > 240) {
        return paragraphizePlainText(collapsedNewlines);
    }

    return collapsedNewlines;
}

function stripMarkdownTables(text: string): string {
    const lines = text.split('\n');
    const result: string[] = [];

    for (let index = 0; index < lines.length; index += 1) {
        const current = lines[index]?.trim() ?? '';
        const next = lines[index + 1]?.trim() ?? '';

        if (isTableHeader(current) && isTableDivider(next)) {
            index += 1;
            while (index + 1 < lines.length && isTableRow(lines[index + 1])) {
                index += 1;
            }
            continue;
        }

        result.push(lines[index]);
    }

    return result.join('\n');
}

function isTableHeader(line: string): boolean {
    return isTableRow(line) && /\|/.test(line);
}

function isTableDivider(line: string): boolean {
    return /^[\s|:-]+$/.test(line) && /-/.test(line);
}

function isTableRow(line: string): boolean {
    return /^\s*\|?.+\|.+\|?\s*$/.test(line);
}

function normalizeHeadings(text: string): string {
    return text.replace(/^\s{0,3}#{1,6}\s+(.+)$/gm, (_, heading: string) => {
        const value = heading.trim();
        return value ? `**${value}**` : '';
    });
}

function normalizeSimpleLists(text: string): string {
    return text
        .replace(/^\s*[*•]\s+/gm, '- ')
        .replace(/^\s{2,}[-*]\s+/gm, '- ');
}

function paragraphizePlainText(text: string): string {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length <= 240) return normalized;

    const sentences = normalized
        .split(/(?<=[.!?…])\s+(?=[0-9A-Za-zА-ЯЁ])/u)
        .map((sentence) => sentence.trim())
        .filter(Boolean);

    if (sentences.length <= 1) return normalized;

    const paragraphs: string[] = [];
    const sentencesPerParagraph = 2;

    for (
        let index = 0;
        index < sentences.length;
        index += sentencesPerParagraph
    ) {
        paragraphs.push(
            sentences.slice(index, index + sentencesPerParagraph).join(' '),
        );
    }

    return paragraphs.join('\n\n');
}
