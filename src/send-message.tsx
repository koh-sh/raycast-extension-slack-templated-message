import React, { useState, useEffect } from "react";
import { WebClient } from "@slack/web-api";
import { List, Toast, Action, ActionPanel, Form, useNavigation } from "@raycast/api";
import { withAccessToken, getAccessToken } from "@raycast/utils";
import { SlackTemplate, Channel } from "./types";
import { slack, showCustomToast, sendMessage, validateAndNormalizeThreadTs } from "./utils/slack";
import { loadTemplates, updateTemplate, deleteTemplate } from "./utils/template";
import { fetchAllChannels, findChannelById } from "./utils/channel";

function EditTemplateForm({ template, onUpdate }: { template: SlackTemplate; onUpdate: () => void }) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { pop } = useNavigation();

  useEffect(() => {
    fetchChannels();
  }, []);

  async function fetchChannels() {
    try {
      const { token } = await getAccessToken();
      if (!token) return;

      const client = new WebClient(token);
      const allChannels = await fetchAllChannels(client);
      setChannels(allChannels);
    } catch (error) {
      await showCustomToast({
        style: Toast.Style.Failure,
        title: "Failed to fetch channel list",
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
          <Action.SubmitForm
            title="Update"
            onSubmit={async (values: {
              name: string;
              content: string;
              slackChannelId: string;
              threadTimestamp?: string;
            }) => {
              const selectedChannel = findChannelById(channels, values.slackChannelId);
              if (!selectedChannel) {
                throw new Error("Selected channel not found");
              }

              let threadTs: string | undefined;
              if (values.threadTimestamp) {
                try {
                  const { token } = await getAccessToken();
                  if (!token) {
                    throw new Error("Failed to get authentication credentials");
                  }

                  const client = new WebClient(token);
                  threadTs = await validateAndNormalizeThreadTs(values.threadTimestamp, values.slackChannelId, client);
                } catch (error) {
                  await showCustomToast({
                    style: Toast.Style.Failure,
                    title: "Invalid thread",
                    message: error instanceof Error ? error.message : "Unknown error",
                  });
                  return;
                }
              }

              const updatedTemplate: SlackTemplate = {
                name: values.name.trim(),
                content: values.content.trim(),
                slackChannelId: values.slackChannelId,
                slackChannelName: selectedChannel.name,
                threadTimestamp: threadTs,
              };

              try {
                await updateTemplate(updatedTemplate, template.name);
                onUpdate();
                await pop();
              } catch (error) {
                // エラーは既にshowCustomToastで表示されているので、ここでは何もしない
              }
            }}
          />
        </ActionPanel>
      }
    >
      <Form.TextField id="name" title="Template Name" defaultValue={template.name} />
      <Form.TextArea id="content" title="Message" defaultValue={template.content} enableMarkdown />
      <Form.Dropdown id="slackChannelId" title="Channel" defaultValue={template.slackChannelId}>
        {channels.map((channel) => (
          <Form.Dropdown.Item key={channel.id} value={channel.id} title={`#${channel.name}`} />
        ))}
      </Form.Dropdown>
      <Form.TextField id="threadTimestamp" title="Thread ID (Optional)" defaultValue={template.threadTimestamp} />
    </Form>
  );
}

function Command() {
  const [templates, setTemplates] = useState<SlackTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchTemplates() {
    try {
      const loadedTemplates = await loadTemplates();
      setTemplates(loadedTemplates);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function sendTemplatedMessage(template: SlackTemplate) {
    setIsLoading(true);
    try {
      const { token } = await getAccessToken();
      if (!token) {
        throw new Error("Failed to get authentication token");
      }
      await sendMessage(token, template.slackChannelId, template.content, template.threadTimestamp);
    } catch (error) {
      await showCustomToast({
        style: Toast.Style.Failure,
        title: "Failed to send message",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteTemplate(template: SlackTemplate) {
    try {
      const updatedTemplates = await deleteTemplate(template.name);
      setTemplates(updatedTemplates);
    } catch (error) {
      // Error is already shown by showCustomToast, no need to handle here
    }
  }

  return (
    <List isLoading={isLoading}>
      {templates.map((template) => (
        <List.Item
          key={template.name}
          title={template.name}
          subtitle={`#${template.slackChannelName}${template.threadTimestamp ? " (Thread)" : ""}`}
          accessories={[
            {
              text: template.content.length > 50 ? template.content.slice(0, 50) + "..." : template.content,
            },
          ]}
          actions={
            <ActionPanel>
              <Action
                title="Send"
                onAction={() => sendTemplatedMessage(template)}
                shortcut={{ modifiers: ["cmd"], key: "return" }}
              />
              <Action.Push
                title="Edit"
                target={<EditTemplateForm template={template} onUpdate={fetchTemplates} />}
                shortcut={{ modifiers: ["cmd"], key: "e" }}
              />
              <Action
                title="Delete"
                onAction={() => handleDeleteTemplate(template)}
                shortcut={{ modifiers: ["cmd"], key: "backspace" }}
                style={Action.Style.Destructive}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}

export default withAccessToken(slack)(Command);
