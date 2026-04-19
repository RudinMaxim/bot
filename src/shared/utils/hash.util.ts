import { createHash } from 'crypto';

/**
 * Генерирует короткий MD5 хеш из строки.
 * @param {string} string - Исходная строка.
 * @returns {string} Короткий хеш.
 */
export function hashed(string: string): string {
    return createHash('md5').update(string).digest('hex');
}

/**
 * Проверяет, соответствует ли короткий хеш переданной строке.
 * @param {string} plainString - Исходная строка.
 * @param {string} hashedString - Ожидаемый короткий хеш.
 * @returns {boolean} true, если хеш совпадает, иначе false.
 */
export function verifyHash(plainString: string, hashedString: string): boolean {
    return hashed(plainString) === hashedString;
}
