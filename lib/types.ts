export type PhaseMode = "closed" | "elimination" | "revival";

export interface Contestant {
  id: string;
  name: string;
  bio: string | null;
  avatar_url: string | null;
  display_order: number;
  is_eliminated: boolean;
  is_selectable: boolean;
}

export interface AppState {
  id: number;
  event_name: string;
  phase_mode: PhaseMode;
  phase_number: number;
  headline: string;
  subheadline: string;
  updated_at: string;
}

export interface VoteRecord {
  contestant_id: string;
  phase_number: number;
  mode: Exclude<PhaseMode, "closed">;
}

export interface VoteTotal {
  contestant_id: string;
  votes_count: number;
}

export interface PublicStateResponse {
  state: AppState;
  contestants: Contestant[];
}

export interface AdminResultsResponse extends PublicStateResponse {
  totals: VoteTotal[];
}

export interface ViewerStatus {
  vote: VoteRecord | null;
}

