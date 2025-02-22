import { Toast, showToast as raycastShowToast } from "@raycast/api";
import { ToastOptions } from "../../types";

export async function showToast({ style, title, message }: ToastOptions): Promise<void> {
  await raycastShowToast({
    style,
    title,
    message,
  });
}
