import React, { useState, useEffect } from "react";
import { List, Action, ActionPanel } from "@raycast/api";
import { withAccessToken, getAccessToken } from "@raycast/utils";
import { MessageTemplate } from "../types";
import { slack, sendMessage } from "../utils/slack";
import { loadTemplates, deleteTemplate } from "../utils/template";
import { TemplateForm } from "../components/TemplateForm";

function Command() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function refreshTemplates() {
    try {
      const loadedTemplates = await loadTemplates();
      setTemplates(loadedTemplates);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refreshTemplates();
  }, []);

  async function handleSendMessage(template: MessageTemplate) {
    setIsLoading(true);
    try {
      const { token } = await getAccessToken();
      if (token) {
        await sendMessage(token, template.channelId, template.content, template.threadTs);
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteTemplate(template: MessageTemplate) {
    const updatedTemplates = await deleteTemplate(template.name, templates);
    setTemplates(updatedTemplates);
  }

  return (
    <List isLoading={isLoading}>
      {templates.map((template) => (
        <List.Item
          key={template.name}
          title={template.name}
          subtitle={`#${template.channelName}${template.threadTs ? " (thread)" : ""}`}
          accessories={[
            {
              text: template.content.length > 50 ? template.content.slice(0, 50) + "..." : template.content,
            },
          ]}
          actions={
            <ActionPanel>
              <Action
                title="Send"
                onAction={() => handleSendMessage(template)}
                shortcut={{ modifiers: ["cmd"], key: "return" }}
              />
              <Action.Push
                title="Edit"
                target={<TemplateForm editingTemplate={template} onSave={refreshTemplates} />}
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
