import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("team_id");
  const channelId = searchParams.get("channel_id");
  const days = Number(searchParams.get("days") ?? "90");

  if (!teamId) {
    return NextResponse.json(
      { error: "Missing team_id query parameter." },
      { status: 400 }
    );
  }

  const lookback = Number.isFinite(days) ? days : 90;
  const since = new Date(Date.now() - lookback * 24 * 60 * 60 * 1000)
    .toISOString();

  let activity: Array<{
    user_id: string;
    last_activity_at: string | null;
    channel_id?: string | null;
  }> = [];
  let error: { message?: string } | null = null;

  if (channelId) {
    const result = await supabaseAdmin
      .from("user_channel_activity")
      .select("user_id,last_activity_at,channel_id")
      .eq("team_id", teamId)
      .eq("channel_id", channelId)
      .gte("last_activity_at", since)
      .order("last_activity_at", { ascending: false })
      .limit(250);
    activity = result.data ?? [];
    error = result.error;
  } else {
    const result = await supabaseAdmin
      .from("user_activity")
      .select("user_id,last_activity_at")
      .eq("team_id", teamId)
      .gte("last_activity_at", since)
      .order("last_activity_at", { ascending: false })
      .limit(250);
    activity = result.data ?? [];
    error = result.error;
  }

  if (error) {
    return NextResponse.json(
      { error: "Unable to load activity." },
      { status: 500 }
    );
  }

  const userIds = [...new Set(activity?.map((item) => item.user_id) ?? [])];
  const { data: users } = await supabaseAdmin
    .from("users")
    .select("user_id,display_name,real_name")
    .eq("team_id", teamId)
    .in("user_id", userIds);

  const userMap = new Map(
    (users ?? []).map((user) => [user.user_id, user])
  );

  const response = (activity ?? []).map((item) => ({
    user_id: item.user_id,
    display_name: userMap.get(item.user_id)?.display_name ?? null,
    real_name: userMap.get(item.user_id)?.real_name ?? null,
    last_activity_at: item.last_activity_at,
    channel_name: channelId ? channelId : null,
  }));

  return NextResponse.json({ users: response });
}
