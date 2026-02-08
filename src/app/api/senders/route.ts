import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("team_id");

  if (!teamId) {
    return NextResponse.json({ error: "Missing team_id." }, { status: 400 });
  }

  const { data: senders, error } = await supabaseAdmin
    .from("workspace_senders")
    .select("user_id,display_name,real_name")
    .eq("team_id", teamId)
    .order("display_name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Unable to load senders." }, { status: 500 });
  }

  return NextResponse.json({ senders: senders ?? [] });
}
