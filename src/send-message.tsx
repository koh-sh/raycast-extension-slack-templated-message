import React, { useState, useEffect } from "react";
import { WebClient } from "@slack/web-api";
import { List, showToast, Toast, Action, ActionPanel, LocalStorage, Form, useNavigation } from "@raycast/api";
import { OAuthService, withAccessToken, getAccessToken } from "@raycast/utils";
import { SlackTemplate } from "./types";

interface Channel {
  id: string;
  name: string;
}

const slack = OAuthService.slack({
  scope: "chat:write channels:read groups:read",
});

async function expandTemplateVariables(message: string, client: WebClient): Promise<string> {
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

async function sendSlackMessage(token: string, slackChannelId: string, message: string, threadTimestamp?: string) {
  const client = new WebClient(token);
  try {
    // Check channel membership status
    try {
      const userInfo = await client.auth.test();
      if (!userInfo.user_id) throw new Error("Failed to get user ID");

      const members = await client.conversations.members({
        channel: slackChannelId,
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

    // Check thread existence (after channel membership verification)
    if (threadTimestamp) {
      try {
        const threadInfo = await client.conversations.replies({
          channel: slackChannelId,
          ts: threadTimestamp,
          limit: 1,
        });
        if (!threadInfo.messages?.length) {
          throw new Error("Thread not found");
        }
      } catch (error) {
        throw new Error("The specified thread does not exist in this channel. Please select the correct channel.");
      }
    }

    // Replace template variables
    const processedMessage = await expandTemplateVariables(message, client);

    await client.chat.postMessage({
      channel: slackChannelId,
      text: processedMessage,
      thread_ts: threadTimestamp && threadTimestamp.trim() !== "" ? threadTimestamp : undefined,
    });

    await showToast({
      style: Toast.Style.Success,
      title: "Message sent successfully",
    });
  } catch (error) {
    let errorMessage = "Failed to send message.";
    if (error instanceof Error) {
      if (error.message === "not_in_channel") {
        errorMessage =
          "Cannot send message because you are not a member of this channel. Please join the channel and try again.";
      } else if (error.message.includes("does not exist in this channel")) {
        errorMessage = error.message;
      }
    }

    await showToast({
      style: Toast.Style.Failure,
      title: "An error occurred",
      message: errorMessage,
    });
  }
}

function EditTemplateForm({ template, onUpdate }: { template: SlackTemplate; onUpdate: () => void }) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { pop } = useNavigation();

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
              const selectedChannel = channels.find((c) => c.id === values.slackChannelId);
              if (!selectedChannel) {
                throw new Error("Selected channel not found");
              }

              let threadTs = values.threadTimestamp?.trim();
              if (threadTs) {
                if (threadTs.startsWith("p")) {
                  threadTs = threadTs.slice(1);
                }

                if (/^\d+$/.test(threadTs)) {
                  const len = threadTs.length;
                  if (len > 6) {
                    threadTs = `${threadTs.slice(0, len - 6)}.${threadTs.slice(len - 6)}`;
                  }
                } else if (!/^\d+\.\d+$/.test(threadTs)) {
                  await showToast({
                    style: Toast.Style.Failure,
                    title: "Invalid thread ID format",
                    message: "Thread ID must contain only numbers",
                  });
                  return;
                }

                const { token } = await getAccessToken();
                if (!token) {
                  throw new Error("Failed to get authentication credentials");
                }

                const client = new WebClient(token);
                try {
                  const threadInfo = await client.conversations.replies({
                    channel: values.slackChannelId,
                    ts: threadTs,
                    limit: 1,
                  });
                  if (!threadInfo.messages?.length) {
                    await showToast({
                      style: Toast.Style.Failure,
                      title: "Thread not found",
                      message: "The specified thread does not exist in this channel",
                    });
                    return;
                  }
                } catch (error) {
                  await showToast({
                    style: Toast.Style.Failure,
                    title: "Thread not found",
                    message: "The specified thread does not exist in this channel",
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

              const savedTemplates = (await LocalStorage.getItem<string>("messageTemplates")) || "[]";
              const templates: SlackTemplate[] = JSON.parse(savedTemplates);
              const updatedTemplates = templates.map((t) => (t.name === template.name ? updatedTemplate : t));

              await LocalStorage.setItem("messageTemplates", JSON.stringify(updatedTemplates));

              await showToast({
                style: Toast.Style.Success,
                title: "Template updated successfully",
              });

              onUpdate();
              await pop();
            }}
          />
        </ActionPanel>
      }
    >
      <Form.TextField id="name" title="Template Name" defaultValue={template.name} />
      <Form.TextArea id="content" title="Message" defaultValue={template.content} enableMarkdown />
      <Form.Dropdown id="slackChannelId" title="Channel" defaultValue={channels.length > 0 ? template.slackChannelId : undefined}>
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
      const savedTemplates = await LocalStorage.getItem<string>("messageTemplates");
      if (savedTemplates) {
        setTemplates(JSON.parse(savedTemplates));
      }
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to load templates",
        message: error instanceof Error ? error.message : "Unknown error",
      });
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
      if (token) {
        await sendSlackMessage(token, template.slackChannelId, template.content, template.threadTimestamp);
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function deleteTemplate(template: SlackTemplate) {
    try {
      const updatedTemplates = templates.filter((t) => t.name !== template.name);
      await LocalStorage.setItem("messageTemplates", JSON.stringify(updatedTemplates));
      setTemplates(updatedTemplates);
      await showToast({
        style: Toast.Style.Success,
        title: "Template deleted successfully",
      });
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to delete template",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return (
    <List isLoading={isLoading} onSelectionChange={() => fetchTemplates()}>
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
                onAction={() => deleteTemplate(template)}
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
