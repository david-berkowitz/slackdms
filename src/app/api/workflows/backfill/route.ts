import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { slackApi } from "@/lib/slack";

type BackfillPayload = {
  team_id: string;
  workflow_id: string;
  days?: number;
  limit?: number;
};

function applyTemplate({
  template,
  displayName,
  realName,
}: {
  template: string;
  displayName?: string | null;
  realName?: string | null;
}) {
  const firstName = realName?.split(" ")[0] ?? displayName ?? "there";
  return template
    .replaceAll("{{first_name}}", firstName)
    .replaceAll("{{display_name}}", displayName ?? firstName)
    .replaceAll("{{real_name}}", realName ?? firstName);
}

export async function POST(request: Request) {
  const payload = (await request.json()) as BackfillPayload;

  if (!payload.team_id || !payload.workflow_id) {
    return NextResponse.json(
      { error: "Missing team_id or workflow_id." },
      { status: 400 }
    );
  }

  let { data: workflow } = await supabaseAdmin
    .from("dm_workflows")
    .select("id,team_id,trigger,sender_user_id,message_template,is_active")
    .eq("id", payload.workflow_id)
    .eq("team_id", payload.team_id)
    .single();

  if (!workflow) {
    const { data: legacyWorkflow } = await supabaseAdmin
      .from("dm_workflows")
      .select("id,team_id,trigger,message_template,is_active")
      .eq("id", payload.workflow_id)
      .eq("team_id", payload.team_id)
      .single();

    workflow = legacyWorkflow
      ? { ...legacyWorkflow, sender_user_id: null }
      : null;
  }

  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found." }, { status: 404 });
  }

  if (workflow.trigger !== "team_join") {
    return NextResponse.json(
      { error: "Backfill is only supported for team_join workflows." },
      { status: 400 }
    );
  }

  if (!workflow.is_active) {
    return NextResponse.json(
      { error: "Workflow is inactive." },
      { status: 400 }
    );
  }

  const { data: workspace } = await supabaseAdmin
    .from("workspaces")
    .select("authed_user_token")
    .eq("team_id", payload.team_id)
    .single();

  let senderToken = workspace?.authed_user_token ?? null;

  if (workflow.sender_user_id) {
    const { data: sender } = await supabaseAdmin
      .from("workspace_senders")
      .select("access_token")
      .eq("team_id", payload.team_id)
      .eq("user_id", workflow.sender_user_id)
      .single();
    if (sender?.access_token) {
      senderToken = sender.access_token;
    }
  }

  if (!senderToken) {
    return NextResponse.json(
      { error: "Missing sender token." },
      { status: 400 }
    );
  }

  const lookback = payload.days ?? 30;
  const since = new Date(Date.now() - lookback * 24 * 60 * 60 * 1000)
    .toISOString();
  const limit = Math.min(payload.limit ?? 100, 200);

  const { data: candidates } = await supabaseAdmin
    .from("users")
    .select("user_id,display_name,real_name,is_bot,deleted,user_created_at")
    .eq("team_id", payload.team_id)
    .gte("user_created_at", since)
    .order("user_created_at", { ascending: false })
    .limit(limit);

  if (!candidates?.length) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  const { data: existing } = await supabaseAdmin
    .from("workflow_sends")
    .select("user_id")
    .eq("workflow_id", workflow.id);

  const sentSet = new Set((existing ?? []).map((row) => row.user_id));

  let processed = 0;

  for (const candidate of candidates) {
    if (candidate.is_bot || candidate.deleted) {
      continue;
    }
    if (sentSet.has(candidate.user_id)) {
      continue;
    }

    const message = applyTemplate({
      template: workflow.message_template,
      displayName: candidate.display_name ?? null,
      realName: candidate.real_name ?? null,
    });

    const open = await slackApi<{ ok: boolean; channel?: { id: string } }>(
      {
        token: senderToken,
        method: "conversations.open",
        body: { users: candidate.user_id },
      }
    );

    if (!open.ok || !open.channel?.id) {
      continue;
    }

    const send = await slackApi<{ ok: boolean }>({
      token: senderToken,
      method: "chat.postMessage",
      body: { channel: open.channel.id, text: message },
    });

    if (!send.ok) {
      continue;
    }

    await supabaseAdmin.from("workflow_sends").insert({
      workflow_id: workflow.id,
      team_id: payload.team_id,
      user_id: candidate.user_id,
      sent_at: new Date().toISOString(),
    });

    processed += 1;
  }

  return NextResponse.json({ ok: true, processed });
}
