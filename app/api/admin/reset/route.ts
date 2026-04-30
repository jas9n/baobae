import { NextResponse } from "next/server";
import { authorizeAdmin, unauthorizedResponse } from "@/lib/admin-auth";
import { createAdminSupabaseServerClient } from "@/lib/supabase-server";

interface ResetBody {
  accessToken?: string | null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ResetBody;
    const auth = await authorizeAdmin(request, body.accessToken);

    if (!auth.authorized) {
      return unauthorizedResponse();
    }

    const supabase = createAdminSupabaseServerClient();
    const { data: state, error: stateError } = await supabase
      .from("app_state")
      .select("phase_number")
      .eq("id", 1)
      .single();

    const currentState = state as { phase_number: number } | null;

    if (stateError || !currentState) {
      return NextResponse.json(
        { error: "Unable to load the current round." },
        { status: 500 }
      );
    }

    const nextPhaseNumber = currentState.phase_number + 1;

    const { error: stateUpdateError } = await supabase
      .from("app_state")
      .update({
        phase_number: nextPhaseNumber,
        phase_mode: "closed",
        headline: `Round ${nextPhaseNumber} is standing by`,
        subheadline: "Production can now choose the next live vote.",
        updated_at: new Date().toISOString()
      })
      .eq("id", 1);

    if (stateUpdateError) {
      console.error("Round reset failed", stateUpdateError);
      return NextResponse.json(
        { error: "Unable to reset the round." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, phaseNumber: nextPhaseNumber });
  } catch (error) {
    console.error("Round reset failed", error);
    return NextResponse.json(
      { error: "Unable to reset the round." },
      { status: 500 }
    );
  }
}
