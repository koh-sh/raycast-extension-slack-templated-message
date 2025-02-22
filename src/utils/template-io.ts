import { homedir } from "os";
import { join } from "path";
import fs from "fs/promises";
import { showToast, Toast } from "@raycast/api";
import { SlackTemplate } from "../types";

export const DEFAULT_TEMPLATE_PATH = join(homedir(), "Downloads", "slack-templates.json");

export async function validateTemplateFormat(templates: unknown): Promise<SlackTemplate[]> {
  const importedTemplates = templates as SlackTemplate[];

  const isValid = importedTemplates.every(
    (template) =>
      typeof template.name === "string" &&
      typeof template.content === "string" &&
      typeof template.slackChannelId === "string" &&
      typeof template.slackChannelName === "string" &&
      (template.threadTimestamp === undefined || typeof template.threadTimestamp === "string"),
  );

  if (!isValid) {
    throw new Error("Invalid template format");
  }

  return importedTemplates;
}

export async function checkFileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes("ENOENT")) {
      return false;
    }
    throw error;
  }
}

export async function readTemplatesFromFile(filePath: string): Promise<SlackTemplate[]> {
  if (!filePath) {
    throw new Error("Please enter a file path");
  }

  if (!filePath.toLowerCase().endsWith(".json")) {
    throw new Error("Please select a JSON file");
  }

  const fileContent = await fs.readFile(filePath, "utf8");
  const parsedContent = JSON.parse(fileContent);
  return await validateTemplateFormat(parsedContent);
}

export async function writeTemplatesToFile(filePath: string, templates: SlackTemplate[]): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(templates, null, 2));
}

export async function handleOperationError(error: unknown, operation: "import" | "export"): Promise<void> {
  await showToast({
    style: Toast.Style.Failure,
    title: `${operation === "import" ? "Import" : "Export"} failed`,
    message: error instanceof Error ? error.message : "Unknown error occurred",
  });
}
