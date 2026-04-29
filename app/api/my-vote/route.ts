import { NextResponse } from "next/server";
import {
  createAdminSupabaseServerClient,
  createPublicSupabaseServerClient
} from "@/lib/supabase-server";
import type { VoteRecord } from "@/lib/types";

export async function GET(request: Request) {
  try {
    const accessToken = request.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "");

    if (!accessToken) {
      return NextResponse.json({ vote: null });
    }

    const supabase = createPublicSupabaseServerClient();
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json({ vote: null });
    }

    const { data: state, error: stateError } = await supabase
      .from("app_state")
      .select("phase_number, phase_mode")
      .eq("id", 1)
      .single();

    const liveState = state as { phase_number: number; phase_mode: string } | null;

    if (stateError || !liveState || liveState.phase_mode === "closed") {
      return NextResponse.json({ vote: null });
    }

    const adminSupabase = createAdminSupabaseServerClient();
    const { data: vote, error: voteError } = await adminSupabase
      .from("votes")
      .select("contestant_id, phase_number, mode")
      .eq("phase_number", liveState.phase_number)
      .eq("mode", liveState.phase_mode)
      .eq("voter_id", user.id)
      .maybeSingle();

    if (voteError) {
      console.error("Failed to fetch viewer vote", voteError);
      return NextResponse.json(
        { error: "Unable to load your vote right now." },
        { status: 500 }
      );
    }

    return NextResponse.json({ vote: (vote as VoteRecord | null) ?? null });
  } catch (error) {
    console.error("Viewer vote lookup failed", error);
    return NextResponse.json(
      { error: "Unable to load your vote right now." },
      { status: 500 }
    );
  }
}
