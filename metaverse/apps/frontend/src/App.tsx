import { FormEvent, useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import Arena from "./Game";
import {
  ApiError,
  addSpaceElement,
  createSpace,
  deleteSpace,
  getElements,
  getSpace,
  getSpaces,
  signIn,
  signUp,
} from "./api";
import type { Element, Space } from "./types";
import "./App.css";

const SESSION_KEY = "metaverse-session";

type Session = {
  token: string;
  username: string;
};

const maps = [
  {
    name: "Sunlit Grove",
    dimensions: "24x16",
    description: "A quiet garden for easygoing meetups.",
    theme: "grove" as const,
  },
  {
    name: "Moonlight Arcade",
    dimensions: "20x20",
    description: "A neon-lit square for late-night hangouts.",
    theme: "arcade" as const,
  },
];

function readSession(): Session | null {
  const saved = localStorage.getItem(SESSION_KEY);
  if (!saved) return null;

  try {
    const parsed: unknown = JSON.parse(saved);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "token" in parsed &&
      "username" in parsed &&
      typeof parsed.token === "string" &&
      typeof parsed.username === "string"
    ) {
      return { token: parsed.token, username: parsed.username };
    }
  } catch {
    localStorage.removeItem(SESSION_KEY);
  }
  return null;
}

function App() {
  const [session, setSession] = useState<Session | null>(readSession);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [elements, setElements] = useState<Element[]>([]);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get("spaceId"),
  );
  const [sharedSpace, setSharedSpace] = useState<Space | null>(null);
  const [isLoadingSharedSpace, setIsLoadingSharedSpace] = useState(false);
  const [sharedSpaceError, setSharedSpaceError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pageError, setPageError] = useState("");
  const [spacesLoaded, setSpacesLoaded] = useState(false);

  const refreshSpaces = useCallback(async (token: string) => {
    const result = await getSpaces(token);
    setSpaces(result);
  }, []);

  useEffect(() => {
    if (!session) return;

    let cancelled = false;
    setIsLoading(true);
    setPageError("");
    Promise.allSettled([getSpaces(session.token), getElements()])
      .then(([spacesResult, elementsResult]) => {
        if (cancelled) return;
        if (spacesResult.status === "fulfilled") {
          setSpaces(spacesResult.value);
          setSpacesLoaded(true);
        } else {
          const error = spacesResult.reason;
          setSpacesLoaded(true);
          setPageError(
            error instanceof ApiError
              ? error.message
              : "Could not load your spaces. Check that the API is running.",
          );
        }
        if (elementsResult.status === "fulfilled") {
          setElements(elementsResult.value);
        } else if (spacesResult.status === "fulfilled") {
          const error = elementsResult.reason;
          setPageError(
            error instanceof ApiError
              ? `Your spaces loaded, but the decoration catalog could not be loaded: ${error.message}`
              : "Your spaces loaded, but the decoration catalog could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (!session || !spacesLoaded || !activeSpaceId || spaces.some((space) => space.id === activeSpaceId)) {
      setSharedSpace(null);
      setSharedSpaceError("");
      setIsLoadingSharedSpace(false);
      return;
    }

    let cancelled = false;
    setSharedSpace(null);
    setSharedSpaceError("");
    setIsLoadingSharedSpace(true);
    getSpace(session.token, activeSpaceId)
      .then((space) => {
        if (!cancelled) setSharedSpace(space);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setSharedSpaceError(error instanceof Error ? error.message : "This shared space could not be opened.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSharedSpace(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeSpaceId, session, spaces, spacesLoaded]);

  useEffect(() => {
    const handlePopState = () => {
      setActiveSpaceId(new URLSearchParams(window.location.search).get("spaceId"));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const activeSpace = useMemo(
    () => spaces.find((space) => space.id === activeSpaceId) ?? sharedSpace,
    [activeSpaceId, sharedSpace, spaces],
  );

  const rememberSession = (next: Session | null) => {
    setSession(next);
    if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    else localStorage.removeItem(SESSION_KEY);
    if (!next) {
      setActiveSpaceId(null);
      setSpaces([]);
      setSpacesLoaded(false);
      setSharedSpace(null);
      window.history.replaceState({}, "", window.location.pathname);
    }
  };

  const openSpace = (spaceId: string) => {
    setActiveSpaceId(spaceId);
    window.history.pushState({}, "", `?spaceId=${encodeURIComponent(spaceId)}`);
  };

  const leaveSpace = () => {
    setActiveSpaceId(null);
    window.history.pushState({}, "", window.location.pathname);
  };

  const handleCreateSpace = async (name: string, mapIndex: number) => {
    if (!session) return;
    const map = maps[mapIndex];
    if (!map) return;
    const created = await createSpace(session.token, {
      name,
      dimensions: map.dimensions,
    });
    await refreshSpaces(session.token);
    openSpace(created.spaceId);
  };

  const handleDeleteSpace = async (space: Space) => {
    if (!session || !window.confirm(`Delete "${space.name}" and everything in it?`)) {
      return;
    }
    try {
      await deleteSpace(session.token, space.id);
      setSpaces((current) => current.filter((entry) => entry.id !== space.id));
      setPageError("");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Could not delete this space.");
    }
  };

  const handlePlaceElement = async (spaceId: string, elementId: string, x: number, y: number) => {
    if (!session) return;
    await addSpaceElement(session.token, { spaceId, elementId, x, y });
  };

  const handleShareSpace = async (spaceId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("spaceId", spaceId);
    if (!navigator.clipboard?.writeText) {
      throw new Error("Copying links is not supported in this browser.");
    }
    await navigator.clipboard.writeText(url.toString());
  };

  const ArenaComponent = Arena as unknown as ComponentType<Parameters<typeof Arena>[0]>;

  if (!session) {
    return (
      <AuthScreen
        onAuthenticated={rememberSession}
      />
    );
  }

  if (activeSpace) {
    return (
      <ArenaComponent
        key={activeSpace.id}
        space={activeSpace}
        token={session.token}
        username={session.username}
        elements={elements}
        canEdit={spaces.some((space) => space.id === activeSpace.id)}
        onBack={leaveSpace}
        onPlaceElement={handlePlaceElement}
        onLogout={() => rememberSession(null)}
      />
    );
  }

  if (activeSpaceId && (isLoadingSharedSpace || sharedSpaceError)) {
    return (
      <main className="shared-link-state">
        <div className="shared-link-card">
          <span className="eyebrow">SHARED SPACE</span>
          {isLoadingSharedSpace ? (
            <>
              <h1>Opening your invite...</h1>
              <div className="loading-state"><span className="spinner" /> Loading space</div>
            </>
          ) : (
            <>
              <h1>Couldn’t open this space</h1>
              <p className="muted">{sharedSpaceError}</p>
              <button className="button button-primary" onClick={leaveSpace}>Back to your spaces</button>
            </>
          )}
        </div>
      </main>
    );
  }

  return (
    <Dashboard
      username={session.username}
      spaces={spaces}
      isLoading={isLoading}
      error={pageError}
      onCreateSpace={handleCreateSpace}
      onOpenSpace={openSpace}
      onDeleteSpace={handleDeleteSpace}
      onShareSpace={handleShareSpace}
      onLogout={() => rememberSession(null)}
    />
  );
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (session: Session) => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      if (mode === "signup") await signUp({ username, password, type: "user" });
      const { token } = await signIn({ username, password });
      onAuthenticated({ token, username });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-copy">
        <a className="brand" href="/" aria-label="Mosaic home">
          <span className="brand-mark">M</span>
          <span>Mosaic</span>
        </a>
        <div className="auth-intro">
          <span className="eyebrow">YOUR LITTLE CORNER OF THE INTERNET</span>
          <h1>Make room<br />for good things.</h1>
          <p>Build a space, invite your people, and see where the conversation goes.</p>
        </div>
        <div className="auth-note">
          <span className="note-dot" />
          <span>Small spaces. Big energy.</span>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <span className="eyebrow">{mode === "signin" ? "WELCOME BACK" : "GET STARTED"}</span>
          <h2>{mode === "signin" ? "Sign in to Mosaic" : "Create your account"}</h2>
          <p className="muted">
            {mode === "signin"
              ? "Your spaces are right where you left them."
              : "A username and password are all you need."}
          </p>
          <form onSubmit={submit} className="auth-form">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              autoFocus
            />
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button button-primary auth-submit" disabled={isSubmitting}>
              {isSubmitting ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
              <span aria-hidden="true">-&gt;</span>
            </button>
          </form>
          <p className="auth-switch">
            {mode === "signin" ? "New around here?" : "Already have an account?"}{" "}
            <button
              className="text-button"
              onClick={() => {
                setError("");
                setMode(mode === "signin" ? "signup" : "signin");
              }}
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}

function Dashboard({
  username,
  spaces,
  isLoading,
  error,
  onCreateSpace,
  onOpenSpace,
  onDeleteSpace,
  onShareSpace,
  onLogout,
}: {
  username: string;
  spaces: Space[];
  isLoading: boolean;
  error: string;
  onCreateSpace: (name: string, mapIndex: number) => Promise<void>;
  onOpenSpace: (spaceId: string) => void;
  onDeleteSpace: (space: Space) => void;
  onShareSpace: (spaceId: string) => Promise<void>;
  onLogout: () => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedMap, setSelectedMap] = useState(0);
  const [spaceName, setSpaceName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [copiedSpaceId, setCopiedSpaceId] = useState<string | null>(null);
  const [shareError, setShareError] = useState("");
  const filteredSpaces = spaces.filter((space) =>
    space.name.toLowerCase().includes(search.toLowerCase()),
  );

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsCreating(true);
    setCreateError("");
    try {
      await onCreateSpace(spaceName.trim(), selectedMap);
    } catch (caught) {
      setCreateError(caught instanceof Error ? caught.message : "Could not create this space.");
    } finally {
      setIsCreating(false);
    }
  };

  const shareSpace = async (spaceId: string) => {
    setShareError("");
    try {
      await onShareSpace(spaceId);
      setCopiedSpaceId(spaceId);
      window.setTimeout(() => {
        setCopiedSpaceId((current) => current === spaceId ? null : current);
      }, 2200);
    } catch (error) {
      setShareError(error instanceof Error ? error.message : "Could not copy the invite link.");
    }
  };

  return (
    <main className="dashboard-page">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Mosaic home">
          <span className="brand-mark">M</span>
          <span>Mosaic</span>
        </a>
        <div className="topbar-right">
          <span className="user-greeting">Hey, {username}</span>
          <button className="avatar-badge" aria-label="Sign out" onClick={onLogout}>
            {username.slice(0, 1).toUpperCase()}
          </button>
        </div>
      </header>

      <section className="dashboard-content">
        <div className="welcome-row">
          <div>
            <span className="eyebrow">YOUR WORLD, YOUR RULES</span>
            <h1>Your spaces</h1>
            <p className="muted">A good place to meet, make, and just be.</p>
          </div>
          <button className="button button-primary" onClick={() => setShowCreate(true)}>
            <span className="plus-mark">+</span> Create a space
          </button>
        </div>

        {error && <div className="notice notice-error" role="alert">{error}</div>}
        {shareError && <div className="notice notice-error" role="alert">{shareError}</div>}
        <div className="section-heading">
          <div>
            <h2>All spaces <span className="count-pill">{spaces.length}</span></h2>
            <p className="muted">Pick up where you left off, or invite another signed-in user.</p>
          </div>
          <label className="search-box">
            <span className="search-icon" aria-hidden="true">/</span>
            <input
              aria-label="Search spaces"
              placeholder="Find a space..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>

        {isLoading ? (
          <div className="loading-state"><span className="spinner" /> Loading your spaces...</div>
        ) : filteredSpaces.length > 0 ? (
          <div className="space-grid">
            {filteredSpaces.map((space) => {
              const theme = getMapTheme(space.dimensions);
              return (
                <article className="space-card" key={space.id}>
                  <button
                    className={`space-preview ${theme}`}
                    onClick={() => onOpenSpace(space.id)}
                    aria-label={`Enter ${space.name}`}
                  >
                    <MapPreview theme={theme} />
                    <span className="preview-open">Enter space -&gt;</span>
                  </button>
                  <div className="space-card-info">
                    <div className="space-card-title">
                      <div>
                        <h3>{space.name}</h3>
                        <p>{maps.find((map) => map.dimensions === space.dimensions)?.name ?? "Custom space"} · {space.dimensions}</p>
                      </div>
                      <div className="space-card-actions">
                        <button
                          className="share-button"
                          aria-label={`Copy invite link for ${space.name}`}
                          onClick={() => shareSpace(space.id)}
                        >
                          {copiedSpaceId === space.id ? "Link copied" : "Share"}
                        </button>
                        <button
                          className="icon-button danger-button"
                          aria-label={`Delete ${space.name}`}
                          title="Delete space"
                          onClick={() => onDeleteSpace(space)}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-illustration"><MapPreview theme="grove" /></div>
            <h2>{search ? "No spaces found" : "Your first space is waiting"}</h2>
            <p>{search ? "Try another name." : "Choose a map and make it your own."}</p>
            {!search && (
              <button className="button button-primary" onClick={() => setShowCreate(true)}>
                Create your first space
              </button>
            )}
          </div>
        )}
      </section>

      {showCreate && (
        <div className="modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowCreate(false);
        }}>
          <section className="create-modal" role="dialog" aria-modal="true" aria-labelledby="create-title">
            <button className="modal-close" aria-label="Close" onClick={() => setShowCreate(false)}>×</button>
            <span className="eyebrow">NEW HANGOUT</span>
            <h2 id="create-title">Give your space a name</h2>
            <p className="muted">Choose a map to set the mood. You can decorate it once you're in.</p>
            <form onSubmit={submitCreate}>
              <label htmlFor="space-name">Space name</label>
              <input
                id="space-name"
                maxLength={40}
                placeholder="e.g. The Sunday Club"
                value={spaceName}
                onChange={(event) => setSpaceName(event.target.value)}
                required
                autoFocus
              />
              <div className="map-options" role="radiogroup" aria-label="Choose a map">
                {maps.map((map, index) => (
                  <button
                    className={`map-option ${selectedMap === index ? "selected" : ""}`}
                    type="button"
                    role="radio"
                    aria-checked={selectedMap === index}
                    key={map.name}
                    onClick={() => setSelectedMap(index)}
                  >
                    <span className={`map-option-preview ${map.theme}`}><MapPreview theme={map.theme} /></span>
                    <span className="map-option-copy">
                      <strong>{map.name}</strong>
                      <span>{map.description}</span>
                    </span>
                    <span className="radio-dot" />
                  </button>
                ))}
              </div>
              {createError && <p className="form-error" role="alert">{createError}</p>}
              <button className="button button-primary modal-submit" disabled={isCreating}>
                {isCreating ? "Creating..." : "Create space"} <span aria-hidden="true">-&gt;</span>
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

function getMapTheme(dimensions: string): "grove" | "arcade" {
  return dimensions === maps[1]?.dimensions ? "arcade" : "grove";
}

function MapPreview({ theme }: { theme: "grove" | "arcade" }) {
  return (
    <span className={`map-art ${theme}`} aria-hidden="true">
      <span className="map-path" />
      <span className="map-tree tree-one" />
      <span className="map-tree tree-two" />
      <span className="map-tree tree-three" />
      <span className="map-feature" />
    </span>
  );
}

export default App;
