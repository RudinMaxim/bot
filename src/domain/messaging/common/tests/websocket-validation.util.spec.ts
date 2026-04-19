import { setLocaleDictionary } from 'src/shared/utils/texts';
import { validateChatMessagePayload } from '../utils/websocket-validation.util';

describe('websocket-validation.util', () => {
    beforeAll(() => {
        setLocaleDictionary('ru', {
            system: {
                ai: {
                    validation: {
                        invalidContactFormat:
                            'Неверный формат контакта (телефон или email)',
                    },
                },
                webAdapter: {
                    validation: {
                        emptyMessage: 'empty',
                        envelopeBodyRequired: 'body required',
                        chatIdRequired: 'chatId required',
                        usernameMustBeString: 'username must be string',
                        localeMustBeString: 'locale must be string',
                        contentOrAudioOrFormRequired: 'content required',
                        contentTooLong: 'too long',
                        formMustBeObject: 'form object required',
                        formIdRequired: 'form id required',
                        formTitleRequired: 'form title required',
                        formFieldsRequired: 'form fields required',
                        formFieldInvalid: 'invalid field',
                        formFieldKeyRequired: 'field key required',
                        formFieldLabelRequired: 'field label required',
                        formFieldTypeInvalid: 'field type invalid',
                        formStringTooLong: '{field} too long ({max})',
                        formStringContainsInvalidChars:
                            '{field} contains invalid chars',
                    },
                    audio: {
                        base64Required: 'base64 required',
                    },
                },
            },
            content: {
                forms: {
                    fieldRequired: 'Заполните поле',
                },
            },
        });
    });

    it('allows invalid phone_or_email form values to reach AI validation', () => {
        const error = validateChatMessagePayload(
            {
                body: {
                    chatId: 'chat_1',
                    form: {
                        id: 'contact',
                        title: 'Contacts',
                        fields: [
                            {
                                key: 'contact_info',
                                label: 'Phone or email',
                                type: 'phone_or_email',
                                required: true,
                                value: 'not-a-contact',
                            },
                        ],
                    },
                },
                metadata: {
                    locale: 'ru',
                },
            },
            4000,
        );

        expect(error).toBeNull();
    });

    it('accepts valid phone_or_email form values', () => {
        const error = validateChatMessagePayload(
            {
                body: {
                    chatId: 'chat_1',
                    form: {
                        id: 'contact',
                        title: 'Contacts',
                        fields: [
                            {
                                key: 'contact_info',
                                label: 'Phone or email',
                                type: 'phone_or_email',
                                required: true,
                                value: '+7 (999) 123-45-67',
                            },
                        ],
                    },
                },
                metadata: {
                    locale: 'ru',
                },
            },
            4000,
        );

        expect(error).toBeNull();
    });

    it('allows empty required form values to reach AI clarification flow', () => {
        const error = validateChatMessagePayload(
            {
                body: {
                    chatId: 'chat_1',
                    form: {
                        id: 'contact',
                        title: 'Contacts',
                        fields: [
                            {
                                key: 'client_name',
                                label: 'Name',
                                type: 'text',
                                required: true,
                                value: '',
                            },
                        ],
                    },
                },
                metadata: {
                    locale: 'ru',
                },
            },
            4000,
        );

        expect(error).toBeNull();
    });

    it('rejects overlong form field values', () => {
        const error = validateChatMessagePayload(
            {
                body: {
                    chatId: 'chat_1',
                    form: {
                        id: 'contact',
                        title: 'Contacts',
                        fields: [
                            {
                                key: 'contact_info',
                                label: 'Phone or email',
                                type: 'text',
                                required: true,
                                value: 'x'.repeat(501),
                            },
                        ],
                    },
                },
                metadata: {
                    locale: 'ru',
                },
            },
            4000,
        );

        expect(error).toBe('form.fields[].value too long (500)');
    });

    it('rejects control characters in form values', () => {
        const error = validateChatMessagePayload(
            {
                body: {
                    chatId: 'chat_1',
                    form: {
                        id: 'contact',
                        title: 'Contacts',
                        fields: [
                            {
                                key: 'contact_info',
                                label: 'Phone or email',
                                type: 'text',
                                required: true,
                                value: 'Alice\u0000Bob',
                            },
                        ],
                    },
                },
                metadata: {
                    locale: 'ru',
                },
            },
            4000,
        );

        expect(error).toBe('form.fields[].value contains invalid chars');
    });

    it('accepts date form field type', () => {
        const error = validateChatMessagePayload(
            {
                body: {
                    chatId: 'chat_1',
                    form: {
                        id: 'contact',
                        title: 'Contacts',
                        fields: [
                            {
                                key: 'appointment_date',
                                label: 'Appointment date',
                                type: 'date',
                                value: '2026-03-20T18:00:00.000Z',
                            },
                        ],
                    },
                },
                metadata: {
                    locale: 'ru',
                },
            },
            4000,
        );

        expect(error).toBeNull();
    });

    it('accepts phone and email form field types', () => {
        const error = validateChatMessagePayload(
            {
                body: {
                    chatId: 'chat_1',
                    form: {
                        id: 'contact',
                        title: 'Contacts',
                        fields: [
                            {
                                key: 'phone',
                                label: 'Phone',
                                type: 'phone',
                                value: '+7 (999) 123-45-67',
                            },
                            {
                                key: 'email',
                                label: 'Email',
                                type: 'email',
                                value: 'test@example.com',
                            },
                        ],
                    },
                },
                metadata: {
                    locale: 'ru',
                },
            },
            4000,
        );

        expect(error).toBeNull();
    });
});
