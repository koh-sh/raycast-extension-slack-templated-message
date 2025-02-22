import { OAuthService } from "@raycast/utils";

export const slack = OAuthService.slack({
    scope: "chat:write channels:read groups:read",
});

export const SLACK_API_ERROR_CODES = {
    NOT_IN_CHANNEL: "not_in_channel",
    CHANNEL_NOT_FOUND: "channel_not_found",
} as const; 
