export interface Channel {
  id: string;
  name: string;
}

export interface ToastOptions {
  style: "success" | "failure";
  title: string;
  message?: string;
}

export interface SlackError {
  data?: {
    error: string;
  };
  message?: string;
}
