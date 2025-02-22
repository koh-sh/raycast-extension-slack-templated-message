import React, { useState, useEffect } from "react";
import { WebClient } from "@slack/web-api";
import { showToast, Toast, Action, ActionPanel, Form } from "@raycast/api";
import { OAuthService, withAccessToken, getAccessToken } from "@raycast/utils";
import { SlackTemplate, Channel } from "./types";
import { loadTemplates, saveTemplates } from "./lib/templates";
import { validateAndNormalizeThreadTs } from "./lib/slack";

const slack = OAuthService.slack({
  scope: "chat:write channels:read groups:read channels:history groups:history",
});

function Command() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchChannels() {
      try {
        const { token } = await getAccessToken();
        if (!token) return;

        const client = new WebClient(token);
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

        setChannels(allChannels);
      } catch (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to fetch channel list",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchChannels();
  }, []);

  async function handleSubmit(values: {
    name: string;
    content: string;
    slackChannelId: string;
    threadTimestamp?: string;
  }) {
    if (!values.name.trim()) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Please enter a template name",
      });
      return;
    }

    if (!values.content.trim()) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Please enter a message",
      });
      return;
    }

    if (!values.slackChannelId) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Please select a channel",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { token } = await getAccessToken();
      if (!token) {
        throw new Error("Failed to get authentication credentials");
      }

      const client = new WebClient(token);

      let threadTimestamp = values.threadTimestamp?.trim();
      if (threadTimestamp) {
        try {
          threadTimestamp = await validateAndNormalizeThreadTs(threadTimestamp, values.slackChannelId, client);
        } catch (error) {
          await showToast({
            style: Toast.Style.Failure,
            title: "Invalid thread",
            message: error instanceof Error ? error.message : "Unknown error",
          });
          return;
        }
      }

      const savedTemplates = await loadTemplates();
      const templates = savedTemplates;

      if (templates.some((t) => t.name === values.name.trim())) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Template with the same name already exists",
          message: "Please specify a different name",
        });
        return;
      }

      const selectedChannel = channels.find((c) => c.id === values.slackChannelId);
      if (!selectedChannel) {
        throw new Error("Selected channel not found");
      }

      const newTemplate: SlackTemplate = {
        name: values.name.trim(),
        content: values.content.trim(),
        slackChannelId: values.slackChannelId,
        slackChannelName: selectedChannel.name,
        threadTimestamp: threadTimestamp,
      };

      await saveTemplates([...templates, newTemplate]);

      await showToast({
        style: Toast.Style.Success,
        title: "Template created successfully",
      });
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to create template",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Create" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField id="name" title="Template Name" placeholder="Enter the name of the template" />
      <Form.TextArea id="content" title="Message" placeholder="Enter your message template" />
      <Form.Dropdown id="slackChannelId" title="Channel" placeholder="Select a channel">
        {channels.map((channel) => (
          <Form.Dropdown.Item key={channel.id} value={channel.id} title={`#${channel.name}`} />
        ))}
      </Form.Dropdown>
      <Form.TextField
        id="threadTimestamp"
        title="Thread ID (Optional)"
        placeholder="Enter thread timestamp Example: p1234567891234567"
      />
      <Form.Description
        text="Available variables for the message template:
{date} - Date (YYYY-MM-DD)
{time} - Time (HH:mm)
{user} - User Name"
      />
    </Form>
  );
}

export default withAccessToken(slack)(Command);
