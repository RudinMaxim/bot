export interface MaxUser {
    user_id: string;
    username?: string;
    first_name?: string;
}

export interface MaxChat {
    chat_id: string;
    type: string;
}

export interface MaxMessagePayload {
    message_id: string;
    text?: string;
    chat: MaxChat;
    from: MaxUser;
    timestamp: number;
}

export interface MaxCallbackQueryPayload {
    callback_id: string;
    chat_id: string;
    data?: string;
    from: MaxUser;
}

export interface MaxUpdate {
    update_id: number;
    message?: MaxMessagePayload;
    callback_query?: MaxCallbackQueryPayload;
}
