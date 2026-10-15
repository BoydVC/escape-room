/* Boyd Family Escape Room — fully offline cooperative puzzle game */
(function () {
  "use strict";

  const STORAGE_KEY = "boyd-escape-room-v1";
  const DEFAULT_SECONDS = 45 * 60; // 45 min challenge

  // ---------- Audio (WebAudio, muteable) ----------
  const AudioFX = (() => {
    let ctx = null, muted = false;
    function ac() {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    }
    function tone(freq, dur, type, gain) {
      if (muted) return;
      try {
        const c = ac(), o = c.createOscillator(), g = c.createGain();
        o.type = type || "sine";
        o.frequency.value = freq;
        g.gain.value = gain || 0.08;
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
        o.connect(g); g.connect(c.destination);
        o.start(); o.stop(c.currentTime + dur);
      } catch (_) {}
    }
    return {
      get muted() { return muted; },
      setMuted(v) { muted = !!v; savePartial({ muted }); },
      click() { tone(520, 0.06, "triangle", 0.05); },
      ok() { tone(660, 0.1, "sine", 0.07); setTimeout(() => tone(880, 0.12, "sine", 0.07), 90); },
      bad() { tone(180, 0.18, "sawtooth", 0.05); },
      unlock() {
        [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, "sine", 0.08), i * 110));
      },
      win() {
        [523, 659, 784, 1046, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.2, "triangle", 0.09), i * 140));
      },
    };
  })();

  // ---------- Puzzle data ----------
  // Answers are normalized lowercase alphanumeric (see normalize)
  const ROOMS = [
    {
      id: "crab",
      name: "Crab Shack Kitchen",
      emoji: "🦀",
      theme: "Maryland",
      blurb: "Steam rises. Old Bay hangs in the air. The bots sealed the spice cabinet.",
      color: "#fb923c",
      puzzles: [
        {
          id: "crab-plates",
          title: "Plate Count",
          size: "Vic-size",
          type: "number",
          prompt: "Three platters of crabs sit on the counter. The labels say <strong>4</strong>, <strong>7</strong>, and <strong>5</strong> crabs. The keypad wants the <em>total</em> number of crabs.",
          art: "plates",
          answer: "16",
          accept: ["16"],
          hints: [
            "Add the three numbers on the platters.",
            "4 + 7 = 11. Now add the last platter.",
            "4 + 7 + 5 = 16. Enter 16.",
          ],
          reward: { key: "Old Bay Key", icon: "🧂" },
        },
        {
          id: "crab-cipher",
          title: "Bay Cipher",
          size: "Char-size",
          type: "text",
          prompt: "A sticky note uses a Caesar cipher (each letter shifted <strong>forward by 3</strong>). Decode: <strong>FDEEV</strong>",
          art: "cipher",
          answer: "crabs",
          accept: ["crabs", "crab"],
          hints: [
            "A Caesar shift of +3 means A→D, B→E, C→F… To decode, shift each letter <em>back</em> by 3.",
            "F←C, D←A, E←B, E←B, V←S…",
            "FDEEV → CRABS. Enter CRABS.",
          ],
          reward: { key: "Steam Timer", icon: "⏱️" },
        },
      ],
    },
    {
      id: "launch",
      name: "Launch Pad",
      emoji: "🚀",
      theme: "Space",
      blurb: "A miniature launch tower blinks. The countdown console is locked.",
      color: "#38bdf8",
      puzzles: [
        {
          id: "launch-seq",
          title: "Stage Sequence",
          size: "Vic-size",
          type: "number",
          prompt: "Fuel gauges climb in a pattern: <strong>1 → 2 → 4 → 8 → ?</strong> What number comes next?",
          art: "rocket",
          answer: "16",
          accept: ["16"],
          hints: [
            "Each number is double the one before it.",
            "1×2=2, 2×2=4, 4×2=8, so 8×2=?",
            "The next number is 16.",
          ],
          reward: { key: "Ignition Pin", icon: "🔌" },
        },
        {
          id: "launch-dial",
          title: "Azimuth Dial",
          size: "Team",
          type: "dial",
          prompt: "Turn the dial to the heading that matches the constellation cue. The plaque says: <strong>\"Point toward the North Star — heading 0.\"</strong> Set the dial to <strong>0</strong> and lock it.",
          art: "dial",
          answer: "0",
          accept: ["0"],
          dialTarget: 0,
          hints: [
            "The North Star (Polaris) is used to find north — heading 0°.",
            "Rotate the dial until the display shows 0.",
            "Lock the dial at 0.",
          ],
          reward: { key: "Star Chart", icon: "⭐" },
        },
      ],
    },
    {
      id: "locker",
      name: "Locker Room",
      emoji: "🏈",
      theme: "Sports",
      blurb: "Jerseys hang in a row. Cleats, bats, and a Chelsea scarf wait by the benches.",
      color: "#a78bfa",
      puzzles: [
        {
          id: "locker-anagram",
          title: "Jersey Scramble",
          size: "Char-size",
          type: "text",
          prompt: "Unscramble the letters on the locker nameplate: <strong>S N E V A R</strong>",
          art: "jersey",
          answer: "ravens",
          accept: ["ravens", "the ravens"],
          hints: [
            "It's a Baltimore NFL team.",
            "The letters spell a bird that is also purple and black.",
            "SNEVAR → RAVENS.",
          ],
          reward: { key: "Locker Tag", icon: "🏷️" },
        },
        {
          id: "locker-math",
          title: "Scoreboard Math",
          size: "Vic-size",
          type: "number",
          prompt: "The practice scoreboard shows: Orioles scored <strong>3</strong> runs each inning for <strong>4</strong> innings, then <strong>2</strong> more in the 5th. Total runs?",
          art: "scoreboard",
          answer: "14",
          accept: ["14"],
          hints: [
            "First find 3 runs × 4 innings.",
            "3 × 4 = 12, then add the 5th-inning 2.",
            "12 + 2 = 14.",
          ],
          reward: { key: "Whistle", icon: "📣" },
        },
      ],
    },
    {
      id: "robots",
      name: "Robot Workshop",
      emoji: "🤖",
      theme: "Bot Fleet",
      blurb: "Boyd's helper bots sit in charging docks. One of them holds the vault override.",
      color: "#4ade80",
      puzzles: [
        {
          id: "robots-pattern",
          title: "Blink Pattern",
          size: "Vic-size",
          type: "text",
          prompt: "Five bots blink status lights in this order (R=red, G=green): <strong>R G R G ?</strong> What color should the 5th light be? Type <strong>R</strong> or <strong>G</strong>.",
          art: "bots",
          answer: "r",
          accept: ["r", "red"],
          hints: [
            "Look at the alternating pattern.",
            "Odd positions are R, even are G.",
            "Position 5 is odd → R (red).",
          ],
          reward: { key: "Bot Badge", icon: "🦾" },
        },
        {
          id: "robots-hidden",
          title: "Find the Override",
          size: "Team",
          type: "hotspot",
          prompt: "One tool on the workbench is the <strong>override wrench</strong>. Tap / click it in the scene. (Hint shape: a wrench near the right side.)",
          art: "workbench",
          answer: "wrench",
          accept: ["wrench"],
          hotspotId: "wrench",
          hints: [
            "Look on the right side of the workbench.",
            "It's the L-shaped tool, not the screwdriver or the bolt bin.",
            "Click the wrench (highlighted once you find it).",
          ],
          reward: { key: "Override Wrench", icon: "🔧" },
        },
      ],
    },
    {
      id: "library",
      name: "Word Library",
      emoji: "📚",
      theme: "Word Play",
      blurb: "Shelves of dusty manuals. A pig-pen cipher is chalked on the blackboard.",
      color: "#fbbf24",
      puzzles: [
        {
          id: "library-pigpen",
          title: "Pig-Pen Note",
          size: "Char-size",
          type: "text",
          prompt: "The pig-pen grid (no dots) maps letters like a tic-tac-toe board:<br>A B C / D E F / G H I in the first three boxes (top row L→R), then J K L / M N O / P Q R, then S T U / V W X / Y Z for the bottom-style marks shown in the diagram. The chalkboard shows symbols for <strong>O P E N</strong>. Type the decoded word.",
          art: "pigpen",
          answer: "open",
          accept: ["open"],
          hints: [
            "Pig-pen puts letters in a # grid. The diagram labels each shape.",
            "Match each chalk symbol to the labeled letter under the matching shape.",
            "The symbols spell OPEN.",
          ],
          reward: { key: "Library Card", icon: "📖" },
        },
        {
          id: "library-slide",
          title: "Shelf Slider",
          size: "Team",
          type: "slide",
          prompt: "Slide the letter tiles (click a tile next to the empty square) so the first four tiles read <strong>TEAM</strong> left-to-right. The remaining tiles can be anything.",
          art: "slide",
          answer: "TEAM",
          accept: ["team"],
          slideGoal: ["T", "E", "A", "M"],
          hints: [
            "This is like a sliding puzzle. Slide tiles into the empty square.",
            "Get T into the top-left, then E, A, M across the top.",
            "When the first four tiles read TEAM, the lock opens automatically.",
          ],
          reward: { key: "Shelf Token", icon: "🧩" },
        },
      ],
    },
    {
      id: "vault",
      name: "Final Vault",
      emoji: "🔐",
      theme: "Escape",
      blurb: "All paths lead here. Enter the master code built from your adventure.",
      color: "#fb7185",
      puzzles: [
        {
          id: "vault-master",
          title: "Master Code",
          size: "Team",
          type: "text",
          prompt: "Combine the numeric clues you found: crabs total (<strong>16</strong>), stage sequence next (<strong>16</strong>), and Orioles runs (<strong>14</strong>). Enter them in order with no spaces: <strong>161614</strong>.",
          art: "vault",
          answer: "161614",
          accept: ["161614"],
          hints: [
            "Use the three number answers from earlier rooms, in room order: Kitchen, Launch Pad, Locker Room.",
            "Kitchen=16, Launch=16, Locker=14.",
            "Type 161614.",
          ],
          reward: { key: "House Key", icon: "🏠" },
        },
      ],
    },
  ];

  // ---------- State ----------
  let state = {
    screen: "title", // title | map | puzzle | victory | how
    roomIndex: 0,
    puzzleIndex: 0,
    solved: {}, // puzzleId -> true
    inventory: [],
    hintsUsed: 0,
    hintLevel: {}, // puzzleId -> 0..3 shown
    secondsLeft: DEFAULT_SECONDS,
    elapsed: 0,
    relaxed: false,
    muted: false,
    startedAt: null,
    timerId: null,
    dialValue: 0,
    slideTiles: null,
    feedback: "",
    feedbackOk: false,
    flash: null,
  };

  function normalize(s) {
    return String(s || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function allPuzzles() {
    const out = [];
    ROOMS.forEach((r, ri) => r.puzzles.forEach((p, pi) => out.push({ room: r, ri, puzzle: p, pi })));
    return out;
  }

  function roomUnlocked(ri) {
    if (ri === 0) return true;
    const prev = ROOMS[ri - 1];
    return prev.puzzles.every((p) => state.solved[p.id]);
  }

  function roomDone(ri) {
    return ROOMS[ri].puzzles.every((p) => state.solved[p.id]);
  }

  function current() {
    const room = ROOMS[state.roomIndex];
    const puzzle = room && room.puzzles[state.puzzleIndex];
    return { room, puzzle };
  }

  function savePartial(extra) {
    try {
      const data = {
        solved: state.solved,
        inventory: state.inventory,
        hintsUsed: state.hintsUsed,
        hintLevel: state.hintLevel,
        secondsLeft: state.secondsLeft,
        elapsed: state.elapsed,
        relaxed: state.relaxed,
        muted: AudioFX.muted,
        roomIndex: state.roomIndex,
        puzzleIndex: state.puzzleIndex,
        screen: state.screen === "victory" ? "victory" : state.screen === "title" ? "title" : "map",
        startedAt: state.startedAt,
        ...extra,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      Object.assign(state, {
        solved: d.solved || {},
        inventory: d.inventory || [],
        hintsUsed: d.hintsUsed || 0,
        hintLevel: d.hintLevel || {},
        secondsLeft: d.secondsLeft ?? DEFAULT_SECONDS,
        elapsed: d.elapsed || 0,
        relaxed: !!d.relaxed,
        roomIndex: d.roomIndex || 0,
        puzzleIndex: d.puzzleIndex || 0,
        screen: d.screen || "title",
        startedAt: d.startedAt || null,
      });
      AudioFX.setMuted(!!d.muted);
      return true;
    } catch (_) { return false; }
  }

  function clearSave() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
  }

  // ---------- Timer ----------
  function startTimer() {
    stopTimer();
    if (state.relaxed) return;
    state.timerId = setInterval(() => {
      state.elapsed += 1;
      if (!state.relaxed) {
        state.secondsLeft = Math.max(0, state.secondsLeft - 1);
        if (state.secondsLeft === 0) {
          stopTimer();
          state.feedback = "Time's up — switch to Relaxed mode from the map, or keep exploring!";
        }
      }
      savePartial();
      const hud = document.getElementById("hud-timer");
      if (hud) hud.textContent = formatTime(state.secondsLeft);
      if (hud && state.secondsLeft <= 60) hud.classList.add("low");
    }, 1000);
  }
  function stopTimer() {
    if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
  }
  function formatTime(s) {
    const m = Math.floor(s / 60), sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  // ---------- Solve ----------
  function grantReward(puzzle) {
    if (puzzle.reward && !state.inventory.find((i) => i.key === puzzle.reward.key)) {
      state.inventory.push({ ...puzzle.reward });
    }
  }

  function checkSolvedAll() {
    return allPuzzles().every(({ puzzle }) => state.solved[puzzle.id]);
  }

  function markSolved(puzzle) {
    if (state.solved[puzzle.id]) return false;
    state.solved[puzzle.id] = true;
    grantReward(puzzle);
    AudioFX.unlock();
    state.flash = { title: "Unlocked!", sub: puzzle.reward ? puzzle.reward.key : puzzle.title };
    savePartial();
    if (checkSolvedAll()) {
      setTimeout(() => {
        state.screen = "victory";
        stopTimer();
        AudioFX.win();
        savePartial({ screen: "victory" });
        render();
        burstConfetti();
      }, 900);
    }
    return true;
  }

  function submitAnswer(raw) {
    const { puzzle } = current();
    if (!puzzle) return { ok: false, reason: "no-puzzle" };
    if (state.solved[puzzle.id]) return { ok: true, already: true };

    let ok = false;
    if (puzzle.type === "hotspot") {
      ok = normalize(raw) === normalize(puzzle.hotspotId) || puzzle.accept.map(normalize).includes(normalize(raw));
    } else if (puzzle.type === "dial") {
      ok = String(state.dialValue) === String(puzzle.dialTarget) || puzzle.accept.map(normalize).includes(normalize(raw));
    } else if (puzzle.type === "slide") {
      ok = slideMatches(puzzle) || puzzle.accept.map(normalize).includes(normalize(raw));
    } else {
      const n = normalize(raw);
      ok = puzzle.accept.map(normalize).includes(n) || n === normalize(puzzle.answer);
    }

    if (ok) {
      state.feedback = "Correct!";
      state.feedbackOk = true;
      AudioFX.ok();
      markSolved(puzzle);
      render();
      return { ok: true, advanced: true };
    }
    state.feedback = "Not quite — try again.";
    state.feedbackOk = false;
    AudioFX.bad();
    render();
    return { ok: false };
  }

  function useHint() {
    const { puzzle } = current();
    if (!puzzle) return null;
    const lvl = state.hintLevel[puzzle.id] || 0;
    if (lvl >= 3) return puzzle.hints[2];
    state.hintLevel[puzzle.id] = lvl + 1;
    state.hintsUsed += 1;
    AudioFX.click();
    savePartial();
    render();
    return puzzle.hints[lvl];
  }

  // ---------- Slide puzzle ----------
  function initSlide() {
    // 3x3 with empty at end; scramble but solvable — fixed scramble for determinism
    state.slideTiles = ["T", "A", "E", "M", "X", "Y", "Z", "Q", null];
  }
  function slideMatches(puzzle) {
    if (!state.slideTiles) return false;
    const g = puzzle.slideGoal;
    return state.slideTiles[0] === g[0] && state.slideTiles[1] === g[1] &&
      state.slideTiles[2] === g[2] && state.slideTiles[3] === g[3];
  }
  function slideClick(i) {
    const t = state.slideTiles;
    const empty = t.indexOf(null);
    const row = Math.floor(i / 3), col = i % 3;
    const er = Math.floor(empty / 3), ec = empty % 3;
    if ((Math.abs(row - er) + Math.abs(col - ec)) !== 1) return;
    t[empty] = t[i]; t[i] = null;
    AudioFX.click();
    const { puzzle } = current();
    if (puzzle && slideMatches(puzzle)) {
      submitAnswer(puzzle.answer);
      return;
    }
    render();
  }

  // ---------- SVG art ----------
  function artSvg(kind) {
    const arts = {
      plates: `<svg viewBox="0 0 360 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Three crab platters">
        <rect width="360" height="160" rx="12" fill="#1a2740"/>
        <g transform="translate(30,30)">${platter(4)}</g>
        <g transform="translate(130,30)">${platter(7)}</g>
        <g transform="translate(230,30)">${platter(5)}</g>
      </svg>`,
      cipher: `<svg viewBox="0 0 360 140" xmlns="http://www.w3.org/2000/svg">
        <rect width="360" height="140" rx="12" fill="#1a2740"/>
        <text x="180" y="55" text-anchor="middle" fill="#5eead4" font-size="36" font-family="monospace" font-weight="700">F D E E V</text>
        <text x="180" y="100" text-anchor="middle" fill="#9bb0d0" font-size="14">Caesar shift +3 · decode back by 3</text>
      </svg>`,
      rocket: `<svg viewBox="0 0 360 180" xmlns="http://www.w3.org/2000/svg">
        <rect width="360" height="180" rx="12" fill="#0b1220"/>
        <path d="M180 20 L210 90 L180 160 L150 90 Z" fill="#38bdf8"/>
        <rect x="170" y="90" width="20" height="40" fill="#64748b"/>
        <path d="M150 90 L130 120 L150 110 Z" fill="#fb923c"/><path d="M210 90 L230 120 L210 110 Z" fill="#fb923c"/>
        <text x="40" y="50" fill="#fbbf24" font-size="18" font-weight="700">1</text>
        <text x="40" y="80" fill="#fbbf24" font-size="18" font-weight="700">2</text>
        <text x="40" y="110" fill="#fbbf24" font-size="18" font-weight="700">4</text>
        <text x="40" y="140" fill="#fbbf24" font-size="18" font-weight="700">8</text>
        <text x="40" y="168" fill="#5eead4" font-size="18" font-weight="700">?</text>
      </svg>`,
      dial: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><circle cx="100" cy="100" r="90" fill="#1e293b" stroke="#64748b" stroke-width="8"/><circle cx="100" cy="20" r="4" fill="#5eead4"/><text x="100" y="108" text-anchor="middle" fill="#5eead4" font-size="28" font-weight="700">N</text></svg>`,
      jersey: `<svg viewBox="0 0 360 160" xmlns="http://www.w3.org/2000/svg">
        <rect width="360" height="160" rx="12" fill="#1a2740"/>
        <path d="M140 30 L170 50 L190 50 L220 30 L240 55 L220 140 L140 140 L120 55 Z" fill="#241773" stroke="#a78bfa" stroke-width="3"/>
        <text x="180" y="100" text-anchor="middle" fill="#e8f0ff" font-size="22" font-weight="700">SNEVAR</text>
      </svg>`,
      scoreboard: `<svg viewBox="0 0 360 140" xmlns="http://www.w3.org/2000/svg">
        <rect width="360" height="140" rx="12" fill="#0b1220"/>
        <rect x="40" y="30" width="280" height="80" rx="8" fill="#14532d" stroke="#4ade80"/>
        <text x="180" y="60" text-anchor="middle" fill="#86efac" font-size="14">INNINGS 1–4: 3 runs each</text>
        <text x="180" y="90" text-anchor="middle" fill="#86efac" font-size="14">INNING 5: +2 runs</text>
      </svg>`,
      bots: `<svg viewBox="0 0 360 120" xmlns="http://www.w3.org/2000/svg">
        <rect width="360" height="120" rx="12" fill="#1a2740"/>
        ${[0,1,2,3,4].map((i) => {
          const c = i % 2 === 0 ? "#fb7185" : "#4ade80";
          const label = i % 2 === 0 ? "R" : "G";
          const x = 40 + i * 60;
          return `<g><rect x="${x}" y="30" width="44" height="50" rx="8" fill="#334155"/><circle cx="${x+22}" cy="48" r="10" fill="${i===4?"#64748b":c}"/><text x="${x+22}" y="95" text-anchor="middle" fill="#9bb0d0" font-size="14">${i===4?"?":label}</text></g>`;
        }).join("")}
      </svg>`,
      workbench: `<svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg" class="hotspot-svg">
        <rect width="400" height="200" rx="12" fill="#1c1917"/>
        <rect x="20" y="120" width="360" height="60" rx="4" fill="#44403c"/>
        <rect x="40" y="80" width="16" height="50" rx="2" fill="#78716c" class="hotspot" data-id="screwdriver"/>
        <circle cx="120" cy="100" r="18" fill="#57534e"/><circle cx="120" cy="100" r="8" fill="#a8a29e"/>
        <text x="120" y="140" text-anchor="middle" fill="#a8a29e" font-size="11">bolts</text>
        <path id="hs-wrench" class="hotspot" data-id="wrench" d="M300 70 l20 20 l-10 10 l-8-8 l-25 25 l-12-12 l25-25 l-8-8 z" fill="#fbbf24" stroke="#f59e0b" stroke-width="2"/>
        <rect x="200" y="90" width="40" height="28" rx="4" fill="#292524"/>
        <text x="200" y="50" fill="#a8a29e" font-size="12">Workbench</text>
      </svg>`,
      pigpen: `<svg viewBox="0 0 360 200" xmlns="http://www.w3.org/2000/svg">
        <rect width="360" height="200" rx="12" fill="#1a2740"/>
        <!-- grid labels -->
        <g fill="none" stroke="#94a3b8" stroke-width="2">
          <path d="M30 30 h60 v60 h-60 z"/><path d="M50 30 v60 M30 50 h60"/>
        </g>
        <text x="38" y="48" fill="#5eead4" font-size="11">A</text>
        <text x="58" y="48" fill="#5eead4" font-size="11">B</text>
        <text x="78" y="48" fill="#5eead4" font-size="11">C</text>
        <text x="38" y="68" fill="#5eead4" font-size="11">D</text>
        <text x="58" y="68" fill="#5eead4" font-size="11">E</text>
        <text x="78" y="68" fill="#5eead4" font-size="11">F</text>
        <text x="38" y="88" fill="#5eead4" font-size="11">G</text>
        <text x="58" y="88" fill="#5eead4" font-size="11">H</text>
        <text x="78" y="88" fill="#5eead4" font-size="11">I</text>
        <g fill="none" stroke="#94a3b8" stroke-width="2" transform="translate(110,30)">
          <path d="M0 0 h60 v60 h-60 z"/><path d="M20 0 v60 M0 20 h60"/>
        </g>
        <text x="148" y="48" fill="#5eead4" font-size="11">J</text>
        <text x="168" y="48" fill="#5eead4" font-size="11">K</text>
        <text x="188" y="48" fill="#5eead4" font-size="11">L</text>
        <text x="148" y="68" fill="#5eead4" font-size="11">M</text>
        <text x="168" y="68" fill="#5eead4" font-size="11">N</text>
        <text x="188" y="68" fill="#5eead4" font-size="11">O</text>
        <text x="148" y="88" fill="#5eead4" font-size="11">P</text>
        <text x="168" y="88" fill="#5eead4" font-size="11">Q</text>
        <text x="188" y="88" fill="#5eead4" font-size="11">R</text>
        <!-- message shapes for O P E N -->
        <text x="30" y="130" fill="#9bb0d0" font-size="13">Message:</text>
        <!-- O = middle of second grid = └┘ shape-ish: box bottom-middle is O at JKL/MNO/PQR → O is center -->
        <g transform="translate(40,145)" stroke="#fbbf24" stroke-width="3" fill="none">
          <!-- O: center cell of 2nd grid = four walls -->
          <path d="M0 0 h20 v20 h-20 z"/>
          <!-- P: bottom-left of 2nd = ┌ shape rotated: left+top+right open bottom? P is bottom-left: walls top right -->
          <path d="M35 20 v-20 h20" transform="translate(0,0)"/>
          <!-- simpler labeled -->
        </g>
        <text x="180" y="165" text-anchor="middle" fill="#fbbf24" font-size="28" font-weight="700" font-family="monospace">O · P · E · N</text>
        <text x="180" y="190" text-anchor="middle" fill="#9bb0d0" font-size="12">(symbols decoded on the board = OPEN)</text>
      </svg>`,
      slide: `<svg viewBox="0 0 200 40" xmlns="http://www.w3.org/2000/svg"><text x="100" y="28" text-anchor="middle" fill="#9bb0d0" font-size="14">Slide tiles to spell TEAM</text></svg>`,
      vault: `<svg viewBox="0 0 360 160" xmlns="http://www.w3.org/2000/svg">
        <rect width="360" height="160" rx="12" fill="#1a2740"/>
        <circle cx="180" cy="80" r="55" fill="#334155" stroke="#fb7185" stroke-width="6"/>
        <circle cx="180" cy="80" r="20" fill="#0f172a" stroke="#fbbf24" stroke-width="3"/>
        <text x="180" y="86" text-anchor="middle" fill="#fbbf24" font-size="14" font-weight="700">SAFE</text>
      </svg>`,
    };
    return arts[kind] || "";
  }
  function platter(n) {
    return `<circle cx="40" cy="45" r="38" fill="#44403c" stroke="#a8a29e"/><text x="40" y="52" text-anchor="middle" fill="#fb923c" font-size="22" font-weight="700">${n}</text><text x="40" y="100" text-anchor="middle" fill="#9bb0d0" font-size="11">crabs</text>`;
  }

  // ---------- Confetti ----------
  function burstConfetti() {
    const layer = document.createElement("div");
    layer.className = "confetti";
    const colors = ["#5eead4", "#38bdf8", "#a78bfa", "#fbbf24", "#fb7185", "#4ade80"];
    for (let i = 0; i < 60; i++) {
      const el = document.createElement("i");
      el.style.left = Math.random() * 100 + "%";
      el.style.background = colors[i % colors.length];
      el.style.animationDuration = 1.5 + Math.random() * 2 + "s";
      el.style.animationDelay = Math.random() * 0.5 + "s";
      layer.appendChild(el);
    }
    document.body.appendChild(layer);
    setTimeout(() => layer.remove(), 4000);
  }

  // ---------- Render ----------
  function el(html) {
    const d = document.createElement("div");
    d.innerHTML = html.trim();
    return d.firstChild;
  }

  function render() {
    const root = document.getElementById("app");
    root.innerHTML = "";
    if (state.flash) {
      const f = state.flash;
      state.flash = null;
      const flash = el(`<div class="unlock-flash"><div class="card"><div style="font-size:2rem">✨</div><h2 style="margin:8px 0">${esc(f.title)}</h2><p style="margin:0;color:#99f6e4">${esc(f.sub)}</p></div></div>`);
      document.body.appendChild(flash);
      setTimeout(() => flash.remove(), 1400);
    }

    if (state.screen === "title") return root.appendChild(renderTitle());
    if (state.screen === "how") return root.appendChild(renderHow());
    if (state.screen === "victory") return root.appendChild(renderVictory());
    if (state.screen === "puzzle") return root.appendChild(renderPuzzle());
    return root.appendChild(renderMap());
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function renderTitle() {
    const s = el(`<div class="screen">
      <div class="title-hero">
        ${heroArt()}
        <h1>Boyd Family Escape Room</h1>
        <p class="tag">The helper bots locked the house control room. Char, Vic, and Boyd must clear themed rooms — crabs, rockets, sports, robots, and word play — to win back the keys.</p>
        <div class="btn-row">
          <button class="btn" id="btn-start">Start Escape</button>
          <button class="btn secondary" id="btn-relaxed">Relaxed Mode</button>
          <button class="btn ghost" id="btn-how">How to Play</button>
          <button class="btn ghost" id="btn-continue" ${Object.keys(state.solved).length ? "" : "disabled"}>Continue</button>
        </div>
        <p style="color:var(--muted);font-size:.9rem">45-minute challenge · progressive hints · progress saves on this device</p>
      </div>
    </div>`);
    s.querySelector("#btn-start").onclick = () => startGame(false);
    s.querySelector("#btn-relaxed").onclick = () => startGame(true);
    s.querySelector("#btn-how").onclick = () => { state.screen = "how"; render(); };
    s.querySelector("#btn-continue").onclick = () => {
      if (!Object.keys(state.solved).length) return;
      state.screen = "map";
      startTimer();
      render();
    };
    return s;
  }

  function heroArt() {
    return `<svg class="hero-art" viewBox="0 0 520 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Family escape room hero">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#5eead4"/><stop offset="1" stop-color="#a78bfa"/></linearGradient></defs>
      <rect width="520" height="220" rx="24" fill="#142033"/>
      <rect x="40" y="50" width="120" height="130" rx="12" fill="#1a2740" stroke="url(#g)" stroke-width="3"/>
      <text x="100" y="120" text-anchor="middle" font-size="40">🦀</text>
      <text x="100" y="160" text-anchor="middle" fill="#9bb0d0" font-size="12">Kitchen</text>
      <rect x="200" y="40" width="120" height="140" rx="12" fill="#1a2740" stroke="#38bdf8" stroke-width="3"/>
      <text x="260" y="115" text-anchor="middle" font-size="40">🚀</text>
      <text x="260" y="160" text-anchor="middle" fill="#9bb0d0" font-size="12">Launch</text>
      <rect x="360" y="50" width="120" height="130" rx="12" fill="#1a2740" stroke="#a78bfa" stroke-width="3"/>
      <text x="420" y="120" text-anchor="middle" font-size="40">🤖</text>
      <text x="420" y="160" text-anchor="middle" fill="#9bb0d0" font-size="12">Bots</text>
      <circle cx="260" cy="30" r="10" fill="#fbbf24"/>
    </svg>`;
  }

  function renderHow() {
    const s = el(`<div class="screen">
      <div class="panel">
        <h2>How to Play</h2>
        <ol class="howto">
          <li>Work room by room — finish a room's puzzles to unlock the next.</li>
          <li>Puzzles are labeled <span class="chip vic">Vic-size</span> <span class="chip char">Char-size</span> <span class="chip team">Team</span> so everyone gets a turn.</li>
          <li>Use up to 3 hints per puzzle (they get more specific).</li>
          <li>Collected keys appear in your inventory.</li>
          <li>Mute with the speaker button. Progress auto-saves.</li>
          <li>Challenge mode has a 45:00 countdown; Relaxed mode has no timer pressure.</li>
        </ol>
        <div class="btn-row"><button class="btn" id="back">Back</button></div>
      </div>
    </div>`);
    s.querySelector("#back").onclick = () => { state.screen = "title"; render(); };
    return s;
  }

  function hudBar(extraRight) {
    const low = !state.relaxed && state.secondsLeft <= 60;
    return `<div class="hud">
      <div class="left">
        <button class="btn ghost" id="hud-map" style="padding:8px 12px">Map</button>
        <span class="chip">${state.relaxed ? "Relaxed" : "Challenge"}</span>
        <span class="timer ${low ? "low" : ""}" id="hud-timer">${state.relaxed ? "∞" : formatTime(state.secondsLeft)}</span>
      </div>
      <div class="right">
        <span class="chip">Hints: ${state.hintsUsed}</span>
        <button class="btn ghost" id="hud-mute" style="padding:8px 12px">${AudioFX.muted ? "🔇" : "🔊"}</button>
        ${extraRight || ""}
      </div>
    </div>`;
  }

  function bindHud(root) {
    const map = root.querySelector("#hud-map");
    if (map) map.onclick = () => { state.screen = "map"; state.feedback = ""; render(); };
    const mute = root.querySelector("#hud-mute");
    if (mute) mute.onclick = () => { AudioFX.setMuted(!AudioFX.muted); render(); };
  }

  function renderMap() {
    const cards = ROOMS.map((r, i) => {
      const locked = !roomUnlocked(i);
      const done = roomDone(i);
      const solvedCount = r.puzzles.filter((p) => state.solved[p.id]).length;
      return `<button class="room-card ${locked ? "locked" : ""} ${done ? "done" : ""}" data-ri="${i}" ${locked ? "disabled" : ""}>
        <div style="font-size:1.8rem">${r.emoji}</div>
        <h3>${esc(r.name)}</h3>
        <p>${esc(r.blurb)}</p>
        <p style="margin-top:8px;color:${r.color}">${solvedCount}/${r.puzzles.length} puzzles${done ? " ✓" : ""}</p>
        ${locked ? `<div class="lock-note">Finish the previous room first</div>` : ""}
      </button>`;
    }).join("");

    const inv = state.inventory.length
      ? `<div class="panel" style="margin-top:12px"><h3 style="margin:0 0 8px">Inventory</h3><div class="inv">${state.inventory.map((i) => `<div class="inv-item"><span class="ico">${i.icon}</span>${esc(i.key)}</div>`).join("")}</div></div>`
      : "";

    const s = el(`<div class="screen">
      ${hudBar()}
      <h2 style="margin:16px 0 4px">Control Room Map</h2>
      <p style="color:var(--muted);margin:0 0 8px">Clear each room to reach the Final Vault.</p>
      <div class="room-map">${cards}</div>
      ${inv}
      <div class="btn-row">
        <button class="btn ghost" id="btn-reset">Reset Progress</button>
      </div>
    </div>`);
    bindHud(s);
    s.querySelectorAll(".room-card").forEach((btn) => {
      btn.onclick = () => {
        const ri = +btn.dataset.ri;
        if (!roomUnlocked(ri)) return;
        state.roomIndex = ri;
        // first unsolved puzzle or 0
        const pi = ROOMS[ri].puzzles.findIndex((p) => !state.solved[p.id]);
        state.puzzleIndex = pi < 0 ? 0 : pi;
        state.feedback = "";
        state.screen = "puzzle";
        if (ROOMS[ri].puzzles[state.puzzleIndex].type === "slide" && !state.slideTiles) initSlide();
        if (ROOMS[ri].puzzles[state.puzzleIndex].type === "dial") state.dialValue = 45;
        render();
      };
    });
    s.querySelector("#btn-reset").onclick = () => {
      if (!confirm("Reset all progress?")) return;
      stopTimer();
      clearSave();
      state = {
        screen: "title", roomIndex: 0, puzzleIndex: 0, solved: {}, inventory: [],
        hintsUsed: 0, hintLevel: {}, secondsLeft: DEFAULT_SECONDS, elapsed: 0,
        relaxed: false, muted: AudioFX.muted, startedAt: null, timerId: null,
        dialValue: 0, slideTiles: null, feedback: "", feedbackOk: false, flash: null,
      };
      render();
    };
    return s;
  }

  function sizeChip(size) {
    const cls = size.startsWith("Vic") ? "vic" : size.startsWith("Char") ? "char" : "team";
    return `<span class="chip ${cls}">${esc(size)}</span>`;
  }

  function renderPuzzle() {
    const { room, puzzle } = current();
    if (!room || !puzzle) {
      state.screen = "map";
      return renderMap();
    }
    if (puzzle.type === "slide" && !state.slideTiles) initSlide();

    const hintLvl = state.hintLevel[puzzle.id] || 0;
    const hintHtml = hintLvl
      ? `<div class="hint-box">${esc(puzzle.hints.slice(0, hintLvl).map((h, i) => `Hint ${i + 1}: ${h}`).join("\n"))}</div>`
      : "";

    let interactive = "";
    if (puzzle.type === "dial") {
      interactive = `<div class="dial-wrap">
        <div class="dial" id="dial">
          <div class="mark" id="dial-mark" style="transform:rotate(${state.dialValue}deg)"></div>
          <div class="knob" id="dial-val">${state.dialValue}°</div>
        </div>
        <div class="dial-btns">
          <button class="btn secondary" id="dial-ccw">⟲ −15°</button>
          <button class="btn secondary" id="dial-cw">⟳ +15°</button>
          <button class="btn" id="dial-lock">Lock Dial</button>
        </div>
      </div>`;
    } else if (puzzle.type === "slide") {
      interactive = `<div class="slide-grid" id="slide-grid">${state.slideTiles.map((t, i) =>
        `<div class="slide-tile ${t === null ? "empty" : ""}" data-i="${i}">${t || ""}</div>`).join("")}</div>`;
    } else if (puzzle.type === "hotspot") {
      interactive = `<div class="hotspot-scene" id="hotspot-scene">${artSvg(puzzle.art)}</div>`;
    }

    const solved = !!state.solved[puzzle.id];
    const inputBlock = (puzzle.type === "dial" || puzzle.type === "slide" || puzzle.type === "hotspot")
      ? (puzzle.type !== "hotspot" && puzzle.type !== "dial" && puzzle.type !== "slide"
          ? ""
          : `<p style="color:var(--muted);font-size:.9rem;margin:8px 0 0">Or type the answer:</p>
             <input type="text" id="answer" autocomplete="off" spellcheck="false" placeholder="Answer" ${solved ? "disabled" : ""} />`)
      : `<input type="text" id="answer" autocomplete="off" spellcheck="false" placeholder="Your answer" ${solved ? "disabled" : ""} />`;

    const s = el(`<div class="screen">
      ${hudBar()}
      <div class="puzzle-shell">
        <div class="panel">
          <div class="meta">${sizeChip(puzzle.size)}<span class="chip">${esc(room.name)}</span>
            <span class="chip">${state.puzzleIndex + 1}/${room.puzzles.length}</span></div>
          <h2>${esc(puzzle.title)}</h2>
          <div class="clue">${puzzle.prompt}</div>
          <div class="art-box">${puzzle.type === "hotspot" ? "" : artSvg(puzzle.art)}</div>
          ${interactive}
          ${hintHtml}
        </div>
        <div class="panel answer-box">
          <label>Answer</label>
          ${inputBlock}
          <div class="feedback ${state.feedbackOk ? "good" : "bad"}" id="feedback">${esc(state.feedback)}</div>
          <div class="btn-row" style="justify-content:stretch">
            <button class="btn" id="btn-submit" ${solved ? "disabled" : ""}>${solved ? "Solved ✓" : "Submit"}</button>
            <button class="btn warn" id="btn-hint" ${hintLvl >= 3 || solved ? "disabled" : ""}>Hint (${hintLvl}/3)</button>
          </div>
          <div class="btn-row">
            <button class="btn secondary" id="btn-prev" ${state.puzzleIndex === 0 ? "disabled" : ""}>Prev</button>
            <button class="btn secondary" id="btn-next" ${state.puzzleIndex >= room.puzzles.length - 1 ? "disabled" : ""}>Next</button>
          </div>
          <div class="inv" style="margin-top:8px">${state.inventory.map((i) => `<div class="inv-item"><span class="ico">${i.icon}</span>${esc(i.key)}</div>`).join("")}</div>
        </div>
      </div>
    </div>`);
    bindHud(s);

    const go = () => {
      const input = s.querySelector("#answer");
      submitAnswer(input ? input.value : "");
    };
    const sub = s.querySelector("#btn-submit");
    if (sub) sub.onclick = go;
    const ans = s.querySelector("#answer");
    if (ans) ans.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });

    s.querySelector("#btn-hint").onclick = () => useHint();
    s.querySelector("#btn-prev").onclick = () => {
      if (state.puzzleIndex > 0) {
        state.puzzleIndex--;
        state.feedback = "";
        prepPuzzleUI();
        render();
      }
    };
    s.querySelector("#btn-next").onclick = () => {
      if (state.puzzleIndex < room.puzzles.length - 1) {
        state.puzzleIndex++;
        state.feedback = "";
        prepPuzzleUI();
        render();
      } else if (roomDone(state.roomIndex) && state.roomIndex < ROOMS.length - 1 && roomUnlocked(state.roomIndex + 1)) {
        state.roomIndex++;
        state.puzzleIndex = 0;
        state.feedback = "";
        prepPuzzleUI();
        render();
      } else {
        state.screen = "map";
        render();
      }
    };

    if (puzzle.type === "dial") {
      s.querySelector("#dial-cw").onclick = () => { state.dialValue = (state.dialValue + 15) % 360; AudioFX.click(); render(); };
      s.querySelector("#dial-ccw").onclick = () => { state.dialValue = (state.dialValue + 345) % 360; AudioFX.click(); render(); };
      s.querySelector("#dial-lock").onclick = () => submitAnswer(String(state.dialValue));
    }
    if (puzzle.type === "slide") {
      s.querySelectorAll(".slide-tile").forEach((t) => {
        t.onclick = () => slideClick(+t.dataset.i);
      });
    }
    if (puzzle.type === "hotspot") {
      s.querySelectorAll(".hotspot").forEach((h) => {
        h.addEventListener("click", () => {
          const id = h.getAttribute("data-id");
          if (id === puzzle.hotspotId) {
            h.classList.add("found");
            submitAnswer(id);
          } else {
            state.feedback = "That's not the override wrench.";
            state.feedbackOk = false;
            AudioFX.bad();
            render();
          }
        });
      });
    }
    return s;
  }

  function prepPuzzleUI() {
    const { puzzle } = current();
    if (!puzzle) return;
    if (puzzle.type === "slide") initSlide();
    if (puzzle.type === "dial") state.dialValue = 45;
  }

  function renderVictory() {
    const total = allPuzzles().length;
    const s = el(`<div class="screen">
      <div class="cert">
        <div style="font-size:2.5rem">🏆</div>
        <h1>Control Room Restored</h1>
        <p style="color:var(--muted);max-width:28rem;margin:0 auto">Certificate of Escape — Boyd Family Escape Room. Char, Vic, and Boyd outsmarted the helper bots and unlocked every door.</p>
        <div class="stats">
          <div class="stat"><b>${total}/${total}</b><span>Puzzles</span></div>
          <div class="stat"><b>${formatTime(state.elapsed)}</b><span>Time</span></div>
          <div class="stat"><b>${state.hintsUsed}</b><span>Hints used</span></div>
          <div class="stat"><b>${state.relaxed ? "Relaxed" : "Challenge"}</b><span>Mode</span></div>
        </div>
        <p style="color:var(--accent);font-weight:700">Keys recovered: ${state.inventory.map((i) => i.icon + " " + i.key).join(" · ")}</p>
        <div class="btn-row">
          <button class="btn" id="btn-again">Play Again</button>
          <button class="btn secondary" id="btn-map">View Map</button>
        </div>
      </div>
    </div>`);
    s.querySelector("#btn-again").onclick = () => {
      stopTimer();
      clearSave();
      const muted = AudioFX.muted;
      state = {
        screen: "title", roomIndex: 0, puzzleIndex: 0, solved: {}, inventory: [],
        hintsUsed: 0, hintLevel: {}, secondsLeft: DEFAULT_SECONDS, elapsed: 0,
        relaxed: false, muted, startedAt: null, timerId: null,
        dialValue: 0, slideTiles: null, feedback: "", feedbackOk: false, flash: null,
      };
      AudioFX.setMuted(muted);
      render();
    };
    s.querySelector("#btn-map").onclick = () => { state.screen = "map"; render(); };
    return s;
  }

  function startGame(relaxed) {
    stopTimer();
    clearSave();
    const muted = AudioFX.muted;
    state = {
      screen: "map", roomIndex: 0, puzzleIndex: 0, solved: {}, inventory: [],
      hintsUsed: 0, hintLevel: {}, secondsLeft: DEFAULT_SECONDS, elapsed: 0,
      relaxed: !!relaxed, muted, startedAt: Date.now(), timerId: null,
      dialValue: 0, slideTiles: null, feedback: "", feedbackOk: false, flash: null,
    };
    AudioFX.setMuted(muted);
    AudioFX.click();
    startTimer();
    savePartial();
    render();
  }

  // ---------- Test API ----------
  window.__ER__ = {
    ROOMS,
    getState: () => ({
      screen: state.screen,
      roomIndex: state.roomIndex,
      puzzleIndex: state.puzzleIndex,
      solved: { ...state.solved },
      inventory: state.inventory.slice(),
      hintsUsed: state.hintsUsed,
      secondsLeft: state.secondsLeft,
      elapsed: state.elapsed,
      relaxed: state.relaxed,
      dialValue: state.dialValue,
      slideTiles: state.slideTiles ? state.slideTiles.slice() : null,
      feedback: state.feedback,
    }),
    startGame: (relaxed) => startGame(!!relaxed),
    goRoom(ri, pi) {
      if (!roomUnlocked(ri)) {
        // force-unlock prior for testing by solving them? No — test should solve in order.
        return false;
      }
      state.roomIndex = ri;
      state.puzzleIndex = pi || 0;
      state.screen = "puzzle";
      state.feedback = "";
      prepPuzzleUI();
      render();
      return true;
    },
    submitAnswer,
    useHint,
    getCurrentPuzzle() {
      const { room, puzzle } = current();
      if (!puzzle) return null;
      return {
        id: puzzle.id,
        title: puzzle.title,
        type: puzzle.type,
        answer: puzzle.answer,
        accept: puzzle.accept.slice(),
        roomId: room.id,
        dialTarget: puzzle.dialTarget,
        hotspotId: puzzle.hotspotId,
        slideGoal: puzzle.slideGoal,
      };
    },
    setDial(v) { state.dialValue = ((v % 360) + 360) % 360; render(); },
    setSlideSolved() {
      // Place TEAM in first 4 slots for test
      state.slideTiles = ["T", "E", "A", "M", "X", "Y", "Z", "Q", null];
      render();
    },
    normalize,
    checkSolvedAll,
    formatTime,
    STORAGE_KEY,
    reset() {
      stopTimer();
      clearSave();
      state = {
        screen: "title", roomIndex: 0, puzzleIndex: 0, solved: {}, inventory: [],
        hintsUsed: 0, hintLevel: {}, secondsLeft: DEFAULT_SECONDS, elapsed: 0,
        relaxed: false, muted: false, startedAt: null, timerId: null,
        dialValue: 0, slideTiles: null, feedback: "", feedbackOk: false, flash: null,
      };
      render();
    },
  };

  // boot
  load();
  if (state.screen === "victory" || (state.screen !== "title" && Object.keys(state.solved).length)) {
    // keep loaded screen but don't auto-start timer until interaction on map
    if (state.screen === "puzzle") state.screen = "map";
  } else {
    state.screen = "title";
  }
  render();
})();
