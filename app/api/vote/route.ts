import { NextResponse } from "next/server";
import { createAdminSupabaseServerClient, createPublicSupabaseServerClient } from "@/lib/supabase-server";

interface VoteRequestBody {
  contestantId?: string;
}

export async function POST(request: Request) {
  try {
    const accessToken = request.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "");
    const body = (await request.json()) as VoteRequestBody;

    if (!accessToken) {
      return NextResponse.json(
        { error: "Please sign in with Google before voting." },
        { status: 401 }
      );
    }

    if (!body.contestantId) {
      return NextResponse.json(
        { error: "Select a contestant before submitting." },
        { status: 400 }
      );
    }

    const publicSupabase = createPublicSupabaseServerClient();
    const {
      data: { user },
      error: userError
    } = await publicSupabase.auth.getUser(accessToken);

    if (userError || !user?.email) {
      return NextResponse.json(
        { error: "Your session expired. Please sign in again." },
        { status: 401 }
      );
    }

    const adminSupabase = createAdminSupabaseServerClient();
    const { data: state, error: stateError } = await adminSupabase
      .from("app_state")
      .select("phase_mode, phase_number")
      .eq("id", 1)
      .single();

    const liveState = state as
      | { phase_mode: "closed" | "elimination" | "revival"; phase_number: number }
      | null;

    if (stateError || !liveState) {
      return NextResponse.json(
        { error: "The event state could not be loaded." },
        { status: 500 }
      );
    }

    if (liveState.phase_mode === "closed") {
      return NextResponse.json(
        { error: "Voting is not open right now." },
        { status: 400 }
      );
    }

    const { data: contestant, error: contestantError } = await adminSupabase
      .from("contestants")
      .select("id, is_selectable")
      .eq("id", body.contestantId)
      .single();

    const ballotContestant = contestant as { id: string; is_selectable: boolean } | null;

    if (contestantError || !ballotContestant?.is_selectable) {
      return NextResponse.json(
        { error: "That contestant is not available in this round." },
        { status: 400 }
      );
    }

    const { error: insertError } = await adminSupabase.from("votes").insert({
      contestant_id: body.contestantId,
      phase_number: liveState.phase_number,
      mode: liveState.phase_mode,
      voter_id: user.id,
      voter_email: user.email
    });

    if (insertError?.code === "23505") {
      return NextResponse.json(
        { error: "You already submitted a vote for this round." },
        { status: 409 }
      );
    }

    if (insertError) {
      console.error("Vote insert failed", insertError);
      return NextResponse.json(
        { error: "We could not save your vote right now." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Vote submission failed", error);
    return NextResponse.json(
      { error: "We could not save your vote right now." },
      { status: 500 }
    );
  }
}
