/**
 * Slack API integration module.
 * Provides functions for interacting with Slack's Web API and managing message templates.
 */
import { WebClient } from "@slack/web-api";
import { showToast, Toast } from "@raycast/api";
import { OAuthService } from "@raycast/utils";
import { ToastOptions, Channel } from "../types";

/** Slack API error codes for channel-related operations */
export const SLACK_API_ERROR_CODES = {
  NOT_IN_CHANNEL: "not_in_channel",
  CHANNEL_NOT_FOUND: "channel_not_found",
} as const;

/** OAuth configuration for Slack API access */
export const slack = OAuthService.slack({
  scope: "chat:write channels:read groups:read channels:history groups:history",
});

/**
 * Replaces template variables in a message with their actual values
 * @param message - The message template containing variables
 * @param client - Authenticated Slack Web API client
 * @returns Promise<string> The processed message with variables replaced
 */
export async function replaceTemplateVariables(message: string, client: WebClient): Promise<string> {
  const now = new Date();
  const userInfo = await client.auth.test();

  const variables: { [key: string]: string } = {
    date: now.toISOString().split("T")[0],
    time: now.toTimeString().slice(0, 5),
    user: userInfo.user || "unknown",
  };

  return message.replace(/\{([^}]+)\}/g, (match, key) => {
    return variables[key] || match;
  });
}

/**
 * Validates and normalizes a thread timestamp
 * @param threadTs - Thread timestamp to validate
 * @param channelId - ID of the channel containing the thread
 * @param client - Authenticated Slack Web API client
 * @returns Promise<string | undefined> Normalized thread timestamp or undefined
 * @throws Error if thread ID is invalid or not found
 */
export async function validateAndNormalizeThreadTs(
  threadTs: string | undefined,
  channelId: string,
  client: WebClient,
): Promise<string | undefined> {
  if (!threadTs?.trim()) {
    return undefined;
  }

  let normalizedTs = threadTs.trim();
  if (normalizedTs.startsWith("p")) {
    normalizedTs = normalizedTs.slice(1);
  }

  if (/^\d+$/.test(normalizedTs)) {
    const len = normalizedTs.length;
    if (len > 6) {
      normalizedTs = `${normalizedTs.slice(0, len - 6)}.${normalizedTs.slice(len - 6)}`;
    }
  }

  if (!/^\d+\.\d+$/.test(normalizedTs)) {
    throw new Error("Thread ID must contain only numbers");
  }

  try {
    const threadInfo = await client.conversations.replies({
      channel: channelId,
      ts: normalizedTs,
      limit: 1,
    });
    if (!threadInfo.messages?.length) {
      throw new Error("Thread not found");
    }
  } catch (error) {
    throw new Error("The specified thread does not exist in this channel");
  }

  return normalizedTs;
}

/**
 * Checks if the authenticated user is a member of the specified channel
 * @param channelId - ID of the channel to check
 * @param client - Authenticated Slack Web API client
 * @throws Error if user is not a member of the channel
 */
export async function checkChannelMembership(channelId: string, client: WebClient): Promise<void> {
  try {
    const userInfo = await client.auth.test();
    if (!userInfo.user_id) throw new Error("Failed to get user ID");

    const members = await client.conversations.members({
      channel: channelId,
    });

    if (!members.members?.includes(userInfo.user_id)) {
      throw new Error("You need to join the channel before sending messages");
    }
  } catch (error: unknown) {
    const slackError = error as { data?: { error: string } };
    if (
      slackError.data?.error === SLACK_API_ERROR_CODES.NOT_IN_CHANNEL ||
      slackError.data?.error === SLACK_API_ERROR_CODES.CHANNEL_NOT_FOUND ||
      (error instanceof Error && error.message === SLACK_API_ERROR_CODES.NOT_IN_CHANNEL)
    ) {
      throw new Error("You need to join the channel before sending messages");
    }
    throw error;
  }
}

/**
 * Sends a message to a Slack channel
 * @param token - Slack API token
 * @param channelId - ID of the target channel
 * @param message - Message content to send
 * @param threadTs - Optional thread timestamp for reply
 * @throws Error if message sending fails
 */
export async function sendMessage(token: string, channelId: string, message: string, threadTs?: string) {
  const client = new WebClient(token);
  try {
    await checkChannelMembership(channelId, client);

    if (threadTs) {
      await validateAndNormalizeThreadTs(threadTs, channelId, client);
    }

    const processedMessage = await replaceTemplateVariables(message, client);

    await client.chat.postMessage({
      channel: channelId,
      text: processedMessage,
      thread_ts: threadTs && threadTs.trim() !== "" ? threadTs : undefined,
    });

    await showToast({
      style: Toast.Style.Success,
      title: "Message sent successfully",
    });
  } catch (error) {
    let errorMessage = "Failed to send message";
    if (error instanceof Error) {
      if (error.message === SLACK_API_ERROR_CODES.NOT_IN_CHANNEL) {
        errorMessage = "You are not a member of this channel. Please join the channel and try again.";
      } else if (error.message === "Thread does not exist in this channel") {
        errorMessage = "The specified thread does not exist in this channel. Please check the channel selection.";
      } else {
        errorMessage = error.message;
      }
    }

    await showToast({
      style: Toast.Style.Failure,
      title: "Error",
      message: errorMessage,
    });
    throw error;
  }
}

/**
 * Shows a custom toast notification
 * @param options - Toast notification options
 */
export async function showCustomToast(options: ToastOptions): Promise<void> {
  await showToast({
    style: options.style,
    title: options.title,
    message: options.message,
  });
}

/**
 * Fetches all accessible Slack channels
 * @param client - Authenticated Slack Web API client
 * @returns Promise<Channel[]> Array of channel information
 * @throws Error if channel fetching fails
 */
export async function fetchAllChannels(client: WebClient): Promise<Channel[]> {
  try {
    const allChannels: Channel[] = [];
    let cursor: string | undefined;

    do {
      const result = await client.conversations.list({
        types: "public_channel,private_channel",
        exclude_archived: true,
        limit: 200,
        cursor: cursor,
      });

      if (result.channels) {
        const channelList = result.channels
          .filter((channel) => channel.id && channel.name && !channel.is_archived)
          .map((channel) => ({
            id: channel.id!,
            name: channel.name!,
          }));
        allChannels.push(...channelList);
      }

      cursor = result.response_metadata?.next_cursor;
    } while (cursor);

    return allChannels;
  } catch (error) {
    await showCustomToast({
      style: Toast.Style.Failure,
      title: "Failed to fetch channel list",
      message: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

/**
 * Finds a channel by its ID
 * @param channels - Array of channels to search
 * @param channelId - ID of the channel to find
 * @returns Channel | undefined The found channel or undefined
 */
export function findChannelById(channels: Channel[], channelId: string): Channel | undefined {
  return channels.find((c) => c.id === channelId);
}
