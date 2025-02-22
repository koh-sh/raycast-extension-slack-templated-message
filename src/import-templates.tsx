import { Form, ActionPanel, Action, showToast, Toast, open } from "@raycast/api";
import { useState } from "react";
import { loadTemplates, saveTemplates } from "./utils/template";
import { DEFAULT_TEMPLATE_PATH, readTemplatesFromFile, handleOperationError } from "./utils/template-io";
import { join } from "path";
import { homedir } from "os";
import { SlackTemplate } from "./types/template";

interface FormValues {
    filePath: string;
    overwrite: boolean;
}

export default function Command() {
    const [isLoading, setIsLoading] = useState(false);
    const [filePath, setFilePath] = useState<string>(DEFAULT_TEMPLATE_PATH);

    async function openDownloadsFolder() {
        try {
            await open(join(homedir(), "Downloads"));
            await showToast({
                style: Toast.Style.Success,
                title: "Downloads folder opened",
                message: "Select a JSON file and copy its path",
            });
        } catch (error) {
            await handleOperationError(error, "import");
        }
    }

    async function mergeTemplates(
        importedTemplates: SlackTemplate[],
        existingTemplates: SlackTemplate[],
        overwrite: boolean,
    ) {
        if (overwrite) {
            const uniqueExisting = existingTemplates.filter((t) => !importedTemplates.some((it) => it.name === t.name));
            return [...uniqueExisting, ...importedTemplates];
        } else {
            const existingNames = new Set(existingTemplates.map((t) => t.name));
            const uniqueImported = importedTemplates.filter((t) => !existingNames.has(t.name));
            return [...existingTemplates, ...uniqueImported];
        }
    }

    async function handleSubmit(values: FormValues) {
        setIsLoading(true);
        try {
            const importedTemplates = await readTemplatesFromFile(values.filePath);
            const existingTemplates = await loadTemplates();
            const newTemplates = await mergeTemplates(importedTemplates, existingTemplates, values.overwrite);

            await saveTemplates(newTemplates);
            await showToast({
                style: Toast.Style.Success,
                title: "Import successful",
                message: `Imported ${importedTemplates.length} templates`,
            });
        } catch (error) {
            await handleOperationError(error, "import");
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
                    <Action title="Open Downloads" onAction={openDownloadsFolder} />
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
            <Form.Checkbox id="overwrite" label="Update duplicate Items" defaultValue={false} />
        </Form>
    );
}
