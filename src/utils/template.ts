import { Toast } from "@raycast/api";
import { SlackTemplate } from "../types";
import { showCustomToast } from "./slack";
import { loadTemplatesFromFile, saveTemplatesToFile } from "./storage";

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
