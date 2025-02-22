import { Toast, showToast as raycastShowToast } from "@raycast/api";
import { ToastOptions } from "../types/slack";

export async function showToast({ style, title, message }: ToastOptions): Promise<void> {
    await raycastShowToast({
        style: style === "success" ? Toast.Style.Success : Toast.Style.Failure,
        title,
        message,
    });
} 
