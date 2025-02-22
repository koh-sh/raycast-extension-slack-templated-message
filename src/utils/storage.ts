import { environment } from "@raycast/api";
import fs from "fs/promises";
import path from "path";
import { SlackTemplate } from "../types";

const TEMPLATES_FILENAME = "slack-templates.json";
const templatesFilePath = path.join(environment.supportPath, TEMPLATES_FILENAME);

export async function ensureStorageDirectory(): Promise<void> {
  try {
    await fs.mkdir(environment.supportPath, { recursive: true });
  } catch (error) {
    console.error("Failed to create storage directory:", error);
    throw error;
  }
}

export async function loadTemplatesFromFile(): Promise<SlackTemplate[]> {
  try {
    await ensureStorageDirectory();
    const data = await fs.readFile(templatesFilePath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      // Return empty array if file does not exist
      return [];
    }
    console.error("Failed to load templates from file:", error);
    throw error;
  }
}

export async function saveTemplatesToFile(templates: SlackTemplate[]): Promise<void> {
  try {
    await ensureStorageDirectory();
    await fs.writeFile(templatesFilePath, JSON.stringify(templates, null, 2));
  } catch (error) {
    console.error("Failed to save templates to file:", error);
    throw error;
  }
}
