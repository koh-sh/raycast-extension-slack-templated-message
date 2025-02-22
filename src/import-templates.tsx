import { Form, ActionPanel, Action, showToast, Toast, open, confirmAlert, Alert } from "@raycast/api";
import { useState } from "react";
import { SlackTemplate } from "./types/template";
import { loadTemplates, saveTemplates } from "./utils/template";
import fs from "fs/promises";
import { homedir } from "os";
import { join } from "path";

const DEFAULT_TEMPLATE_PATH = join(homedir(), "Downloads", "slack-templates.json");

export default function Command() {
    const [isLoading, setIsLoading] = useState(false);
    const [filePath, setFilePath] = useState<string>(DEFAULT_TEMPLATE_PATH);

    async function openDownloads() {
        try {
            await open(join(homedir(), "Downloads"));
            await showToast({
                style: Toast.Style.Success,
                title: "Downloads folder opened",
                message: "Select a JSON file and copy its path"
            });
        } catch (error) {
            await showToast({
                style: Toast.Style.Failure,
                title: "Failed to open folder",
                message: error instanceof Error ? error.message : "Unknown error occurred"
            });
        }
    }

    async function handleSubmit(values: { filePath: string; overwrite: boolean }) {
        setIsLoading(true);
        try {
            if (!values.filePath) {
                throw new Error("Please enter a file path");
            }

            if (!values.filePath.toLowerCase().endsWith('.json')) {
                throw new Error("Please select a JSON file");
            }

            const fileContent = await fs.readFile(values.filePath, "utf8");
            const importedTemplates = JSON.parse(fileContent) as SlackTemplate[];

            // Validation
            const isValid = importedTemplates.every(template =>
                typeof template.name === "string" &&
                typeof template.content === "string" &&
                typeof template.slackChannelId === "string" &&
                typeof template.slackChannelName === "string" &&
                (template.threadTimestamp === undefined || typeof template.threadTimestamp === "string")
            );

            if (!isValid) {
                throw new Error("Invalid template format");
            }

            const existingTemplates = await loadTemplates();
            let newTemplates: SlackTemplate[];

            if (values.overwrite) {
                const uniqueExisting = existingTemplates.filter(t => !importedTemplates.some(it => it.name === t.name));
                newTemplates = [...uniqueExisting, ...importedTemplates];
            } else {
                const existingNames = new Set(existingTemplates.map(t => t.name));
                const uniqueImported = importedTemplates.filter(t => !existingNames.has(t.name));
                newTemplates = [...existingTemplates, ...uniqueImported];
            }

            await saveTemplates(newTemplates);
            await showToast({
                style: Toast.Style.Success,
                title: "Import successful",
                message: `Imported ${importedTemplates.length} templates`
            });
        } catch (error) {
            await showToast({
                style: Toast.Style.Failure,
                title: "Import failed",
                message: error instanceof Error ? error.message : "Unknown error occurred"
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
                    <Action.SubmitForm title="Import" onSubmit={handleSubmit} />
                    <Action title="Open Downloads" onAction={openDownloads} />
                </ActionPanel>
            }
        >
            <Form.Description text={`Select a JSON file to import. Default path: ${DEFAULT_TEMPLATE_PATH}`} />
            <Form.TextField
                id="filePath"
                title="File Path"
                placeholder={DEFAULT_TEMPLATE_PATH}
                value={filePath}
                onChange={setFilePath}
            />
            <Form.Checkbox
                id="overwrite"
                label="Overwrite existing templates"
                defaultValue={false}
            />
        </Form>
    );
} 
