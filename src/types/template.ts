export interface MessageTemplate {
    name: string;
    content: string;
    channelId: string;
    channelName: string;
    threadTs?: string;
}

export interface TemplateForm {
    name: string;
    content: string;
    channelId: string;
    threadTs?: string;
    overwrite: boolean;
}

export interface SlackTemplate {
    name: string;
    content: string;
    slackChannelId: string;
    slackChannelName: string;
    threadTimestamp?: string;
} 
