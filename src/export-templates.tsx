import { ActionPanel, Action, List, showToast, Toast, confirmAlert } from "@raycast/api";
import { loadTemplates } from "./utils/template";
import { useState, useEffect } from "react";
import { SlackTemplate } from "./types";
import {
  DEFAULT_TEMPLATE_PATH,
  checkFileExists,
  writeTemplatesToFile,
  handleOperationError,
} from "./utils/template-io";

export default function Command() {
  const [templates, setTemplates] = useState<SlackTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTemplates()
      .then(setTemplates)
      .catch(async (error) => {
        await handleOperationError(error, "export");
      })
      .finally(() => setIsLoading(false));
  }, []);

  async function handleExport() {
    try {
      const fileExists = await checkFileExists(DEFAULT_TEMPLATE_PATH);

      if (fileExists) {
        const shouldOverwrite = await confirmAlert({
          title: "File already exists",
          message: `Do you want to overwrite ${DEFAULT_TEMPLATE_PATH}?`,
          primaryAction: {
            title: "Overwrite",
          },
          dismissAction: {
            title: "Cancel",
          },
        });

        if (!shouldOverwrite) {
          return;
        }
      }

      await writeTemplatesToFile(DEFAULT_TEMPLATE_PATH, templates);
      await showToast({
        style: Toast.Style.Success,
        title: "Export successful",
        message: `Exported ${templates.length} templates to ${DEFAULT_TEMPLATE_PATH}`,
      });
    } catch (error) {
      await handleOperationError(error, "export");
    }
  }

  return (
    <List isLoading={isLoading}>
      <List.Item
        title={`Export ${templates.length} templates`}
        subtitle={`Save to: ${DEFAULT_TEMPLATE_PATH}`}
        actions={
          <ActionPanel>
            <Action title="Export" onAction={handleExport} />
          </ActionPanel>
        }
      />
    </List>
  );
}
