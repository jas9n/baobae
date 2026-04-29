import { NextResponse } from "next/server";
import { authorizeAdmin, unauthorizedResponse } from "@/lib/admin-auth";
import { createAdminSupabaseServerClient } from "@/lib/supabase-server";

interface ContestantBody {
  accessToken?: string | null;
  contestantId?: string;
  isSelectable?: boolean;
  isEliminated?: boolean;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ContestantBody;
    const auth = await authorizeAdmin(request, body.accessToken);

    if (!auth.authorized) {
      return unauthorizedResponse();
    }

    if (!body.contestantId) {
      return NextResponse.json(
        { error: "Contestant ID is required." },
        { status: 400 }
      );
    }

    const updates: Record<string, boolean> = {};

    if (typeof body.isSelectable === "boolean") {
      updates.is_selectable = body.isSelectable;
    }

    if (typeof body.isEliminated === "boolean") {
      updates.is_eliminated = body.isEliminated;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No contestant changes were provided." },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseServerClient();
    const { error } = await supabase
      .from("contestants")
      .update(updates)
      .eq("id", body.contestantId);

    if (error) {
      console.error("Contestant update failed", error);
      return NextResponse.json(
        { error: "Unable to update that contestant." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contestant update failed", error);
    return NextResponse.json(
      { error: "Unable to update that contestant." },
      { status: 500 }
    );
  }
}

