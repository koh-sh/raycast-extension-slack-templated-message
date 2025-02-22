import React, { useState, useEffect } from "react";
import { Form } from "@raycast/api";
import { WebClient } from "@slack/web-api";
import { getAccessToken } from "@raycast/utils";
import { Channel } from "../types";
import { fetchAllChannels } from "../lib/slack";

// Hook for fetching channels
export function useChannels() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchChannels() {
      try {
        const { token } = await getAccessToken();
        if (!token) return;
        const client = new WebClient(token);
        const allChannels = await fetchAllChannels(client);
        setChannels(allChannels);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchChannels();
  }, []);

  return { channels, isLoading };
}

// Shared channel selection dropdown
export function ChannelDropdown({
  id = "slackChannelId",
  channels,
  defaultValue,
  placeholder = "Select a channel",
}: {
  id?: string;
  channels: Channel[];
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <Form.Dropdown id={id} title="Channel" defaultValue={defaultValue} placeholder={placeholder}>
      {channels.map((channel) => (
        <Form.Dropdown.Item key={channel.id} value={channel.id} title={`#${channel.name}`} />
      ))}
    </Form.Dropdown>
  );
}

// Shared thread ID input field
export function ThreadField({ id = "threadTimestamp", defaultValue }: { id?: string; defaultValue?: string }) {
  return (
    <Form.TextField
      id={id}
      title="Thread ID (Optional)"
      defaultValue={defaultValue}
      placeholder="Enter thread timestamp Example: p1234567891234567"
    />
  );
}
