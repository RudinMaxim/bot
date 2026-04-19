import { Injectable, Logger } from '@nestjs/common';
import type {
    TextProcessingConfig,
    ProcessedTextResult,
} from '../common/types/embedding.types';
import { SecretsConfig } from 'src/infrastructure/config';

class TextProcessor {
    private stats: {
        originalLength: number;
        processedLength: number;
        sectionsFound: number;
        sectionSeparator: string | null;
        stepsApplied: string[];
        wordsRemoved: number;
        wordsPreserved: number;
    } = {
        originalLength: 0,
        processedLength: 0,
        sectionsFound: 0,
        sectionSeparator: null,
        stepsApplied: [],
        wordsRemoved: 0,
        wordsPreserved: 0,
    };

    constructor(
        private config: TextProcessingConfig,
        private stopWordsRu: Set<string>,
        private stopWordsEn: Set<string>,
        private sectionSeparators: string[],
    ) {}

    process(inputText: string): ProcessedTextResult[] {
        try {
            this.initStats(inputText);

            let text = this.gentleClean(inputText);
            if (!text) return [];

            text = this.removeObviousEmojis(text);
            text = this.ultraSoftStopWordRemoval(text);

            const sections = this.intelligentSectionSplit(text);
            const validSections = sections
                .map((section) => this.validateSection(section))
                .filter((section): section is string => section !== null);

            this.stats.processedLength = validSections.reduce(
                (sum, section) => sum + section.length,
                0,
            );

            return validSections.map((section, index) =>
                this.createResult(section, index, validSections.length),
            );
        } catch (error) {
            console.error('Processing error:', error);
            return [];
        }
    }

    private initStats(inputText: string): void {
        this.stats = {
            originalLength: inputText.length,
            processedLength: 0,
            sectionsFound: 0,
            sectionSeparator: null,
            stepsApplied: [],
            wordsRemoved: 0,
            wordsPreserved: 0,
        };
    }

    private gentleClean(text: string): string {
        if (!text || typeof text !== 'string') return '';

        let cleaned = text;

        if (this.config.normalizeWhitespace) {
            cleaned = cleaned.replace(/[ \t]+/g, ' ');
            cleaned = cleaned.replace(/\n\s*\n\s*\n+/g, '\n\n');
        }

        if (this.config.removeUrls) {
            cleaned = cleaned.replace(/https?:\/\/[^\s]+/gi, ' ');
            cleaned = cleaned.replace(/www\.[^\s]+/gi, ' ');
        }

        if (this.config.removeEmails) {
            cleaned = cleaned.replace(
                /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
                ' ',
            );
        }

        if (this.config.cleanExcessivePunctuation) {
            cleaned = cleaned.replace(/\.{4,}/g, '...');
            cleaned = cleaned.replace(/!{3,}/g, '!!');
            cleaned = cleaned.replace(/\?{3,}/g, '??');
            cleaned = cleaned.replace(/,{2,}/g, ',');
        }

        if (this.config.removeControlChars) {
            cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // eslint-disable-line no-control-regex
        }

        this.stats.stepsApplied.push('Gentle cleaning');
        return cleaned.trim();
    }

