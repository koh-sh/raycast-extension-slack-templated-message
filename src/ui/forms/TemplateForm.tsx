import React, { useState, useEffect } from "react";
import { Form, ActionPanel, Action, showToast, Toast } from "@raycast/api";
import { WebClient } from "@slack/web-api";
import { getAccessToken } from "@raycast/utils";
import { Channel, MessageTemplate, TemplateForm as TemplateFormType } from "../../types";
import { validateAndNormalizeThreadTs, fetchAllChannels } from "../../lib/slack";
import { updateTemplate } from "../../lib/templates";

interface Props {
  editingTemplate?: MessageTemplate;
  onSave?: () => Promise<void>;
}

export function TemplateForm({ editingTemplate, onSave }: Props) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const { token } = await getAccessToken();
        if (!token) return;

        const client = new WebClient(token);
        const channelList = await fetchAllChannels(client);
        setChannels(channelList);
      } catch (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to load data",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  async function handleSubmit(values: TemplateFormType) {
    if (!values.name.trim()) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Template name is required",
      });
      return;
    }

    if (!values.content.trim()) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Message content is required",
      });
      return;
    }

    if (!values.channelId) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Channel selection is required",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { token } = await getAccessToken();
      if (!token) {
        throw new Error("Failed to get authentication token");
      }

      const client = new WebClient(token);
      const threadTs = values.threadTs
        ? await validateAndNormalizeThreadTs(values.threadTs, values.channelId, client)
        : undefined;

      const selectedChannel = channels.find((c) => c.id === values.channelId);
      if (!selectedChannel) {
        throw new Error("Selected channel not found");
      }

      const template: MessageTemplate = {
        name: values.name.trim(),
        content: values.content.trim(),
        channelId: values.channelId,
        channelName: selectedChannel.name,
        threadTs: threadTs || undefined,
      };

      const slackTemplate = {
        name: template.name,
        content: template.content,
        slackChannelId: template.channelId,
        slackChannelName: template.channelName,
        threadTimestamp: template.threadTs,
      };
      await updateTemplate(slackTemplate, template.name);

      await showToast({
        style: Toast.Style.Success,
        title: `Template ${values.overwrite ? "updated" : "saved"} successfully`,
      });

      if (onSave) {
        await onSave();
      }
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to save template",
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
          <Action.SubmitForm title={editingTemplate ? "Update" : "Save"} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="name"
        title="Template Name"
        placeholder="Enter template name"
        defaultValue={editingTemplate?.name}
      />
      <Form.TextArea
        id="content"
        title="Message"
        placeholder="Enter message content. Available variables:
{date} - Date (YYYY-MM-DD)
{time} - Time (HH:mm)
{user} - Username"
        enableMarkdown
        defaultValue={editingTemplate?.content}
      />
      <Form.Dropdown
        id="channelId"
        title="Channel"
        placeholder="Select a channel"
        defaultValue={editingTemplate?.channelId}
      >
        {channels.map((channel) => (
          <Form.Dropdown.Item key={channel.id} value={channel.id} title={`#${channel.name}`} />
        ))}
      </Form.Dropdown>
      <Form.TextField
        id="threadTs"
        title="Thread ID (Optional)"
        placeholder="Enter thread timestamp to reply in a thread (p prefix will be removed automatically)"
        defaultValue={editingTemplate?.threadTs}
      />
      <Form.Checkbox
        id="overwrite"
        label="Overwrite if template with same name exists"
        defaultValue={editingTemplate ? true : false}
      />
    </Form>
  );
}
