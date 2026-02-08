import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type CreateJobPayload = {
  team_id: string;
  channel_id?: string | null;
  days?: number;
  message_template: string;
  sender_user_id?: string | null;
  limit?: number;
};

export async function POST(request: Request) {
  const payload = (await request.json()) as CreateJobPayload;

  if (!payload.team_id || !payload.message_template) {
    return NextResponse.json(
      { error: "Missing team_id or message_template." },
      { status: 400 }
    );
  }

  const lookback = payload.days ?? 90;
  const since = new Date(Date.now() - lookback * 24 * 60 * 60 * 1000)
    .toISOString();
  const limit = Math.min(payload.limit ?? 100, 100);

  const { data: workspace } = await supabaseAdmin
    .from("workspaces")
    .select("authed_user_id")
    .eq("team_id", payload.team_id)
    .single();

  const activityTable = payload.channel_id
    ? "user_channel_activity"
    : "user_activity";
  let activityQuery = supabaseAdmin
    .from(activityTable)
    .select("user_id,last_activity_at,channel_id")
    .eq("team_id", payload.team_id)
    .gte("last_activity_at", since)
    .order("last_activity_at", { ascending: false })
    .limit(limit);

  if (payload.channel_id) {
    activityQuery = activityQuery.eq("channel_id", payload.channel_id);
  }

  const { data: activity, error: activityError } = await activityQuery;
  if (activityError) {
    return NextResponse.json(
      { error: "Unable to load active users." },
      { status: 500 }
    );
  }

  const userIds = [...new Set(activity?.map((item) => item.user_id) ?? [])];
  const { data: users } = await supabaseAdmin
    .from("users")
    .select("user_id,is_bot,deleted")
    .eq("team_id", payload.team_id)
    .in("user_id", userIds);

  const allowed = new Set(
    (users ?? [])
      .filter((user) => !user.is_bot && !user.deleted)
      .map((user) => user.user_id)
  );

  const recipients = (activity ?? [])
    .filter((item) => allowed.has(item.user_id))
    .map((item) => ({
      user_id: item.user_id,
    }));

  const { data: job, error: jobError } = await supabaseAdmin
    .from("dm_jobs")
    .insert({
      team_id: payload.team_id,
      created_by: workspace?.authed_user_id ?? null,
      sender_user_id: payload.sender_user_id ?? null,
      message_template: payload.message_template,
      status: "queued",
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (jobError || !job) {
    return NextResponse.json(
      { error: "Unable to create DM job." },
      { status: 500 }
    );
  }

  if (recipients.length) {
    await supabaseAdmin.from("dm_job_recipients").insert(
      recipients.map((recipient) => ({
        job_id: job.id,
        user_id: recipient.user_id,
        status: "queued",
      }))
    );
  }

  return NextResponse.json({ job_id: job.id, count: recipients.length });
}
