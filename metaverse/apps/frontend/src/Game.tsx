import { useCallback, useEffect, useRef, useState } from "react";
import { getSpace } from "./api";
import type { Element, Space, SpaceElement, SpaceDetails } from "./types";

const TILE_SIZE = 44;
const WS_URL = import.meta.env.VITE_WS_URL || `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws`;

type Player = { userId: string; x: number; y: number };
type ConnectionState = "connecting" | "connected" | "disconnected";

export default function Arena({
  space,
  token,
  username,
  elements,
  canEdit,
  onBack,
  onPlaceElement,
  onLogout,
}: {
  space: Space;
  token: string;
  username: string;
  elements: Element[];
  canEdit: boolean;
  onBack: () => void;
  onPlaceElement: (spaceId: string, elementId: string, x: number, y: number) => Promise<void>;
  onLogout: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [details, setDetails] = useState<SpaceDetails | null>(null);
  const [currentUser, setCurrentUser] = useState<Player | null>(null);
  const [otherUsers, setOtherUsers] = useState<Map<string, Player>>(() => new Map());
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [gameError, setGameError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [buttonText, setButtonText] = useState<string>('Share');

  const theme = space.dimensions === "20x20" ? "arcade" : "grove";
  const [width, height] = (details?.dimensions ?? space.dimensions).split("x").map(Number);
  const placeableElements = ["builtin_fern", "builtin_lamp", "builtin_bench"]
    .map((id) => elements.find((element) => element.id === id))
    .filter((element): element is Element => element !== undefined);
  const selectedElement = elements.find((element) => element.id === selectedElementId) ?? null;

  const refreshSpace = useCallback(async () => {
    const result = await getSpace(token, space.id);
    setDetails(result);
  }, [space.id, token]);

  useEffect(() => {
    let cancelled = false;
    refreshSpace().catch((error: unknown) => {
      if (!cancelled) setGameError(error instanceof Error ? error.message : "Could not load this space.");
    });
    return () => {
      cancelled = true;
    };
  }, [refreshSpace]);

  useEffect(() => {
    const socket = new WebSocket(WS_URL);
    socketRef.current = socket;
    socket.onopen = () => {
      setConnection("connected");
      socket.send(JSON.stringify({ type: "join", payload: { spaceId: space.id, token } }));
    };
    socket.onmessage = (event: MessageEvent<string>) => {
      try {
        const message = JSON.parse(event.data) as {
          type: string;
          payload: Record<string, unknown> & { users?: Player[]; spawn?: { x: number; y: number } };
        };
        const payload = message.payload;
        switch (message.type) {
          case "space-joined": {
            if (payload.spawn && typeof payload.userId === "string") {
              setCurrentUser({
                userId: payload.userId,
                x: payload.spawn.x,
                y: payload.spawn.y,
              });
            }
            setOtherUsers(new Map((payload.users ?? []).map((user) => [user.userId, user])));
            break;
          }
          case "user-joined": {
            if (typeof payload.userId !== "string") break;
            setOtherUsers((previous) => new Map(previous).set(payload.userId as string, {
              userId: payload.userId as string,
              x: Number(payload.x),
              y: Number(payload.y),
            }));
            break;
          }
          case "movement": {
            if (typeof payload.userId !== "string") break;
            setOtherUsers((previous) => {
              const next = new Map(previous);
              const player = next.get(payload.userId as string);
              if (player) next.set(player.userId, { ...player, x: Number(payload.x), y: Number(payload.y) });
              return next;
            });
            break;
          }
          case "movement-rejected":
            setCurrentUser((previous) => previous
              ? { ...previous, x: Number(payload.x), y: Number(payload.y) }
              : previous);
            break;
          case "user-left":
            if (typeof payload.userId === "string") {
              setOtherUsers((previous) => {
                const next = new Map(previous);
                next.delete(payload.userId as string);
                return next;
              });
            }
            break;
        }
      } catch {
        setGameError("Received an invalid message from the room server.");
      }
    };
    socket.onerror = () => setConnection("disconnected");
    socket.onclose = () => setConnection("disconnected");
    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [space.id, token]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !width || !height) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    canvas.width = width * TILE_SIZE;
    canvas.height = height * TILE_SIZE;
    context.fillStyle = theme === "grove" ? "#d9edcf" : "#182139";
    context.fillRect(0, 0, canvas.width, canvas.height);

    if (theme === "grove") {
      context.fillStyle = "#c5e1bb";
      for (let y = 0; y < height; y += 4) {
        context.fillRect(0, y * TILE_SIZE, canvas.width, TILE_SIZE * 2);
      }
      context.strokeStyle = "rgba(255,255,255,.55)";
      context.lineWidth = TILE_SIZE * 1.3;
      context.beginPath();
      context.moveTo(0, canvas.height * 0.53);
      context.bezierCurveTo(canvas.width * 0.28, canvas.height * 0.35, canvas.width * 0.65, canvas.height * 0.72, canvas.width, canvas.height * 0.47);
      context.stroke();
    } else {
      context.fillStyle = "#202d49";
      for (let y = 0; y < height; y += 2) {
        for (let x = 0; x < width; x += 2) {
          if ((x + y) % 4 === 0) context.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE * 2, TILE_SIZE * 2);
        }
      }
      context.strokeStyle = "rgba(134,165,255,.12)";
      context.lineWidth = 2;
    }

    context.strokeStyle = theme === "grove" ? "rgba(65,105,73,.12)" : "rgba(144,165,226,.12)";
    context.lineWidth = 1;
    for (let x = 0; x <= width; x++) {
      context.beginPath();
      context.moveTo(x * TILE_SIZE, 0);
      context.lineTo(x * TILE_SIZE, canvas.height);
      context.stroke();
    }
    for (let y = 0; y <= height; y++) {
      context.beginPath();
      context.moveTo(0, y * TILE_SIZE);
      context.lineTo(canvas.width, y * TILE_SIZE);
      context.stroke();
    }

    const drawSprite = (item: SpaceElement) => {
      const image = new Image();
      image.onload = () => {
        const inset = TILE_SIZE * 0.08;
        context.drawImage(
          image,
          item.x * TILE_SIZE + inset,
          item.y * TILE_SIZE + inset,
          TILE_SIZE - inset * 2,
          TILE_SIZE - inset * 2,
        );
      };
      image.src = item.element.imageUrl;
    };
    details?.elements.forEach(drawSprite);

    const drawPlayer = (player: Player, isSelf: boolean) => {
      const centerX = player.x * TILE_SIZE + TILE_SIZE / 2;
      const centerY = player.y * TILE_SIZE + TILE_SIZE / 2;
      context.beginPath();
      context.fillStyle = isSelf ? "#f07861" : "#7886f2";
      context.arc(centerX, centerY, TILE_SIZE * 0.32, 0, Math.PI * 2);
      context.fill();
      context.lineWidth = 3;
      context.strokeStyle = "#fff";
      context.stroke();
      context.fillStyle = theme === "grove" ? "#244638" : "#fff";
      context.font = "600 12px Inter, sans-serif";
      context.textAlign = "center";
      context.fillText(
        isSelf ? username.slice(0, 10) : `Guest ${player.userId.slice(0, 4)}`,
        centerX,
        centerY + TILE_SIZE * 0.48,
      );
    };
    otherUsers.forEach((player) => drawPlayer(player, false));
    if (currentUser) drawPlayer(currentUser, true);
  }, [currentUser, details, height, otherUsers, theme, username, width]);

  const move = useCallback((dx: number, dy: number) => {
    if (!currentUser) return;
    const x = currentUser.x + dx;
    const y = currentUser.y + dy;
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    setCurrentUser((previous) => previous ? { ...previous, x, y } : previous);
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "move", payload: { x, y } }));
    }
  }, [currentUser, height, width]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "BUTTON"].includes(event.target.tagName)) return;
      const directions: Record<string, [number, number]> = {
        ArrowUp: [0, -1],
        w: [0, -1],
        ArrowDown: [0, 1],
        s: [0, 1],
        ArrowLeft: [-1, 0],
        a: [-1, 0],
        ArrowRight: [1, 0],
        d: [1, 0],
      };
      const direction = directions[event.key];
      if (!direction) return;
      event.preventDefault();
      move(...direction);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [move]);

  const placeSelectedElement = async (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedElement || !details) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) * (event.currentTarget.width / rect.width) / TILE_SIZE);
    const y = Math.floor((event.clientY - rect.top) * (event.currentTarget.height / rect.height) / TILE_SIZE);
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    setIsRefreshing(true);
    setGameError("");
    try {
      await onPlaceElement(space.id, selectedElement.id, x, y);
      await refreshSpace();
    } catch (error) {
      setGameError(error instanceof Error ? error.message : "Could not place this item.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleShareSpace = async () => {
    
    const url = new URL(window.location.href);
    if (!navigator.clipboard?.writeText) {
      throw new Error("Copying links is not supported in this browser.");
    }
    await navigator.clipboard.writeText(url.toString());
    setButtonText('Copied!');
    setTimeout(() => {
      setButtonText('Share');
    }, 2000);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshSpace();
      setGameError("");
    } catch (error) {
      setGameError(error instanceof Error ? error.message : "Could not refresh the space.");
    } finally {
      setIsRefreshing(false);
    }
  };


  return (
    <main className="game-page">
      <header className="topbar game-topbar">
        <div className="game-topbar-left">
          <button className="back-button" onClick={onBack} aria-label="Back to spaces">&lt;</button>
          <a className="brand" href="/" onClick={(event) => { event.preventDefault(); onBack(); }}>
            <span className="brand-mark">M</span><span>Mosaic</span>
          </a>
          <span className="topbar-divider" />
          <span className="game-space-name">{space.name}</span>
        </div>
        <div className="topbar-right">
          <span className={`connection-pill ${connection}`}>
            <span className="connection-dot" />
            {connection === "connected" ? "Live room" : connection === "connecting" ? "Connecting" : "Offline"}
          </span>
          <button className="avatar-badge" aria-label="Sign out" onClick={onLogout}>
            {username.slice(0, 1).toUpperCase()}
          </button>
        </div>
      </header>

      <div className="game-layout">
        <aside className="game-sidebar">
          <div className="sidebar-heading">
            <span className="eyebrow">THE HANGOUT</span>
            <h1>{space.name}</h1>
            <p>{theme === "grove" ? "Sunlit Grove" : "Moonlight Arcade"} <span>·</span> {space.dimensions}</p>
          </div>
          <div className="sidebar-section">
            <div className="sidebar-label-row">
              <span className="sidebar-label">People here</span>
              <span className="count-pill">{otherUsers.size + (currentUser ? 1 : 0)}</span>
            </div>
            {currentUser ? (
              <div className="people-list">
                <div className="person-row">
                  <span className="person-avatar self-avatar">{username.slice(0, 1).toUpperCase()}</span>
                  <span>{username} <small>you</small></span>
                </div>
                {Array.from(otherUsers.values()).map((player) => (
                  <div className="person-row" key={player.userId}>
                    <span className="person-avatar guest-avatar">{player.userId.slice(0, 1).toUpperCase()}</span>
                    <span>Guest {player.userId.slice(0, 5)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="sidebar-hint">Joining the room...</p>}
          </div>

          {canEdit ? <div className="sidebar-section decor-section">
            <div className="sidebar-label-row">
              <span className="sidebar-label">Add a little something</span>
              <span className="item-count">{placeableElements.length} items</span>
            </div>
            {placeableElements.length ? (
              <div className="element-list">
                {placeableElements.map((element) => (
                  <button
                    className={`element-choice ${selectedElementId === element.id ? "selected" : ""}`}
                    key={element.id}
                    onClick={() => setSelectedElementId(element.id === selectedElementId ? null : element.id)}
                    aria-pressed={selectedElementId === element.id}
                  >
                    <img src={element.imageUrl} alt="" />
                    <span>{elementName(element.imageUrl)}</span>
                    <span className="element-action">{selectedElementId === element.id ? "Selected" : "Place"}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="sidebar-hint">The item catalog is empty. Add items through the admin element API.</p>
            )}
            {selectedElement && <p className="placement-hint">Click an open tile to place {elementName(selectedElement.imageUrl)}.</p>}
          </div> : <div className="sidebar-section decor-section">
            <div className="sidebar-label-row">
              <span className="sidebar-label">Decorations</span>
            </div>
            <p className="sidebar-hint">You can explore this shared space. Only its owner can add decorations.</p>
          </div>}
          <div className="sidebar-footer">
            <span>Move with <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrow keys</span>
            <span>Click an item, then a tile to decorate</span>
          </div>
        </aside>

        <section className={`world-panel ${theme}`}>
          <div className="world-toolbar">
            <div>
              <span className="world-status-dot" />
              <span>{currentUser ? "You're in the space" : "Finding your place..."}</span>
            </div>
            <div>
              {currentUser?.userId === space.creatorId ? <button
                          className="share-button"
                          aria-label={`Copy invite link for ${space.name}`}
                          onClick={handleShareSpace}
                        >
                          {buttonText}
              </button> : <></>}
              <button className="quiet-button" onClick={handleRefresh} disabled={isRefreshing}>
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
          {gameError && <div className="game-error" role="alert">{gameError}</div>}
          {!details ? (
            <div className="loading-state"><span className="spinner" /> Preparing your space...</div>
          ) : (
            <div className="world-canvas-wrap">
              <canvas
                ref={canvasRef}
                className={`world-canvas ${selectedElement ? "placing" : ""}`}
                onClick={placeSelectedElement}
                aria-label={`${space.name} map. Use the arrow keys or WASD to move. Click to place a selected item.`}
              />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function elementName(imageUrl: string) {
  const name = imageUrl.split("/").pop()?.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
  return name ? name.replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Decoration";
}
