const endpoint = "https://keep-it-going-relay.robinlinacre.workers.dev/ice";
const prefix = "factoroids-events-v1-";
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () =>
  Array.from(
    crypto.getRandomValues(new Uint8Array(4)),
    (n) => alphabet[n % alphabet.length],
  ).join("");

export function teamRoom(root, game) {
  const $ = (s) => root.querySelector(s);
  const dialog = $("#team-menu"),
    roster = $("#team-roster"),
    notice = $("#team-notice");
  const players = new Map(),
    guests = new Map();
  let peer,
    host,
    role,
    code,
    generation = 0,
    nextPlayer,
    running = false,
    targets = [],
    selectedMode = "create",
    localName = "";
  let pending = [],
    lastSync = 0;

  function show(section) {
    for (const name of ["choice", "details", "lobby"])
      $("#team-" + name).hidden = name !== section;
    $("#team-title").textContent = section === "choice" ? "Play together" :
      section === "details" ? (selectedMode === "create" ? "Create a game" : "Join a game") : "Team game";
    notice.textContent = "";
  }
  function playerName(value, fallback) {
    if (typeof value !== "string") return fallback;
    return value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 24) || fallback;
  }
  function scores() {
    const rows = Array.from(players, ([id, p]) => p.name + " · " + p.solves);
    roster.textContent = rows.join("   /   ");
    $("#team-score").textContent = rows.join("   /   ");
  }
  function broadcast(packet) {
    for (const conn of guests.values()) if (conn.open) conn.send(packet);
  }
  function sendScores() {
    scores();
    broadcast({ type: "scores", rows: [...players] });
  }
  function close() {
    generation++;
    role = null;
    running = false;
    peer?.destroy();
    peer = host = null;
    players.clear();
    guests.clear();
    targets = [];
    pending = [];
    $("#team-score").hidden = true;
    $("#team-start").hidden = true;
    scores();
  }
  function error(message) {
    close();
    game.reset();
    game.hold();
    show("details");
    notice.textContent = message;
    if (!dialog.open) dialog.showModal();
  }
  function guestState(packet) {
    if (!running) {
      game.reset();
      running = true;
      dialog.close();
      $("#team-score").hidden = false;
    }
    targets = packet.targets;
    game.receive(packet);
    game.display(packet);
  }
  async function connect(join) {
    close();
    const token = generation;
    code = join || newCode();
    $("#team-code").textContent = code;
    show("lobby");
    $("#team-self").textContent = localName;
    notice.textContent = join ? "Joining room…" : "Opening room…";
    role = join ? "guest" : "host";
    try {
      const [{ default: Peer }, config] = await Promise.all([
        import("peerjs"),
        (async () => {
          try {
            const response = await fetch(endpoint, {
              method: "POST",
              signal: AbortSignal.timeout(4500),
            });
            if (response.ok)
              return { iceServers: (await response.json()).iceServers };
          } catch {}
        })(),
      ]);
      if (token !== generation) return;
      const options = config ? { config } : {};
      peer = join ? new Peer(options) : new Peer(prefix + code, options);
      const current = peer;
      const timer = setTimeout(() => {
        if (token === generation)
          error("Connection timed out. Open a new room or try joining again.");
      }, 20000);
      current.on("error", (e) => {
        if (token !== generation) return;
        if (!join && e.type === "unavailable-id") return connect();
        if (!join && running && e.type === "peer-unavailable") return;
        error("Room unavailable. Check the code or open a new room.");
      });
      current.on("open", () => {
        if (token !== generation) return;
        if (!join) {
          clearTimeout(timer);
          players.set("host", { name: localName, solves: 0 });
          nextPlayer = 2;
          scores();
          notice.textContent =
            "Share the code, then start the wave. Keep this tab visible while hosting.";
          $("#team-start").hidden = false;
          return;
        }
        host = current.connect(prefix + code, { reliable: true });
        host.on("open", () => {
          clearTimeout(timer);
          host.send({ type: "hello", name: localName });
          notice.textContent = "Connected. Waiting for the host to start.";
        });
        host.on("data", (p) => {
          if (token !== generation || !p) return;
          if (p.type === "scores") {
            players.clear();
            for (const [id, v] of p.rows) players.set(id, v);
            scores();
          } else if (p.type === "sync") guestState(p);
          else if (p.type === "accepted") game.accepted();
          else if (p.type === "identity") $("#team-self").textContent = localName;
        });
        host.on("close", () => {
          if (token === generation)
            error("The host left. Open or join another room.");
        });
      });
      current.on("connection", (conn) => {
        if (join) {
          conn.close();
          return;
        }
        conn.on("open", () => {
          if (token !== generation) return;
          if (pending.length) {
            broadcast({ type: "sync", ...game.snapshot(), events: pending });
            pending = [];
          }
          guests.set(conn.peer, conn);
          const name = "Player " + nextPlayer++;
          players.set(conn.peer, { name, solves: 0 });
          conn.send({ type: "identity", name });
          sendScores();
          if (running)
            conn.send({
              type: "sync",
              ...game.snapshot(),
              checkpoint: game.checkpoint(),
            });
        });
        conn.on("data", (p) => {
          if (token !== generation) return;
          if (p?.type === "hello" && players.has(conn.peer)) {
            players.get(conn.peer).name = playerName(p.name, players.get(conn.peer).name);
            sendScores();
            return;
          }
          if (
            token === generation &&
            running &&
            p?.type === "answer" &&
            typeof p.text === "string" &&
            p.text.length <= 80
          )
            game.answer(p.text, conn.peer, p.target);
        });
        conn.on("close", () => {
          if (token !== generation) return;
          guests.delete(conn.peer);
          sendScores();
        });
      });
    } catch {
      if (token === generation) error("Could not open the room. Try again.");
    }
  }
  $("#team-link").onclick = (e) => {
    e.preventDefault();
    if (!role) {
      game.hold();
      show("choice");
    } else show("lobby");
    dialog.showModal();
  };
  function choose(mode) {
    selectedMode = mode;
    show("details");
    $("#team-code-entry").hidden = mode !== "join";
    $("#team-connect").textContent = mode === "create" ? "Create game" : "Join game";
    $("#team-name").focus();
  }
  $("#team-create-choice").onclick = () => choose("create");
  $("#team-join-choice").onclick = () => choose("join");
  $("#team-previous").onclick = () => show("choice");
  $("#team-connect").onclick = () => {
    localName = playerName($("#team-name").value, "");
    if (!localName) {
      notice.textContent = "Enter your name to continue.";
      $("#team-name").focus();
      return;
    }
    const value = $("#team-input").value.trim().toUpperCase();
    if (selectedMode === "join" && !/^[A-Z0-9]{4}$/.test(value)) {
      notice.textContent = "Enter the four-character game code.";
      $("#team-input").focus();
      return;
    }
    connect(selectedMode === "join" ? value : undefined);
  };
  $("#team-start").onclick = () => {
    running = true;
    game.reset();
    dialog.close();
    $("#team-score").hidden = false;
    notice.textContent = "Team game in progress.";
    $("#team-start").hidden = true;
  };
  $("#team-back").onclick = () => {
    if (!running) {
      close();
      game.resume();
    }
    dialog.close();
  };
  dialog.oncancel = (e) => {
    e.preventDefault();
    $("#team-back").click();
  };
  $("#team-leave").onclick = () => {
    close();
    dialog.close();
    game.reset();
  };
  return {
    get guest() {
      return role === "guest";
    },
    get active() {
      return running;
    },
    credit(id) {
      if (running && players.has(id)) {
        players.get(id).solves++;
        guests.get(id)?.send({ type: "accepted" });
        sendScores();
      }
    },
    target(value) {
      return targets.find((t) => t.value === value);
    },
    submit(text, target) {
      if (host?.open && target)
        host.send({ type: "answer", text, target: target.id });
    },
    event(event) {
      if (role === "host" && running && guests.size) pending.push(event);
    },
    sync(t, force = false) {
      if (role !== "host" || !running || !guests.size) return;
      if (!force && !pending.length && t - lastSync < 3000) return;
      broadcast({ type: "sync", ...game.snapshot(), events: pending });
      pending = [];
      lastSync = t;
    },
  };
}
