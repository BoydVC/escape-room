// Full solution-path playthrough of Boyd Family Escape Room via window.__ER__.
import { pathToFileURL } from "node:url";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "./cdp.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const DIST = pathToFileURL(join(ROOT, "dist", "escape-room.html")).href;

const checks = [];
function check(ok, msg, info = "") {
  checks.push({ ok: !!ok, msg, info });
}

const PATH = [
  // room, puzzleIndex, how
  { ri: 0, pi: 0, answer: "16" },
  { ri: 0, pi: 1, answer: "crabs" },
  { ri: 1, pi: 0, answer: "16" },
  { ri: 1, pi: 1, kind: "dial", dial: 0 },
  { ri: 2, pi: 0, answer: "ravens" },
  { ri: 2, pi: 1, answer: "14" },
  { ri: 3, pi: 0, answer: "r" },
  { ri: 3, pi: 1, answer: "wrench" },
  { ri: 4, pi: 0, answer: "open" },
  { ri: 4, pi: 1, kind: "slide" },
  { ri: 5, pi: 0, answer: "161614" },
];

async function main() {
  const c = await launch({ width: 1280, height: 800, port: 9435 });
  try {
    await c.goto(DIST);
    check(await c.ev("typeof window.__ER__ === 'object'"), "__ER__ test API present");
    const title = await c.ev("document.title");
    check(title.includes("Escape"), "document title", title);
    const rooms = await c.ev("window.__ER__.ROOMS.length");
    const puzzles = await c.ev("window.__ER__.ROOMS.reduce((n,r)=>n+r.puzzles.length,0)");
    check(rooms === 6, "6 rooms", String(rooms));
    check(puzzles === 11, "11 puzzles", String(puzzles));

    // UI: start via button (first puzzle path also covers relaxed/API)
    await c.ev("window.__ER__.reset()");
    await c.click("#btn-start");
    await sleep(200);
    let st = await c.ev("JSON.stringify(window.__ER__.getState())").then(JSON.parse);
    check(st.screen === "map", "Start Escape reaches map", st.screen);

    // First puzzle via real UI clicks
    await c.click('.room-card[data-ri="0"]');
    await sleep(200);
    st = await c.ev("JSON.stringify(window.__ER__.getState())").then(JSON.parse);
    check(st.screen === "puzzle" && st.puzzleIndex === 0, "opened first puzzle", JSON.stringify(st));
    await c.ev(`(() => { const i = document.querySelector('#answer'); i.value = '16'; document.querySelector('#btn-submit').click(); })()`);
    await sleep(400);
    st = await c.ev("JSON.stringify(window.__ER__.getState())").then(JSON.parse);
    check(!!st.solved["crab-plates"], "first puzzle solved via UI", JSON.stringify(st.solved));

    // Continue full path via __ER__ (after reset of remaining — keep first solved)
    // Reset and use API for deterministic full clear
    await c.ev("window.__ER__.reset()");
    await c.ev("window.__ER__.startGame(true)"); // relaxed
    await sleep(150);

    for (const step of PATH) {
      const okGo = await c.ev(`window.__ER__.goRoom(${step.ri}, ${step.pi})`);
      check(okGo, `goRoom(${step.ri},${step.pi})`, String(okGo));
      const cur = await c.ev("JSON.stringify(window.__ER__.getCurrentPuzzle())").then(JSON.parse);
      if (step.kind === "dial") {
        await c.ev(`window.__ER__.setDial(${step.dial})`);
        const r = await c.ev(`JSON.stringify(window.__ER__.submitAnswer(String(${step.dial})))`).then(JSON.parse);
        check(r.ok, `solve dial ${cur.id}`, JSON.stringify(r));
      } else if (step.kind === "slide") {
        await c.ev("window.__ER__.setSlideSolved()");
        const r = await c.ev(`JSON.stringify(window.__ER__.submitAnswer('TEAM'))`).then(JSON.parse);
        check(r.ok, `solve slide ${cur.id}`, JSON.stringify(r));
      } else {
        const r = await c.ev(`JSON.stringify(window.__ER__.submitAnswer(${JSON.stringify(step.answer)}))`).then(JSON.parse);
        check(r.ok, `solve ${cur.id} with ${step.answer}`, JSON.stringify(r));
      }
      await sleep(80);
    }

    // Wait for victory screen (markSolved delays 900ms)
    let victory = false;
    for (let i = 0; i < 30; i++) {
      await sleep(200);
      st = await c.ev("JSON.stringify(window.__ER__.getState())").then(JSON.parse);
      if (st.screen === "victory") { victory = true; break; }
    }
    check(victory, "victory screen reached", st.screen);
    check(await c.ev("window.__ER__.checkSolvedAll()"), "all puzzles marked solved");
    const inv = await c.ev("window.__ER__.getState().inventory.length");
    check(inv === 11, "11 inventory keys", String(inv));

    // Wrong answer feedback
    await c.ev("window.__ER__.reset()");
    await c.ev("window.__ER__.startGame(true)");
    await c.ev("window.__ER__.goRoom(0,0)");
    const bad = await c.ev(`JSON.stringify(window.__ER__.submitAnswer('999'))`).then(JSON.parse);
    check(!bad.ok, "wrong answer rejected");

    // Network: only file/data expected after load
    const badNet = c.requests.filter((u) => /^https?:/i.test(u));
    check(badNet.length === 0, "no external network requests during play", badNet.slice(0, 3).join(", "));

    const jsErr = c.errors.filter((e) => !/favicon/i.test(e));
    check(jsErr.length === 0, "no console/JS errors", jsErr.slice(0, 3).join(" | "));
  } catch (e) {
    check(false, "play.mjs exception", String(e && e.stack || e));
  } finally {
    await c.close();
  }

  const out = {
    checks,
    passed: checks.filter((c) => c.ok).length,
    failed: checks.filter((c) => !c.ok).length,
  };
  console.log(JSON.stringify(out));
  process.exit(out.failed ? 1 : 0);
}

main();
