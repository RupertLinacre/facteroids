const endpoint = "https://keep-it-going-relay.robinlinacre.workers.dev/ice";
const prefix = "factoroids-next-";
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
    targets = [];
  let previousFrame = 0,
    encoding = false,
    imageUrl;
  const screen = document.createElement("canvas");
  const ctx = screen.getContext("2d");
  const sky = new Image();
  sky.src = import.meta.env.BASE_URL + "skies/umbra-station.webp";

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
    $("#team-view").hidden = true;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = null;
    $("#team-score").hidden = true;
    $("#team-start").hidden = true;
    scores();
  }
  function error(message) {
    close();
    game.reset();
    game.hold();
    notice.textContent = message;
    if (!dialog.open) dialog.showModal();
  }
  function guestState(packet) {
    if (!running) {
      game.reset();
      running = true;
      dialog.close();
      $("#team-view").hidden = false;
      $("#team-score").hidden = false;
    }
    targets = packet.targets;
    game.display(packet);
    if (packet.image) {
      const old = imageUrl;
      imageUrl = URL.createObjectURL(
        new Blob([packet.image], { type: "image/webp" }),
      );
      $("#team-view").src = imageUrl;
      if (old) URL.revokeObjectURL(old);
    }
  }
  async function connect(join) {
    close();
    const token = generation;
    code = join || newCode();
    $("#team-code").textContent = code;
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
          players.set("host", { name: "Player 1", solves: 0 });
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
          notice.textContent = "Connected. Waiting for the host to start.";
        });
        host.on("data", (p) => {
          if (token !== generation || !p) return;
          if (p.type === "scores") {
            players.clear();
            for (const [id, v] of p.rows) players.set(id, v);
            scores();
          } else if (p.type === "frame") guestState(p);
          else if (p.type === "accepted") game.accepted();
          else if (p.type === "identity") $("#team-self").textContent = p.name;
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
          guests.set(conn.peer, conn);
          const name = "Player " + nextPlayer++;
          players.set(conn.peer, { name, solves: 0 });
          conn.send({ type: "identity", name });
          sendScores();
        });
        conn.on("data", (p) => {
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
      $("#team-self").textContent = "Player 1";
      connect();
    }
    dialog.showModal();
  };
  $("#team-join").onclick = () => {
    const value = $("#team-input").value.trim().toUpperCase();
    if (!/^[A-Z0-9]{4}$/.test(value)) {
      notice.textContent = "Enter the four-character room code.";
      return;
    }
    if (value !== code || !peer) connect(value);
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
    frame(t) {
      if (
        role !== "host" ||
        !running ||
        !guests.size ||
        encoding ||
        t - previousFrame < 100
      )
        return;
      previousFrame = t;
      const layers = [$(".model-layer"), $(".flight-layer")];
      const ratio = layers[0].clientWidth / Math.max(1, layers[0].clientHeight);
      const w = Math.round(Math.min(960, 720 * ratio)),
        h = Math.round(w / ratio);
      if (!w || !h) return;
      if (screen.width !== w || screen.height !== h) {
        screen.width = w;
        screen.height = h;
      }
      ctx.fillStyle = "#08101d";
      ctx.fillRect(0, 0, w, h);
      if (sky.naturalWidth) ctx.drawImage(sky, 0, 0, w, h);
      for (const layer of layers) ctx.drawImage(layer, 0, 0, w, h);
      const state = game.snapshot(),
        token = generation;
      encoding = true;
      screen.toBlob(
        async (blob) => {
          try {
            if (!blob) return;
            const image = await blob.arrayBuffer();
            if (generation !== token) return;
            for (const c of guests.values())
              if (c.open && c.dataChannel.bufferedAmount < 65000)
                c.send({ type: "frame", ...state, image });
          } finally {
            encoding = false;
          }
        },
        "image/webp",
        0.77,
      );
    },
  };
}
