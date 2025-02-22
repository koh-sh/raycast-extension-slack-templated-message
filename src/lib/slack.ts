import { WebClient } from "@slack/web-api";
import { showToast, Toast } from "@raycast/api";
import { OAuthService } from "@raycast/utils";
import { ToastOptions, Channel } from "../types";

export const SLACK_API_ERROR_CODES = {
  NOT_IN_CHANNEL: "not_in_channel",
  CHANNEL_NOT_FOUND: "channel_not_found",
} as const;

export const slack = OAuthService.slack({
  scope: "chat:write channels:read groups:read",
});

export async function replaceTemplateVariables(message: string, client: WebClient): Promise<string> {
  const now = new Date();
  const userInfo = await client.auth.test();

  const variables: { [key: string]: string } = {
    date: now.toISOString().split("T")[0],
    time: now.toTimeString().slice(0, 5),
    datetime: `${now.toISOString().split("T")[0]} ${now.toTimeString().slice(0, 5)}`,
    user: userInfo.user || "unknown",
  };

  return message.replace(/\{([^}]+)\}/g, (match, key) => {
    return variables[key] || match;
  });
}

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

export async function showCustomToast(options: ToastOptions): Promise<void> {
  await showToast({
    style: options.style,
    title: options.title,
    message: options.message,
  });
}

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

export function findChannelById(channels: Channel[], channelId: string): Channel | undefined {
  return channels.find((c) => c.id === channelId);
}
