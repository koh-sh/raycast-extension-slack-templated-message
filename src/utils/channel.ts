import { WebClient } from "@slack/web-api";
import { Toast } from "@raycast/api";
import { Channel } from "../types";
import { showCustomToast } from "./slack";

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
