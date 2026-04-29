import type { PhaseMode } from "@/lib/types";

export const phaseCopy: Record<
  PhaseMode,
  { title: string; description: string; action: string }
> = {
  closed: {
    title: "Voting is paused",
    description:
      "Stay ready. Production will open the next round as soon as the host cues the crowd.",
    action: "Waiting for the next round"
  },
  elimination: {
    title: "Vote to eliminate",
    description:
      "Pick the contestant you want removed from the villa this round.",
    action: "Submit elimination vote"
  },
  revival: {
    title: "Vote to revive",
    description:
      "Pick the contestant you want brought back into the show.",
    action: "Submit revival vote"
  }
};

export const ADMIN_COOKIE_NAME = "baobae-admin";

