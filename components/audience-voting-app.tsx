"use client";

import { startTransition, useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase-browser";
import { phaseCopy } from "@/lib/constants";
import { usePolling } from "@/hooks/use-polling";
import type {
  Contestant,
  PublicStateResponse,
  ViewerStatus,
  VoteRecord
} from "@/lib/types";

type SessionUser = {
  email: string | null;
  accessToken: string | null;
  id: string;
};

async function readJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, init);
  const data = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(data.error ?? "Request failed.");
  }

  return data;
}

export function AudienceVotingApp() {
  const [eventData, setEventData] = useState<PublicStateResponse | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [selectedContestantId, setSelectedContestantId] = useState<string | null>(null);
  const [submittedVote, setSubmittedVote] = useState<VoteRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const supabase = getBrowserSupabaseClient();

  async function refreshEventState() {
    try {
      const data = await readJson<PublicStateResponse>("/api/public-state", {
        cache: "no-store"
      });

      startTransition(() => {
        setEventData(data);
      });
    } catch (error) {
      console.error(error);
      setStatusMessage("We could not load the live form. Try refreshing in a moment.");
    }
  }

  async function refreshViewerVote(accessToken: string | null) {
    if (!accessToken) {
      setSubmittedVote(null);
      return;
    }

    try {
      const data = await readJson<ViewerStatus>("/api/my-vote", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      startTransition(() => {
        setSubmittedVote(data.vote);
      });
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    const client = supabase;

    if (!client) {
      setIsReady(true);
      setStatusMessage(
        "Supabase is not configured yet. Add your environment variables to enable voting."
      );
      void refreshEventState();
      return;
    }

    let isMounted = true;

    async function bootstrap(activeClient: NonNullable<typeof client>) {
      const {
        data: { session }
      } = await activeClient.auth.getSession();

      if (!isMounted) {
        return;
      }

      startTransition(() => {
        setUser(
          session?.user
            ? {
                email: session.user.email ?? null,
                accessToken: session.access_token,
                id: session.user.id
              }
            : null
        );
      });

      await Promise.all([
        refreshEventState(),
        refreshViewerVote(session?.access_token ?? null)
      ]);
      setIsReady(true);
    }

    void bootstrap(client);

    const {
      data: { subscription }
    } = client.auth.onAuthStateChange((_event, session) => {
      startTransition(() => {
        setUser(
          session?.user
            ? {
                email: session.user.email ?? null,
                accessToken: session.access_token,
                id: session.user.id
              }
            : null
        );
      });

      void refreshViewerVote(session?.access_token ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!user?.accessToken) {
      setSubmittedVote(null);
      return;
    }

    void refreshViewerVote(user.accessToken);
  }, [eventData?.state.phase_mode, eventData?.state.phase_number, refreshViewerVote, user?.accessToken]);

  usePolling(() => refreshEventState(), 5000, isReady);

  const activeContestants =
    eventData?.contestants.filter((contestant) => contestant.is_selectable) ?? [];

  const selectedContestant =
    eventData?.contestants.find(
      (contestant) =>
        contestant.id === (submittedVote?.contestant_id ?? selectedContestantId)
    ) ?? null;

  const currentPhase = eventData?.state.phase_mode ?? "closed";
  const copy = phaseCopy[currentPhase];

  async function handleGoogleSignIn() {
    setStatusMessage(null);
    if (!supabase) {
      setStatusMessage("Supabase is not configured yet.");
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) {
      setStatusMessage(error.message);
    }
  }

  async function handleLogout() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setSelectedContestantId(null);
    setSubmittedVote(null);
  }

  async function handleVoteSubmit() {
    if (!selectedContestantId || !user?.accessToken || currentPhase === "closed") {
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      await readJson<{ success: true }>("/api/vote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.accessToken}`
        },
        body: JSON.stringify({
          contestantId: selectedContestantId
        })
      });

      setSubmittedVote({
        contestant_id: selectedContestantId,
        phase_number: eventData?.state.phase_number ?? 0,
        mode: currentPhase
      });
      setStatusMessage(
        currentPhase === "revival"
          ? "Your revival vote is locked in."
          : "Your elimination vote is locked in."
      );
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Vote failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="page-shell">
      <div className="page-background" />
      <section className="glass-panel audience-panel audience-room">
        <div className="panel-header">
          <div className="room-header-stack">
            <div className="room-topbar">
              <div className="brand-chip">Baobae 2026</div>
              {user ? (
                <button
                  className="ghost-button room-logout"
                  onClick={handleLogout}
                  type="button"
                >
                  Sign out
                </button>
              ) : null}
            </div>
            <h1 className="room-title">Voting Room</h1>
            <p className="room-subtitle">{eventData?.state.subheadline ?? copy.description}</p>
            <div className="room-meta">
              <span className={`status-pill status-${currentPhase}`}>{copy.title}</span>
              {eventData ? (
                <div className="event-meta">
                  <span>Round {eventData.state.phase_number}</span>
                </div>
              ) : (
                <span className="muted-text">Loading live event status...</span>
              )}
            </div>
          </div>
        </div>

        {!isReady ? (
          <div className="empty-state">
            <div className="pulse-dot" />
            <p>Checking your session and syncing the live round...</p>
          </div>
        ) : !user ? (
          <div className="login-panel">
            <p>
              Google sign-in keeps the audience vote fair by limiting each email
              address to one vote per round.
            </p>
            <button className="primary-button" onClick={handleGoogleSignIn} type="button">
              Continue with Google
            </button>
          </div>
        ) : currentPhase === "closed" ? (
          <div className="empty-state">
            <div className="pulse-dot" />
            <p>Voting is paused right now. Stay on this page for the next round.</p>
            <span className="muted-text">{user.email}</span>
          </div>
        ) : submittedVote ? (
          <div className="confirmation-card">
            <p className="eyebrow">Vote Received</p>
            <h3>
              {currentPhase === "revival"
                ? "Your revival choice is in."
                : "Your elimination choice is in."}
            </h3>
            <p>
              You voted for <strong>{selectedContestant?.name ?? "this contestant"}</strong>.
              This round only allows one vote per Google account.
            </p>
            <span className="muted-text">{user.email}</span>
          </div>
        ) : (
          activeContestants.length === 0 ? (
            <div className="empty-state">
              <div className="pulse-dot" />
              <p>Production has not opened any contestants for this round yet.</p>
              <span className="muted-text">Stay on this page for live updates.</span>
            </div>
          ) : (
            <>
              <div className="instruction-banner vote-instruction">
                <div className="vote-instruction-copy">
                  <strong>Choose one contestant</strong>
                  <span>{copy.description}</span>
                </div>
                <span className="vote-count-badge">
                  {activeContestants.length} on the ballot
                </span>
              </div>
              <div className="contestant-grid voting-grid">
                {activeContestants.map((contestant) => {
                  const isSelected = contestant.id === selectedContestantId;

                  return (
                    <button
                      key={contestant.id}
                      type="button"
                      className={`contestant-card ${isSelected ? "selected" : ""}`}
                      onClick={() => setSelectedContestantId(contestant.id)}
                    >
                      <Avatar contestant={contestant} />
                      <div className="contestant-copy">
                        <div className="contestant-name-row">
                          <h3>{contestant.name}</h3>
                          <span className="choice-dot" aria-hidden="true" />
                        </div>
                        <p>{contestant.bio ?? "No bio added yet."}</p>
                        <span className="selection-indicator">
                          {isSelected ? "Selected" : "Tap to choose"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="vote-submit-bar">
                <div className="vote-submit-copy">
                  <strong>
                    {selectedContestant
                      ? `${selectedContestant.name} is selected`
                      : "Choose a contestant to continue"}
                  </strong>
                  <span>
                    {selectedContestant
                      ? "Submit once to lock in your vote for this round."
                      : "Your vote is only counted after you press submit."}
                  </span>
                </div>
                <button
                  className="primary-button wide-button"
                  type="button"
                  disabled={!selectedContestantId || isSubmitting}
                  onClick={handleVoteSubmit}
                >
                  {isSubmitting ? "Submitting..." : copy.action}
                </button>
              </div>
            </>
          )
        )}

        {statusMessage ? <p className="status-message">{statusMessage}</p> : null}
      </section>
    </main>
  );
}

function Avatar({ contestant }: { contestant: Contestant }) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageSrc =
    contestant.avatar_url ??
    `/contestants/${encodeURIComponent(contestant.name)}.png`;

  useEffect(() => {
    setImageFailed(false);
  }, [contestant.avatar_url, contestant.name]);

  if (!imageFailed) {
    return (
      <img
        alt={contestant.name}
        className="contestant-avatar has-image"
        onError={() => setImageFailed(true)}
        src={imageSrc}
      />
    );
  }

  return (
    <div className="contestant-avatar">
      <span>{contestant.name.slice(0, 1)}</span>
    </div>
  );
}
