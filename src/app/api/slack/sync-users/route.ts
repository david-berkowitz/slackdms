import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { slackGet } from "@/lib/slack";

type UsersListResponse = {
  ok: boolean;
  members?: Array<{
    id: string;
    profile: { display_name: string; real_name: string };
    created?: number;
    is_bot: boolean;
    deleted: boolean;
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

  const response = await slackGet<UsersListResponse>({
    token: workspace.bot_access_token,
    method: "users.list",
    params: { limit: "200" },
  });

  if (!response.ok || !response.members) {
    return NextResponse.json(
      { error: response.error ?? "Unable to list users." },
      { status: 500 }
    );
  }

  await supabaseAdmin.from("users").upsert(
    response.members.map((member) => ({
      team_id,
      user_id: member.id,
      display_name: member.profile?.display_name ?? null,
      real_name: member.profile?.real_name ?? null,
      is_bot: member.is_bot,
      deleted: member.deleted,
      profile: member.profile ?? null,
      user_created_at: member.created ? new Date(member.created * 1000).toISOString() : null,
    })),
    { onConflict: "team_id,user_id" }
  );

  return NextResponse.json({ ok: true, count: response.members.length });
}
