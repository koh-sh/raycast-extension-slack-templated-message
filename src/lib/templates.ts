import { Toast, showToast } from "@raycast/api";
import { environment } from "@raycast/api";
import { homedir } from "os";
import { join } from "path";
import fs from "fs/promises";
import { SlackTemplate } from "../types";
import { showCustomToast } from "./slack";

// Constants
const TEMPLATES_FILENAME = "slack-templates.json";
const templatesFilePath = join(environment.supportPath, TEMPLATES_FILENAME);
export const DEFAULT_TEMPLATE_PATH = join(homedir(), "Downloads", "slack-templates.json");

// Storage functions
async function ensureStorageDirectory(): Promise<void> {
  try {
    await fs.mkdir(environment.supportPath, { recursive: true });
  } catch (error) {
    console.error("Failed to create storage directory:", error);
    throw error;
  }
}

async function loadTemplatesFromFile(): Promise<SlackTemplate[]> {
  try {
    await ensureStorageDirectory();
    const data = await fs.readFile(templatesFilePath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    console.error("Failed to load templates from file:", error);
    throw error;
  }
}

async function saveTemplatesToFile(templates: SlackTemplate[]): Promise<void> {
  try {
    await ensureStorageDirectory();
    await fs.writeFile(templatesFilePath, JSON.stringify(templates, null, 2));
  } catch (error) {
    console.error("Failed to save templates to file:", error);
    throw error;
  }
}

// Template validation and I/O functions
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

// Template management functions
export async function loadTemplates(): Promise<SlackTemplate[]> {
  try {
    return await loadTemplatesFromFile();
  } catch (error) {
    await showCustomToast({
      style: Toast.Style.Failure,
      title: "Failed to load templates",
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return [];
  }
}

export async function updateTemplate(updatedTemplate: SlackTemplate, originalName: string): Promise<void> {
  try {
    const templates = await loadTemplates();
    const updatedTemplates = templates.map((t) => (t.name === originalName ? updatedTemplate : t));
    await saveTemplatesToFile(updatedTemplates);

    await showCustomToast({
      style: Toast.Style.Success,
      title: "Template updated successfully",
    });
  } catch (error) {
    await showCustomToast({
      style: Toast.Style.Failure,
      title: "Failed to update template",
      message: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

export async function deleteTemplate(templateName: string): Promise<SlackTemplate[]> {
  try {
    const templates = await loadTemplates();
    const updatedTemplates = templates.filter((t) => t.name !== templateName);
    await saveTemplatesToFile(updatedTemplates);

    await showCustomToast({
      style: Toast.Style.Success,
      title: "Template deleted successfully",
    });

    return updatedTemplates;
  } catch (error) {
    await showCustomToast({
      style: Toast.Style.Failure,
      title: "Failed to delete template",
      message: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

export async function saveTemplates(templates: SlackTemplate[]): Promise<void> {
  try {
    await saveTemplatesToFile(templates);
  } catch (error) {
    await showCustomToast({
      style: Toast.Style.Failure,
      title: "Failed to save templates",
      message: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}
