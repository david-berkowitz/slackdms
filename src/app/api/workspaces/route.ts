import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const { data: workspaces, error } = await supabaseAdmin
    .from("workspaces")
    .select("team_id,team_name")
    .order("team_name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Unable to load workspaces." }, { status: 500 });
  }

  return NextResponse.json({ workspaces: workspaces ?? [] });
}
