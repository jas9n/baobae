import { NextResponse } from "next/server";
import { authorizeAdmin, unauthorizedResponse } from "@/lib/admin-auth";
import { createAdminSupabaseServerClient } from "@/lib/supabase-server";
import type { PhaseMode } from "@/lib/types";

interface PhaseBody {
  accessToken?: string | null;
  phaseMode?: PhaseMode;
  headline?: string;
  subheadline?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PhaseBody;
    const auth = await authorizeAdmin(request, body.accessToken);

    if (!auth.authorized) {
      return unauthorizedResponse();
    }

    if (!body.phaseMode) {
      return NextResponse.json(
        { error: "Choose a phase before updating the event." },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseServerClient();
    const { error } = await supabase
      .from("app_state")
      .update({
        phase_mode: body.phaseMode,
        headline: body.headline ?? "Live vote in progress",
        subheadline:
          body.subheadline ??
          "Audience choices are updating for production in real time.",
        updated_at: new Date().toISOString()
      })
      .eq("id", 1);

    if (error) {
      console.error("Phase update failed", error);
      return NextResponse.json(
        { error: "Unable to update the event phase." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Phase update failed", error);
    return NextResponse.json(
      { error: "Unable to update the event phase." },
      { status: 500 }
    );
  }
}