    private removeObviousEmojis(text: string): string {
        if (!this.config.removeEmojis) return text;

        let cleaned = text;

        cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}]/gu, ' ');
        cleaned = cleaned.replace(/[\u{1F300}-\u{1F5FF}]/gu, ' ');
        cleaned = cleaned.replace(/[\u{1F680}-\u{1F6FF}]/gu, ' ');
        cleaned = cleaned.replace(/[\u{1F1E0}-\u{1F1FF}]/gu, ' ');

        cleaned = cleaned.replace(/:\)|:\(|:D|:P|;\)|:-\)|:-\(/g, ' ');

        this.stats.stepsApplied.push('Emoji removal');
        return cleaned;
    }

    private ultraSoftStopWordRemoval(text: string): string {
        if (!this.config.removeOnlyMostFrequent) return text;

        const sentences = text.split(/[.!?]+/).filter((s) => s.trim());

        const processed = sentences.map((sentence) => {
            const words = sentence.trim().split(/\s+/);

            if (words.length <= 4) return sentence.trim();

            let removedInSentence = 0;
            const maxRemovalPerSentence = Math.floor(words.length * 0.3);

            const filtered = words.filter((word) => {
                if (!word || word.length < 1) return false;

                const cleanWord = word
                    .toLowerCase()
                    .replace(/[^\w\u0400-\u04FF]/g, '');

                if (
                    (this.stopWordsRu.has(cleanWord) ||
                        this.stopWordsEn.has(cleanWord)) &&
                    removedInSentence < maxRemovalPerSentence
                ) {
                    removedInSentence++;
                    this.stats.wordsRemoved++;
                    return false;
                }

                this.stats.wordsPreserved++;
                return true;
            });

            return filtered.join(' ');
        });

        this.stats.stepsApplied.push(`Ultra-soft stop words`);
        return processed.filter((s) => s.trim()).join('. ');
    }

    private intelligentSectionSplit(text: string): string[] {
        if (!this.config.autoDetectSections) return [text];

        const separator = this.detectSectionSeparator(text);
        let sections: string[] = [];

        if (separator && separator !== 'natural') {
            sections = text
                .split(separator)
                .map((section) => section.trim())
                .filter(
                    (section) => section.length >= this.config.minSectionLength,
                );
        } else if (separator === 'natural') {
            sections = text
                .split(/\n\s*\n/)
                .map((section) => section.trim())
                .filter(
                    (section) => section.length >= this.config.minSectionLength,
                );
        } else {
            if (text.length > 2000) {
                const paragraphs = text.split(/\n\s*\n/);
                if (paragraphs.length > 1) {
                    sections = paragraphs
                        .map((p) => p.trim())
                        .filter(
                            (p) => p.length >= this.config.minSectionLength,
                        );
                } else {
                    sections = [text];
                }
            } else {
                sections = [text];
            }
        }

        this.stats.sectionsFound = sections.length;
        this.stats.stepsApplied.push(
            `Section detection (${sections.length} sections)`,
        );

        return sections.length > 0 ? sections : [text];
    }

    private detectSectionSeparator(text: string): string | null {
        for (const separator of this.sectionSeparators) {
            if (text.includes(separator)) {
                this.stats.sectionSeparator = separator;
                return separator;
            }
        }

        const naturalSeparators = [
            /\n\s*\n\s*[А-ЯA-Z][^.!?]*[:.]\s*\n/g,
            /\n\s*\d+\.\s+/g,
            /\n\s*[А-ЯA-Z]{2,}\s*\n/g,
        ];

        for (const pattern of naturalSeparators) {
            if (pattern.test(text)) {
                this.stats.sectionSeparator = 'natural';
                return 'natural';
            }
        }

        return null;
    }

    private validateSection(text: string): string | null {
        if (!text || typeof text !== 'string') return null;

        const trimmed = text.trim();

        if (trimmed.length < this.config.minTextLength) {
            return null;
        }

        if (trimmed.length > this.config.maxTextLength) {
            const truncated = trimmed.substring(0, this.config.maxTextLength);
            const lastSentenceEnd = Math.max(
                truncated.lastIndexOf('.'),
                truncated.lastIndexOf('!'),
                truncated.lastIndexOf('?'),
            );

            if (lastSentenceEnd > this.config.maxTextLength * 0.8) {
                return truncated.substring(0, lastSentenceEnd + 1).trim();
            }
            return truncated.trim();
        }

        return trimmed;
    }

    private createResult(
        section: string,
        index: number,
        totalSections: number,
    ): ProcessedTextResult {
        return {
            text: section,
            sectionIndex: index,
            totalSections: totalSections,
            length: section.length,
            hasMultipleSections: totalSections > 1,
            sectionSeparator: this.stats.sectionSeparator,
            processing: {
                compressionRatio: +(
                    section.length / this.stats.originalLength
                ).toFixed(3),
                stepsApplied: this.stats.stepsApplied.length,
                wordsPreserved: this.stats.wordsPreserved,
                wordsRemoved: this.stats.wordsRemoved,
                success: true,
            },
        };
    }
}

@Injectable()
export class TextProcessorService {
    private readonly logger = new Logger(TextProcessorService.name);
    private readonly config: TextProcessingConfig;

    private readonly ULTRA_BASIC_STOP_WORDS_RU = new Set([
        'и',
        'а',
        'но',
        'или',
        'да',
        'не',
        'ни',
        'же',
        'ли',
        'бы',
    ]);

    private readonly ULTRA_BASIC_STOP_WORDS_EN = new Set([
        'a',
        'an',
        'and',
        'or',
        'but',
    ]);

    private readonly SECTION_SEPARATORS = ['---', '===', '***', '___'];

    constructor(private readonly secretsConfig: SecretsConfig) {
        this.config = this.loadConfiguration();
    }

    private loadConfiguration(): TextProcessingConfig {
        const {
            textProcessingNormalizeWhitespace,
            textProcessingRemoveUrls,
            textProcessingRemoveEmails,
            textProcessingCleanPunctuation,
            textProcessingRemoveEmojis,
            textProcessingRemoveControlChars,
            textProcessingRemoveStopWords,
            textProcessingMinLength,
            textProcessingMaxLength,
            textProcessingAutoDetectSections,
            textProcessingMinSectionLength,
        } = this.secretsConfig.embedding;

        return {
            normalizeWhitespace: textProcessingNormalizeWhitespace,
            removeUrls: textProcessingRemoveUrls,
            removeEmails: textProcessingRemoveEmails,
            cleanExcessivePunctuation: textProcessingCleanPunctuation,
            removeEmojis: textProcessingRemoveEmojis,
            removeControlChars: textProcessingRemoveControlChars,
            removeOnlyMostFrequent: textProcessingRemoveStopWords,
            minTextLength: textProcessingMinLength,
            maxTextLength: textProcessingMaxLength,
            autoDetectSections: textProcessingAutoDetectSections,
            minSectionLength: textProcessingMinSectionLength,
        };
    }

    processText(inputText: string): ProcessedTextResult[] {
        if (!inputText?.trim()) {
            throw new Error('Text cannot be empty');
        }

        this.logger.debug(`Processing text of length: ${inputText.length}`);

        const processor = new TextProcessor(
            this.config,
            this.ULTRA_BASIC_STOP_WORDS_RU,
            this.ULTRA_BASIC_STOP_WORDS_EN,
            this.SECTION_SEPARATORS,
        );

        const results = processor.process(inputText);

        this.logger.log(`Processed text into ${results.length} sections`);

        return results;
    }
}
