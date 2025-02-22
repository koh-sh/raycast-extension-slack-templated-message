import { ActionPanel, Action, List, showToast, Toast, confirmAlert } from "@raycast/api";
import { loadTemplates } from "./utils/template";
import fs from "fs/promises";
import { homedir } from "os";
import { join } from "path";
import { useState, useEffect } from "react";
import { SlackTemplate } from "./types/template";

const DEFAULT_TEMPLATE_PATH = join(homedir(), "Downloads", "slack-templates.json");

export default function Command() {
    const [templates, setTemplates] = useState<SlackTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadTemplates()
            .then(setTemplates)
            .catch(async (error) => {
                await showToast({
                    style: Toast.Style.Failure,
                    title: "Failed to load templates",
                    message: error instanceof Error ? error.message : "Unknown error occurred"
                });
            })
            .finally(() => setIsLoading(false));
    }, []);

    async function handleExport() {
        try {
            // Check if file exists
            try {
                await fs.access(DEFAULT_TEMPLATE_PATH);
                // If file exists, confirm overwrite
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
            } catch (error) {
                // Continue if file doesn't exist
                if (!(error instanceof Error && error.message.includes("ENOENT"))) {
                    // Throw other errors
                    throw error;
                }
            }

            await fs.writeFile(DEFAULT_TEMPLATE_PATH, JSON.stringify(templates, null, 2));
            await showToast({
                style: Toast.Style.Success,
                title: "Export successful",
                message: `Exported ${templates.length} templates to ${DEFAULT_TEMPLATE_PATH}`
            });
        } catch (error) {
            await showToast({
                style: Toast.Style.Failure,
                title: "Export failed",
                message: error instanceof Error ? error.message : "Unknown error occurred"
            });
        }
    }

    return (
        <List isLoading={isLoading}>
            <List.Item
                title={`Export ${templates.length} templates`}
                subtitle={`Save to: ${DEFAULT_TEMPLATE_PATH}`}
                actions={
                    <ActionPanel>
                        <Action
                            title="Export"
                            onAction={handleExport}
                        />
                    </ActionPanel>
                }
            />
        </List>
    );
} 
