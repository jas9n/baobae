"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase-browser";
import { phaseCopy } from "@/lib/constants";
import { usePolling } from "@/hooks/use-polling";
import type {
  AdminResultsResponse,
  Contestant,
  PhaseMode,
  PublicStateResponse
} from "@/lib/types";

type AdminAuthMode = "locked" | "password" | "google";

async function readJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, init);
  const data = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(data.error ?? "Request failed.");
  }

  return data;
}

export function AdminDashboard() {
  const [eventData, setEventData] = useState<PublicStateResponse | null>(null);
  const [results, setResults] = useState<AdminResultsResponse | null>(null);
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<AdminAuthMode>("locked");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const supabase = getBrowserSupabaseClient();

  async function refreshPublicState() {
    try {
      const data = await readJson<PublicStateResponse>("/api/public-state", {
        cache: "no-store"
      });
      setEventData(data);
    } catch (error) {
      console.error(error);
      setStatusMessage("The admin panel could not load the event state.");
    }
  }

  async function refreshAdminResults() {
    if (authMode === "locked") {
      setResults(null);
      return;
    }

    try {
      const data = await readJson<AdminResultsResponse>("/api/admin/results", {
        cache: "no-store",
        headers: accessToken
          ? {
              Authorization: `Bearer ${accessToken}`
            }
          : undefined
      });
      setResults(data);
      setStatusMessage(null);
    } catch (error) {
      console.error(error);
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "The admin panel could not load live totals."
      );
      if (error instanceof Error && error.message.includes("Unauthorized")) {
        setAuthMode("locked");
      }
    }
  }

  useEffect(() => {
    const client = supabase;

    if (!client) {
      setStatusMessage(
        "Supabase is not configured yet. Add your environment variables to enable admin controls."
      );
      void refreshPublicState();
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

      setAccessToken(session?.access_token ?? null);
      setAuthMode(session?.access_token ? "google" : "locked");
      await refreshPublicState();
    }

    void bootstrap(client);

    const {
      data: { subscription }
    } = client.auth.onAuthStateChange((_event, session) => {
      setAccessToken(session?.access_token ?? null);
      setAuthMode((previous) =>
        previous === "password"
          ? "password"
          : session?.access_token
            ? "google"
            : "locked"
      );
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  usePolling(() => refreshPublicState(), 5000, true);
  usePolling(() => refreshAdminResults(), 1500, authMode !== "locked");

  const scoreboard =
    results?.contestants
      .map((contestant) => ({
        contestant,
        votes:
          results.totals.find((total) => total.contestant_id === contestant.id)
            ?.votes_count ?? 0
      }))
      .sort((left, right) => right.votes - left.votes) ?? [];

  const liveLeader = scoreboard[0] ?? null;
  const openContestants =
    eventData?.contestants.filter((contestant) => contestant.is_selectable) ?? [];

  async function withAdminAction(
    label: string,
    callback: () => Promise<void>
  ) {
    setLoadingAction(label);
    setStatusMessage(null);

    try {
      await callback();
      await Promise.all([refreshPublicState(), refreshAdminResults()]);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleGoogleAdminSignIn() {
    setStatusMessage(null);
    if (!supabase) {
      setStatusMessage("Supabase is not configured yet.");
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/admin`
      }
    });

    if (error) {
      setStatusMessage(error.message);
      return;
    }
  }

  async function handlePasswordUnlock() {
    await withAdminAction("unlock", async () => {
      await readJson<{ success: true }>("/api/admin/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ password })
      });

      setAuthMode("password");
      setPassword("");
    });
  }

  async function handlePhaseChange(phaseMode: PhaseMode) {
    const phaseMeta =
      phaseMode === "closed"
        ? {
            headline: "The next vote opens soon",
            subheadline: "Stay ready for the host's cue."
          }
        : phaseMode === "revival"
          ? {
              headline: "Revival vote is live",
              subheadline:
                "Audience choices are deciding who gets another shot tonight."
            }
          : {
              headline: "Elimination vote is live",
              subheadline:
                "Audience choices are deciding who leaves the villa next."
            };

    await withAdminAction(`phase-${phaseMode}`, async () => {
      await readJson<{ success: true }>("/api/admin/phase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({
          accessToken,
          phaseMode,
          ...phaseMeta
        })
      });
    });
  }

  async function updateContestant(
    contestantId: string,
    field: "isSelectable" | "isEliminated",
    value: boolean
  ) {
    await withAdminAction(`contestant-${contestantId}-${field}`, async () => {
      await readJson<{ success: true }>("/api/admin/contestants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({
          accessToken,
          contestantId,
          [field]: value
        })
      });
    });
  }

  async function handleResetRound() {
    await withAdminAction("reset-round", async () => {
      await readJson<{ success: true }>("/api/admin/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({
          accessToken
        })
      });
    });
  }

  async function handlePasswordLogout() {
    await readJson<{ success: true }>("/api/admin/auth", {
      method: "DELETE"
    });
    setAuthMode("locked");
    setResults(null);
  }

  async function handleGoogleLogout() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setAuthMode("locked");
    setResults(null);
  }

  return (
    <main className="page-shell admin-shell">
      <div className="page-background admin-background" />
      <section className="glass-panel admin-titlebar">
        <div className="admin-title-copy">
          <div className="brand-chip">Baobae</div>
          <h1>
            Round {eventData?.state.phase_number ?? 1}
          </h1>
        </div>
        <div className="hero-status">
          <span className={`status-pill status-${eventData?.state.phase_mode ?? "closed"}`}>
            {phaseCopy[eventData?.state.phase_mode ?? "closed"].title}
          </span>
          {eventData ? (
            <div className="event-meta">
              <strong>{eventData.state.event_name}</strong>
              <span>Round {eventData.state.phase_number}</span>
            </div>
          ) : null}
        </div>
      </section>

      <section className="admin-grid">
        <article className="glass-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Access</p>
              <h2>Unlock the control room</h2>
              <p>
                Use an allowlisted Google account or the master password for
                backstage access.
              </p>
            </div>
            {authMode === "password" ? (
              <button className="ghost-button" type="button" onClick={handlePasswordLogout}>
                Lock panel
              </button>
            ) : authMode === "google" ? (
              <button className="ghost-button" type="button" onClick={handleGoogleLogout}>
                Sign out
              </button>
            ) : null}
          </div>

          {authMode === "locked" ? (
            <div className="admin-auth-grid">
              <button
                className="primary-button"
                type="button"
                onClick={handleGoogleAdminSignIn}
              >
                Continue with Google
              </button>
              <div className="password-box">
                <input
                  className="text-input"
                  type="password"
                  placeholder="Master password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  className="secondary-button"
                  type="button"
                  onClick={handlePasswordUnlock}
                  disabled={!password || loadingAction === "unlock"}
                >
                  {loadingAction === "unlock" ? "Unlocking..." : "Unlock with password"}
                </button>
              </div>
            </div>
          ) : (
            <div className="empty-state compact-state">
              <div className="pulse-dot success-dot" />
              <p>The admin panel is unlocked and ready for live control.</p>
            </div>
          )}

          {statusMessage ? <p className="status-message">{statusMessage}</p> : null}
        </article>

        <article className="glass-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Live Results</p>
              <h2>Track the crowd in real time</h2>
              <p>
                The top card highlights who is currently leading the audience vote.
              </p>
            </div>
          </div>

          {authMode === "locked" ? (
            <div className="empty-state compact-state">
              <div className="pulse-dot" />
              <p>Unlock the panel to load live vote totals.</p>
            </div>
          ) : liveLeader ? (
            <>
              <div className="leader-card">
                <span className="eyebrow">
                  {eventData?.state.phase_mode === "revival"
                    ? "Leading Revival"
                    : "Most Votes"}
                </span>
                <h3>{liveLeader.contestant.name}</h3>
                <p>{liveLeader.votes} votes so far</p>
              </div>
              <div className="scoreboard">
                {scoreboard.map(({ contestant, votes }) => (
                  <div key={contestant.id} className="score-row">
                    <div className="score-copy">
                      <strong>{contestant.name}</strong>
                      <span>{votes} votes</span>
                    </div>
                    <div className="score-bar-track">
                      <div
                        className="score-bar-fill"
                        style={{
                          width: `${
                            votes === 0 || !liveLeader
                              ? 0
                              : Math.max(10, (votes / Math.max(liveLeader.votes, 1)) * 100)
                          }%`
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state compact-state">
              <div className="pulse-dot" />
              <p>No votes have landed in the current round yet.</p>
            </div>
          )}
        </article>

        <article className="glass-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Phase Control</p>
              <h2>Switch the audience form live</h2>
              <p>Move instantly between a waiting screen, elimination, and revival.</p>
            </div>
          </div>
          <div className="phase-button-row">
            <button
              className="secondary-button"
              type="button"
              disabled={authMode === "locked" || loadingAction === "phase-closed"}
              onClick={() => handlePhaseChange("closed")}
            >
              Close voting
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={authMode === "locked" || loadingAction === "phase-elimination"}
              onClick={() => handlePhaseChange("elimination")}
            >
              Open elimination
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={authMode === "locked" || loadingAction === "phase-revival"}
              onClick={() => handlePhaseChange("revival")}
            >
              Open revival
            </button>
          </div>
          <div className="summary-strip">
            <span>{openContestants.length} contestants currently visible to viewers</span>
            <span>
              {eventData?.contestants.filter((contestant) => contestant.is_eliminated).length ?? 0}{" "}
              marked eliminated
            </span>
          </div>
        </article>

        <article className="glass-panel wide-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Roster Control</p>
              <h2>Decide who the audience can vote on</h2>
              <p>
                Toggle each contestant into the active ballot and manually mark
                who has already been eliminated.
              </p>
            </div>
          </div>
          <div className="roster-list">
            {eventData?.contestants.map((contestant) => (
              <ContestantRow
                key={contestant.id}
                contestant={contestant}
                disabled={authMode === "locked" || !!loadingAction}
                onSelectableChange={(value) =>
                  updateContestant(contestant.id, "isSelectable", value)
                }
                onEliminatedChange={(value) =>
                  updateContestant(contestant.id, "isEliminated", value)
                }
              />
            )) ?? <p className="muted-text">Loading contestants...</p>}
          </div>
        </article>

        <article className="glass-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Round Reset</p>
              <h2>Start the next voting phase cleanly</h2>
              <p>
                This moves the event to the next round number, clears visible
                ballot options, and returns the audience view to waiting mode.
              </p>
            </div>
          </div>
          <button
            className="primary-button wide-button"
            type="button"
            disabled={authMode === "locked" || loadingAction === "reset-round"}
            onClick={handleResetRound}
          >
            {loadingAction === "reset-round" ? "Resetting..." : "Reset and start next round"}
          </button>
        </article>
      </section>
    </main>
  );
}

function ContestantRow({
  contestant,
  disabled,
  onSelectableChange,
  onEliminatedChange
}: {
  contestant: Contestant;
  disabled: boolean;
  onSelectableChange: (value: boolean) => void;
  onEliminatedChange: (value: boolean) => void;
}) {
  return (
    <div className="contestant-row">
      <div className="contestant-row-copy">
        <strong>{contestant.name}</strong>
        <span>{contestant.bio ?? "No contestant description yet."}</span>
      </div>
      <label className="toggle-pill">
        <input
          type="checkbox"
          checked={contestant.is_selectable}
          disabled={disabled}
          onChange={(event) => onSelectableChange(event.target.checked)}
        />
        <span>On ballot</span>
      </label>
      <label className="toggle-pill">
        <input
          type="checkbox"
          checked={contestant.is_eliminated}
          disabled={disabled}
          onChange={(event) => onEliminatedChange(event.target.checked)}
        />
        <span>Eliminated</span>
      </label>
    </div>
  );
}
