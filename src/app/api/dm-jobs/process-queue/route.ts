import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type QueuePayload = {
  team_id?: string;
  max_jobs?: number;
  batch_size?: number;
};

type RunResponse = {
  ok?: boolean;
  processed?: number;
  error?: string;
};

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as QueuePayload;
  const maxJobs = Math.min(Math.max(payload.max_jobs ?? 3, 1), 10);
  const batchSize = Math.min(Math.max(payload.batch_size ?? 20, 1), 50);

  let query = supabaseAdmin
    .from("dm_jobs")
    .select("id,team_id,status")
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: true })
    .limit(maxJobs);

  if (payload.team_id) {
    query = query.eq("team_id", payload.team_id);
  }

  const { data: jobs, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Unable to load queued jobs." }, { status: 500 });
  }

  if (!jobs?.length) {
    return NextResponse.json({ ok: true, jobs_processed: 0, messages_sent: 0 });
  }

  const origin = new URL(request.url).origin;
  let messagesSent = 0;
  let jobsProcessed = 0;

  for (const job of jobs) {
    const run = await fetch(`${origin}/api/dm-jobs/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: job.id, batch_size: batchSize }),
    });

    const runData = (await run.json().catch(() => ({}))) as RunResponse;
    if (run.ok) {
      jobsProcessed += 1;
      messagesSent += runData.processed ?? 0;
    }
  }

  return NextResponse.json({ ok: true, jobs_processed: jobsProcessed, messages_sent: messagesSent });
}
