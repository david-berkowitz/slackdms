import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { slackApi, verifySlackSignature } from "@/lib/slack";

type SlackEventPayload = {
  type: string;
  challenge?: string;
  team_id?: string;
  event?: {
    type: string;
    user?: string | { id?: string };
    channel?: string;
    item?: {
      type: string;
      channel?: string;
    };
    item_user?: string;
    subtype?: string;
  };
};

type Workflow = {
  id: string;
  trigger: string;
  sender_user_id: string | null;
  channel_id: string | null;
  message_template: string;
};

function resolveUserId(user: string | { id?: string } | undefined) {
  if (!user) {
    return null;
  }
  if (typeof user === "string") {
    return user;
  }
  return user.id ?? null;
}

async function sendWorkflowMessage({
  teamId,
  userId,
  channelId,
  workflow,
}: {
  teamId: string;
  userId: string;
  channelId?: string | null;
  workflow: Workflow;
}) {
  const { data: workspace } = await supabaseAdmin
    .from("workspaces")
    .select("authed_user_token")
    .eq("team_id", teamId)
    .single();

  let senderToken = workspace?.authed_user_token ?? null;

  if (workflow.sender_user_id) {
    const { data: sender } = await supabaseAdmin
      .from("workspace_senders")
      .select("access_token")
      .eq("team_id", teamId)
      .eq("user_id", workflow.sender_user_id)
      .single();
    if (sender?.access_token) {
      senderToken = sender.access_token;
    }
  }

  if (!senderToken) {
    return;
  }

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("display_name,real_name,is_bot,deleted")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .single();

  if (user?.is_bot || user?.deleted) {
    return;
  }

  const firstName = user?.real_name?.split(" ")[0] ?? user?.display_name ?? "there";
  const message = workflow.message_template
    .replaceAll("{{first_name}}", firstName)
    .replaceAll("{{display_name}}", user?.display_name ?? firstName)
    .replaceAll("{{real_name}}", user?.real_name ?? firstName)
    .replaceAll("{{channel_id}}", channelId ?? "");

  const open = await slackApi<{ ok: boolean; channel?: { id: string }; error?: string }>({
    token: senderToken,
    method: "conversations.open",
    body: { users: userId },
  });

  if (!open.ok || !open.channel?.id) {
    return;
  }

  await slackApi({
    token: senderToken,
    method: "chat.postMessage",
    body: { channel: open.channel.id, text: message },
  });
}

async function triggerWorkflows({
  teamId,
  trigger,
  userId,
  channelId,
}: {
  teamId: string;
  trigger: string;
  userId: string;
  channelId?: string | null;
}) {
  const { data: workflows } = await supabaseAdmin
    .from("dm_workflows")
    .select("id,trigger,channel_id,sender_user_id,message_template")
    .eq("team_id", teamId)
    .eq("trigger", trigger)
    .eq("is_active", true);

  if (!workflows?.length) {
    return;
  }

  const filtered = workflows.filter((workflow) => {
    if (!workflow.channel_id) {
      return true;
    }
    return channelId ? workflow.channel_id === channelId : false;
  });

  for (const workflow of filtered) {
    await sendWorkflowMessage({
      teamId,
      userId,
      channelId,
      workflow,
    });
  }
}

export async function POST(request: Request) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    return NextResponse.json(
      { error: "Missing SLACK_SIGNING_SECRET." },
      { status: 500 }
    );
  }

  const rawBody = await request.text();
  const timestamp = request.headers.get("x-slack-request-timestamp");
  const signature = request.headers.get("x-slack-signature");

  const isValid = verifySlackSignature({
    signingSecret,
    timestamp,
    signature,
    rawBody,
  });

  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as SlackEventPayload;

  if (payload.type === "url_verification" && payload.challenge) {
    return NextResponse.json({ challenge: payload.challenge });
  }

  if (!payload.event || !payload.team_id) {
    return NextResponse.json({ ok: true });
  }

  const event = payload.event;
  if (event.type === "message" && event.subtype) {
    return NextResponse.json({ ok: true });
  }

  const teamId = payload.team_id;

  if (event.type === "team_join") {
    const userId = resolveUserId(event.user);
    if (userId) {
      await triggerWorkflows({ teamId, trigger: "team_join", userId });
    }
    return NextResponse.json({ ok: true });
  }

  if (event.type === "member_joined_channel") {
    const userId = resolveUserId(event.user);
    const channelId = event.channel;
    if (userId && channelId) {
      await triggerWorkflows({
        teamId,
        trigger: "member_joined_channel",
        userId,
        channelId,
      });
    }
    return NextResponse.json({ ok: true });
  }

  let userId: string | undefined;
  let channelId: string | undefined;

  if (event.type === "message") {
    const resolved = resolveUserId(event.user);
    if (resolved) {
      userId = resolved;
    }
    channelId = event.channel;
  }

  if (event.type === "reaction_added") {
    const resolved = resolveUserId(event.user);
    if (resolved) {
      userId = resolved;
    }
    channelId = event.item?.channel;
  }

  if (!userId || !channelId) {
    return NextResponse.json({ ok: true });
  }

  const now = new Date().toISOString();

  await supabaseAdmin.from("user_activity").upsert(
    {
      team_id: teamId,
      user_id: userId,
      last_activity_at: now,
    },
    { onConflict: "team_id,user_id" }
  );

  await supabaseAdmin.from("user_channel_activity").upsert(
    {
      team_id: teamId,
      user_id: userId,
      channel_id: channelId,
      last_activity_at: now,
    },
    { onConflict: "team_id,user_id,channel_id" }
  );

  return NextResponse.json({ ok: true });
}
