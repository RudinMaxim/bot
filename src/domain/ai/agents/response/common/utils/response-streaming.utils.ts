export interface StreamedResponseExtraction {
    readonly text: string;
    readonly complete: boolean;
}

const RESPONSE_KEY_PATTERN = /"response"\s*:\s*"/u;

export function extractStreamedResponseText(
    rawJson: string,
): StreamedResponseExtraction {
    if (!rawJson) {
        return {
            text: '',
            complete: false,
        };
    }

    const match = RESPONSE_KEY_PATTERN.exec(rawJson);
    if (!match) {
        return {
            text: '',
            complete: false,
        };
    }

    let text = '';
    let index = match.index + match[0].length;

    while (index < rawJson.length) {
        const char = rawJson[index];

        if (char === '"') {
            return {
                text,
                complete: true,
            };
        }

        if (char !== '\\') {
            text += char;
            index += 1;
            continue;
        }

        if (index + 1 >= rawJson.length) {
            break;
        }

        const escaped = rawJson[index + 1];
        switch (escaped) {
            case '"':
            case '\\':
            case '/':
                text += escaped;
                index += 2;
                break;
            case 'b':
                text += '\b';
                index += 2;
                break;
            case 'f':
                text += '\f';
                index += 2;
                break;
            case 'n':
                text += '\n';
                index += 2;
                break;
            case 'r':
                text += '\r';
                index += 2;
                break;
            case 't':
                text += '\t';
                index += 2;
                break;
            case 'u': {
                const unicodeValue = rawJson.slice(index + 2, index + 6);
                if (!/^[0-9a-fA-F]{4}$/u.test(unicodeValue)) {
                    index = rawJson.length;
                    break;
                }
                text += String.fromCharCode(parseInt(unicodeValue, 16));
                index += 6;
                break;
            }
            default:
                text += escaped;
                index += 2;
                break;
        }
    }

    return {
        text,
        complete: false,
    };
}
