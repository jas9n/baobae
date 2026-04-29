import type { AdminResultsResponse, AppState, Contestant, VoteTotal } from "@/lib/types";
import {
  createAdminSupabaseServerClient,
  createPublicSupabaseServerClient
} from "@/lib/supabase-server";

export async function fetchPublicState() {
  const supabase = createPublicSupabaseServerClient();

  const [{ data: state, error: stateError }, { data: contestants, error: contestantsError }] =
    await Promise.all([
      supabase.from("app_state").select("*").eq("id", 1).single(),
      supabase.from("contestants").select("*").order("display_order", { ascending: true })
    ]);

  if (stateError) {
    throw stateError;
  }

  if (contestantsError) {
    throw contestantsError;
  }

  return {
    state: state as AppState,
    contestants: (contestants ?? []) as Contestant[]
  };
}

export async function fetchAdminResults(): Promise<AdminResultsResponse> {
  const supabase = createAdminSupabaseServerClient();
  const publicState = await fetchPublicState();
  if (publicState.state.phase_mode === "closed") {
    return {
      ...publicState,
      totals: []
    };
  }

  const { data: totals, error: totalsError } = await supabase
    .from("vote_totals")
    .select("contestant_id, votes_count")
    .eq("phase_number", publicState.state.phase_number)
    .eq("mode", publicState.state.phase_mode);

  if (totalsError) {
    throw totalsError;
  }

  return {
    ...publicState,
    totals: (totals ?? []) as VoteTotal[]
  };
}
