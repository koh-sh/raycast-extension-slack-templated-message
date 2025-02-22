import { WebClient } from "@slack/web-api";
import { showToast, Toast } from "@raycast/api";
import { OAuthService } from "@raycast/utils";
import { ToastOptions } from "../types";

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
      throw new Error("not_in_channel");
    }
  } catch (error: unknown) {
    if (
      (error as { data?: { error: string } })?.data?.error === "not_in_channel" ||
      (error as Error).message === "not_in_channel"
    ) {
      throw new Error("not_in_channel");
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
      if (error.message === "not_in_channel") {
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
