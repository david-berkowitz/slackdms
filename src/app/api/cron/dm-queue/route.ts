import { NextResponse } from "next/server";

function isAuthorized(request: Request, secret: string) {
  const authHeader = request.headers.get("authorization");
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");

  if (authHeader === `Bearer ${secret}`) {
    return true;
  }

  return querySecret === secret;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Missing CRON_SECRET." }, { status: 500 });
  }

  if (!isAuthorized(request, secret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const origin = new URL(request.url).origin;
  const run = await fetch(`${origin}/api/dm-jobs/process-queue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ max_jobs: 5, batch_size: 20 }),
  });

  const runData = await run.json().catch(() => ({}));
  if (!run.ok) {
    return NextResponse.json({ error: runData?.error ?? "Queue run failed." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...runData });
}
