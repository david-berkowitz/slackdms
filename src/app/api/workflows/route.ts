import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type WorkflowPayload = {
  id?: string;
  team_id: string;
  name: string;
  trigger: string;
  sender_user_id?: string | null;
  channel_id?: string | null;
  message_template: string;
  is_active?: boolean;
};

function isLegacyWorkflowSchemaError(message?: string) {
  if (!message) return false;
  return (
    message.includes("dm_workflows.channel_id") ||
    message.includes("dm_workflows.sender_user_id")
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("team_id");

  if (!teamId) {
    return NextResponse.json({ error: "Missing team_id." }, { status: 400 });
  }

  const { data: workflows, error } = await supabaseAdmin
    .from("dm_workflows")
    .select("id,name,trigger,channel_id,sender_user_id,message_template,is_active,created_at")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });

  if (error && isLegacyWorkflowSchemaError(error.message)) {
    const { data: legacyWorkflows, error: legacyError } = await supabaseAdmin
      .from("dm_workflows")
      .select("id,name,trigger,message_template,is_active,created_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });

    if (legacyError) {
      return NextResponse.json({ error: "Unable to load workflows." }, { status: 500 });
    }

    const normalized = (legacyWorkflows ?? []).map((workflow) => ({
      ...workflow,
      channel_id: null,
      sender_user_id: null,
    }));
    return NextResponse.json({ workflows: normalized });
  }

  if (error) {
    return NextResponse.json({ error: "Unable to load workflows." }, { status: 500 });
  }

  return NextResponse.json({ workflows: workflows ?? [] });
}

export async function POST(request: Request) {
  const payload = (await request.json()) as WorkflowPayload;

  if (!payload.team_id || !payload.name || !payload.trigger || !payload.message_template) {
    return NextResponse.json(
      { error: "Missing team_id, name, trigger, or message_template." },
      { status: 400 }
    );
  }

  const fullInsert = {
    team_id: payload.team_id,
    name: payload.name,
    trigger: payload.trigger,
    channel_id: payload.channel_id ?? null,
    sender_user_id: payload.sender_user_id ?? null,
    message_template: payload.message_template,
    is_active: payload.is_active ?? true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: workflow, error } = await supabaseAdmin
    .from("dm_workflows")
    .insert(fullInsert)
    .select("id")
    .single();

  if (error && isLegacyWorkflowSchemaError(error.message)) {
    const { data: legacyWorkflow, error: legacyError } = await supabaseAdmin
      .from("dm_workflows")
      .insert({
        team_id: payload.team_id,
        name: payload.name,
        trigger: payload.trigger,
        message_template: payload.message_template,
        is_active: payload.is_active ?? true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (legacyError || !legacyWorkflow) {
      return NextResponse.json({ error: "Unable to create workflow." }, { status: 500 });
    }

    return NextResponse.json({ id: legacyWorkflow.id });
  }

  if (error || !workflow) {
    return NextResponse.json({ error: "Unable to create workflow." }, { status: 500 });
  }

  return NextResponse.json({ id: workflow.id });
}

export async function PUT(request: Request) {
  const payload = (await request.json()) as WorkflowPayload;

  if (!payload.id || !payload.team_id) {
    return NextResponse.json({ error: "Missing id or team_id." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("dm_workflows")
    .update({
      name: payload.name,
      trigger: payload.trigger,
      channel_id: payload.channel_id ?? null,
      sender_user_id: payload.sender_user_id ?? null,
      message_template: payload.message_template,
      is_active: payload.is_active ?? true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payload.id)
    .eq("team_id", payload.team_id);

  if (error && isLegacyWorkflowSchemaError(error.message)) {
    const { error: legacyError } = await supabaseAdmin
      .from("dm_workflows")
      .update({
        name: payload.name,
        trigger: payload.trigger,
        message_template: payload.message_template,
        is_active: payload.is_active ?? true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.id)
      .eq("team_id", payload.team_id);

    if (legacyError) {
      return NextResponse.json({ error: "Unable to update workflow." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  if (error) {
    return NextResponse.json({ error: "Unable to update workflow." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
