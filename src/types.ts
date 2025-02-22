/**
 * Type definitions for the Slack templated message extension.
 */
import { Toast } from "@raycast/api";

/**
 * Represents a Slack channel with its ID and name
 */
export interface Channel {
  id: string;
  name: string;
}

/**
 * Represents a message template with channel and thread information
 */
export interface SlackTemplate {
  name: string;
  content: string;
  slackChannelId: string;
  slackChannelName: string;
  threadTimestamp?: string;
}

/**
 * Common options for displaying toast notifications
 */
export interface ToastOptions {
  style: Toast.Style;
  title: string;
  message?: string;
}

/**
 * Extended Error type for Slack API errors
 */
export interface SlackError extends Error {
  data?: {
    error: string;
  };
}
