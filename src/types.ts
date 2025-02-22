import { Toast } from "@raycast/api";

export interface Channel {
  id: string;
  name: string;
}

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

export interface ToastOptions {
  style: Toast.Style;
  title: string;
  message?: string;
}

export interface SlackError extends Error {
  data?: {
    error: string;
  };
}
