import React, { useState, useEffect } from "react";
import { WebClient } from "@slack/web-api";
import { List, Action, ActionPanel, Form, useNavigation, Toast } from "@raycast/api";
import { withAccessToken, getAccessToken } from "@raycast/utils";
import { SlackTemplate, Channel } from "./types";
import { showCustomToast } from "./lib/slack";
import { slack } from "./lib/slack";
import { sendMessage, validateAndNormalizeThreadTs } from "./lib/slack";
import { fetchAllChannels, findChannelById } from "./lib/slack";
import { loadTemplates, updateTemplate, deleteTemplate } from "./lib/templates";

function EditTemplateForm({ template, onUpdate }: { template: SlackTemplate; onUpdate: () => void }) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { pop } = useNavigation();

  useEffect(() => {
    fetchChannelsData();
  }, []);

  async function fetchChannelsData() {
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
                // Error is already handled by showToast
              }
            }}
          />
        </ActionPanel>
      }
    >
      <Form.TextField id="name" title="Template Name" defaultValue={template.name} placeholder="Enter template name" />
      <Form.TextArea id="content" title="Message" defaultValue={template.content} placeholder="Enter message content" />
      <Form.Dropdown id="slackChannelId" title="Channel" defaultValue={template.slackChannelId}>
        {isLoading ? (
          <Form.Dropdown.Item key="loading" value={template.slackChannelId} title="Loading channels..." />
        ) : (
          channels.map((channel) => (
            <Form.Dropdown.Item key={channel.id} value={channel.id} title={`#${channel.name}`} />
          ))
        )}
      </Form.Dropdown>
      <Form.TextField
        id="threadTimestamp"
        title="Thread Timestamp (Optional)"
        defaultValue={template.threadTimestamp}
        placeholder="Enter thread timestamp"
      />
    </Form>
  );
}

function Command() {
  const [templates, setTemplates] = useState<SlackTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchTemplatesData() {
    try {
      const loadedTemplates = await loadTemplates();
      setTemplates(loadedTemplates);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchTemplatesData();
  }, []);

  async function handleSendTemplatedMessage(template: SlackTemplate) {
    setIsLoading(true);
    try {
      const { token } = await getAccessToken();
      if (!token) {
        throw new Error("Failed to get authentication token");
      }
      await sendMessage(token, template.slackChannelId, template.content, template.threadTimestamp);
    } catch (error) {
      // Error is already handled in sendMessage
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteTemplate(template: SlackTemplate) {
    try {
      const updatedTemplates = await deleteTemplate(template.name);
      setTemplates(updatedTemplates);
    } catch (error) {
      // Error is already handled in deleteTemplate
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
                onAction={() => handleSendTemplatedMessage(template)}
                shortcut={{ modifiers: ["cmd"], key: "return" }}
              />
              <Action.Push
                title="Edit"
                target={<EditTemplateForm template={template} onUpdate={fetchTemplatesData} />}
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
