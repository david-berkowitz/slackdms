import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { slackApi, slackGet } from "@/lib/slack";

type ConversationsListResponse = {
  ok: boolean;
  channels?: Array<{
    id: string;
    name: string;
    is_private: boolean;
    is_archived: boolean;
  }>;
  response_metadata?: { next_cursor?: string };
  error?: string;
};

export async function POST(request: Request) {
  const { team_id } = (await request.json()) as { team_id?: string };
  if (!team_id) {
    return NextResponse.json({ error: "Missing team_id." }, { status: 400 });
  }

  const { data: workspace } = await supabaseAdmin
    .from("workspaces")
    .select("bot_access_token")
    .eq("team_id", team_id)
    .single();

  if (!workspace?.bot_access_token) {
    return NextResponse.json(
      { error: "Workspace missing bot token." },
      { status: 400 }
    );
  }

  const list = await slackGet<ConversationsListResponse>({
    token: workspace.bot_access_token,
    method: "conversations.list",
    params: { types: "public_channel", limit: "200" },
  });

  if (!list.ok || !list.channels) {
    return NextResponse.json(
      { error: list.error ?? "Unable to list channels." },
      { status: 500 }
    );
  }

  await supabaseAdmin.from("channels").upsert(
    list.channels.map((channel) => ({
      team_id,
      channel_id: channel.id,
      name: channel.name,
      is_private: channel.is_private,
      is_archived: channel.is_archived,
    })),
    { onConflict: "team_id,channel_id" }
  );

  await Promise.all(
    list.channels.map((channel) =>
      slackApi({
        token: workspace.bot_access_token,
        method: "conversations.join",
        body: { channel: channel.id },
      }).catch(() => null)
    )
  );

  return NextResponse.json({ ok: true, count: list.channels.length });
}
