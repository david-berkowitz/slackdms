import { NextResponse } from "next/server";

const defaultBotScopes = [
  "channels:read",
  "channels:join",
  "channels:history",
  "groups:read",
  "groups:history",
  "im:read",
  "im:history",
  "mpim:read",
  "mpim:history",
  "reactions:read",
  "users:read",
  "users:read.email",
  "team:read",
  "chat:write",
  "chat:write.public",
  "chat:write.customize",
  "commands",
  "files:read",
  "usergroups:read",
  "usergroups:write",
];

const defaultUserScopes = [
  "channels:read",
  "channels:history",
  "groups:read",
  "groups:history",
  "im:read",
  "im:history",
  "mpim:read",
  "mpim:history",
  "reactions:read",
  "users:read",
  "users:read.email",
  "team:read",
  "chat:write",
  "chat:write.public",
  "chat:write.customize",
  "channels:write",
  "groups:write",
  "im:write",
  "mpim:write",
  "usergroups:write",
  "files:read",
];

export async function GET() {
  const clientId = process.env.SLACK_CLIENT_ID;
  const redirectUri = process.env.SLACK_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Missing SLACK_CLIENT_ID or SLACK_REDIRECT_URI." },
      { status: 500 }
    );
  }

  const scope =
    process.env.SLACK_BOT_SCOPES ?? defaultBotScopes.join(",");
  const userScope =
    process.env.SLACK_USER_SCOPES ?? defaultUserScopes.join(",");

  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", scope);
  url.searchParams.set("user_scope", userScope);
  url.searchParams.set("redirect_uri", redirectUri);

  return NextResponse.redirect(url.toString());
}
