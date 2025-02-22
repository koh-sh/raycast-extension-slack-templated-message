import React from "react";
import { Action, ActionPanel, Form, showToast, Toast } from "@raycast/api";
import { getAccessToken, withAccessToken } from "@raycast/utils";
import { WebClient } from "@slack/web-api";
import { SlackTemplate } from "./types";
import { validateAndNormalizeThreadTs, slack } from "./lib/slack";
import { loadTemplates, saveTemplates } from "./lib/templates";
import { useChannels, ChannelDropdown, ThreadField } from "./components/shared";

function Command() {
  const { channels, isLoading } = useChannels();

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

    try {
      const { token } = await getAccessToken();
      if (!token) {
        throw new Error("Failed to get authentication credentials");
      }

      const client = new WebClient(token);
      let threadTimestamp = values.threadTimestamp?.trim();
      if (threadTimestamp) {
        threadTimestamp = await validateAndNormalizeThreadTs(threadTimestamp, values.slackChannelId, client);
      }

      const savedTemplates = await loadTemplates();
      if (savedTemplates.some((t) => t.name === values.name.trim())) {
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

      await saveTemplates([...savedTemplates, newTemplate]);
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
      <ChannelDropdown channels={channels} />
      <ThreadField />
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
