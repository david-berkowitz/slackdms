import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("team_id");

  if (!teamId) {
    return NextResponse.json({ error: "Missing team_id." }, { status: 400 });
  }

  const { data: channels, error } = await supabaseAdmin
    .from("channels")
    .select("channel_id,name,is_private")
    .eq("team_id", teamId)
    .eq("is_archived", false)
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Unable to load channels." }, { status: 500 });
  }

  return NextResponse.json({ channels: channels ?? [] });
}
