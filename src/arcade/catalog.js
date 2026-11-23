export const worlds = [
  {
    slug: "orbital-defence",
    name: "Orbital Defence",
    type: "Orbital strategy",
    dimension: "2D",
    color: "#91e2c5",
    intro: "Split incoming rocks before their orbits cross the atmosphere.",
    detail:
      "Watch the dotted flight path. Each fragment receives a different orbital kick.",
    action: "Launch",
    loss: "Atmosphere breached",
  },
  {
    slug: "gravity-arcade",
    name: "Gravity Arcade",
    type: "Physics pinball",
    dimension: "2D",
    color: "#ffb8aa",
    intro:
      "Split heavy balls into a shower of musical pinballs before they drain.",
    detail:
      "Pegs scatter the balls. Prime fragments ring the bumpers as they burn away.",
    action: "Split",
    loss: "Ball drained",
  },
  {
    slug: "geode-breaker",
    name: "Geode Breaker",
    type: "Deep-space salvage",
    dimension: "3D",
    color: "#c9afff",
    intro: "Cut drifting basalt apart and uncover the crystals inside.",
    detail: "Collect the prime cores before the rock passes your salvage bay.",
    action: "Cut",
    loss: "Salvage missed",
  },
  {
    slug: "slipstream",
    name: "Slipstream",
    type: "Rhythm flight",
    dimension: "3D",
    color: "#84dff6",
    intro:
      "Fly low through a sunlit canyon. Factor the rocks in your flight path.",
    detail:
      "Typing slows the approach. The salvo lands on the beat and the pieces bank apart.",
    action: "Fire salvo",
    loss: "Flight path blocked",
  },
];
