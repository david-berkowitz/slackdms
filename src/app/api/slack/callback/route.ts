import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { slackApi, slackGet } from "@/lib/slack";

type OAuthResponse = {
  ok: boolean;
  access_token?: string;
  token_type?: string;
  team?: { id: string; name: string };
  bot_user_id?: string;
  authed_user?: { id: string; access_token?: string; scope?: string };
  error?: string;
};

type ConversationsListResponse = {
  ok: boolean;
  channels?: Array<{ id: string; name: string; is_private: boolean }>;
  response_metadata?: { next_cursor?: string };
  error?: string;
};

const shouldAutoJoinChannels =
  process.env.SLACK_AUTO_JOIN_CHANNELS?.toLowerCase() === "true";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectUri = process.env.SLACK_REDIRECT_URI;
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;

  if (!code) {
    return NextResponse.json({ error: "Missing OAuth code." }, { status: 400 });
  }

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      { error: "Missing Slack OAuth configuration." },
      { status: 500 }
    );
  }

  const oauthBody = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });

  const oauthRes = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: oauthBody.toString(),
  });

  const oauthResponse = (await oauthRes.json()) as OAuthResponse;

  if (!oauthResponse.ok || !oauthResponse.team?.id) {
    return NextResponse.json(
      { error: oauthResponse.error ?? "Slack OAuth failed." },
      { status: 400 }
    );
  }

  const teamId = oauthResponse.team.id;
  const teamName = oauthResponse.team.name ?? null;
  const botToken = oauthResponse.access_token ?? null;
  const botUserId = oauthResponse.bot_user_id ?? null;
  const authedUser = oauthResponse.authed_user ?? null;

  const { error: upsertError } = await supabaseAdmin
    .from("workspaces")
    .upsert({
      team_id: teamId,
      team_name: teamName,
      bot_access_token: botToken,
      bot_user_id: botUserId,
      authed_user_id: authedUser?.id ?? null,
      authed_user_token: authedUser?.access_token ?? null,
      installed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (upsertError) {
    return NextResponse.json(
      { error: "Failed to store workspace install." },
      { status: 500 }
    );
  }

  if (botToken) {
    const list = await slackGet<ConversationsListResponse>({
      token: botToken,
      method: "conversations.list",
      params: { types: "public_channel", limit: "200" },
    });

    if (list.ok && list.channels?.length) {
      const channels = list.channels.map((channel) => ({
        team_id: teamId,
        channel_id: channel.id,
        name: channel.name,
        is_private: channel.is_private,
      }));

      await supabaseAdmin.from("channels").upsert(channels, {
        onConflict: "team_id,channel_id",
      });

      if (shouldAutoJoinChannels) {
        await Promise.all(
          list.channels.map((channel) =>
            slackApi({
              token: botToken,
              method: "conversations.join",
              body: { channel: channel.id },
            }).catch(() => null)
          )
        );
      }
    }
  }


  if (authedUser?.id && authedUser?.access_token) {
    let displayName: string | null = null;
    let realName: string | null = null;

    if (botToken) {
      const profile = await slackGet<{ ok: boolean; user?: { profile?: { display_name?: string; real_name?: string } } }>({
        token: botToken,
        method: "users.info",
        params: { user: authedUser.id },
      });
      if (profile.ok && profile.user?.profile) {
        displayName = profile.user.profile.display_name ?? null;
        realName = profile.user.profile.real_name ?? null;
      }
    }

    await supabaseAdmin.from("workspace_senders").upsert(
      {
        team_id: teamId,
        user_id: authedUser.id,
        access_token: authedUser.access_token,
        display_name: displayName,
        real_name: realName,
        created_at: new Date().toISOString(),
      },
      { onConflict: "team_id,user_id" }
    );
  }
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "/";
  return NextResponse.redirect(`${baseUrl}/admin`);
}
