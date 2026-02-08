import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { slackApi } from "@/lib/slack";

type RunJobPayload = {
  job_id: string;
  batch_size?: number;
};

type SlackOpenResponse = {
  ok: boolean;
  channel?: { id: string };
  error?: string;
};

type SlackPostResponse = {
  ok: boolean;
  error?: string;
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
  const payload = (await request.json()) as RunJobPayload;
  if (!payload.job_id) {
    return NextResponse.json(
      { error: "Missing job_id." },
      { status: 400 }
    );
  }

  const { data: job } = await supabaseAdmin
    .from("dm_jobs")
    .select("id,team_id,message_template,status,sender_user_id")
    .eq("id", payload.job_id)
    .single();

  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  const { data: workspace } = await supabaseAdmin
    .from("workspaces")
    .select("authed_user_token")
    .eq("team_id", job.team_id)
    .single();

  let senderToken = workspace?.authed_user_token ?? null;

  if (job.sender_user_id) {
    const { data: sender } = await supabaseAdmin
      .from("workspace_senders")
      .select("access_token")
      .eq("team_id", job.team_id)
      .eq("user_id", job.sender_user_id)
      .single();
    if (sender?.access_token) {
      senderToken = sender.access_token;
    }
  }

  if (!senderToken) {
    return NextResponse.json(
      { error: "Workspace missing sender token." },
      { status: 400 }
    );
  }

  const batchSize = Math.min(payload.batch_size ?? 20, 50);
  const { data: recipients } = await supabaseAdmin
    .from("dm_job_recipients")
    .select("id,user_id")
    .eq("job_id", job.id)
    .eq("status", "queued")
    .limit(batchSize);

  if (!recipients?.length) {
    await supabaseAdmin
      .from("dm_jobs")
      .update({ status: "done" })
      .eq("id", job.id);
    return NextResponse.json({ ok: true, processed: 0 });
  }

  const userIds = recipients.map((recipient) => recipient.user_id);
  const { data: users } = await supabaseAdmin
    .from("users")
    .select("user_id,display_name,real_name")
    .eq("team_id", job.team_id)
    .in("user_id", userIds);

  const userMap = new Map(
    (users ?? []).map((user) => [user.user_id, user])
  );

  let processed = 0;

  for (const recipient of recipients) {
    const user = userMap.get(recipient.user_id);
    const message = applyTemplate({
      template: job.message_template,
      displayName: user?.display_name ?? null,
      realName: user?.real_name ?? null,
    });

    try {
      const open = await slackApi<SlackOpenResponse>({
        token: senderToken,
        method: "conversations.open",
        body: { users: recipient.user_id },
      });

      if (!open.ok || !open.channel?.id) {
        throw new Error(open.error ?? "Failed to open DM.");
      }

      const send = await slackApi<SlackPostResponse>({
        token: senderToken,
        method: "chat.postMessage",
        body: { channel: open.channel.id, text: message },
      });

      if (!send.ok) {
        throw new Error(send.error ?? "Failed to send DM.");
      }

      await supabaseAdmin
        .from("dm_job_recipients")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", recipient.id);
      processed += 1;
    } catch (error) {
      await supabaseAdmin
        .from("dm_job_recipients")
        .update({
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        })
        .eq("id", recipient.id);
    }
  }

  await supabaseAdmin
    .from("dm_jobs")
    .update({ status: "running" })
    .eq("id", job.id);

  return NextResponse.json({ ok: true, processed });
}
