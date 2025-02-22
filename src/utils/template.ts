import { LocalStorage, showToast, Toast } from "@raycast/api";
import { MessageTemplate } from "../types";

export async function loadTemplates(): Promise<MessageTemplate[]> {
  try {
    const savedTemplates = await LocalStorage.getItem<string>("messageTemplates");
    return savedTemplates ? JSON.parse(savedTemplates) : [];
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Failed to load templates",
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return [];
  }
}

export async function saveTemplates(templates: MessageTemplate[]): Promise<void> {
  try {
    await LocalStorage.setItem("messageTemplates", JSON.stringify(templates));
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Failed to save templates",
      message: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

export async function deleteTemplate(templateName: string, templates: MessageTemplate[]): Promise<MessageTemplate[]> {
  try {
    const updatedTemplates = templates.filter((t) => t.name !== templateName);
    await saveTemplates(updatedTemplates);
    await showToast({
      style: Toast.Style.Success,
      title: "Template deleted successfully",
    });
    return updatedTemplates;
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Failed to delete template",
      message: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

export async function saveTemplate(
  template: MessageTemplate,
  existingTemplates: MessageTemplate[],
  overwrite: boolean,
): Promise<MessageTemplate[]> {
  // Check for duplicate template names
  if (!overwrite && existingTemplates.some((t) => t.name === template.name.trim())) {
    throw new Error("Template with this name already exists");
  }

  const updatedTemplates = overwrite
    ? existingTemplates.map((t) => (t.name === template.name.trim() ? template : t))
    : [...existingTemplates, template];

  await saveTemplates(updatedTemplates);
  return updatedTemplates;
}
