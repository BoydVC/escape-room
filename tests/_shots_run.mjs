import { pathToFileURL } from "node:url";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "./cdp.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const DIST = pathToFileURL(join(ROOT, "dist", "escape-room.html")).href;
const OUT = join(ROOT, "screenshots");

async function main() {
  const c = await launch({ width: 1280, height: 800, port: 9436 });
  try {
    await c.goto(DIST, 600);
    await c.ev("window.__ER__.reset()");
    await sleep(400);
    await c.shot(join(OUT, "00-best-title.png"));
    await c.shot(join(OUT, "01-title.png"));

    await c.ev("window.__ER__.startGame(true)");
    await sleep(350);
    await c.shot(join(OUT, "02-map.png"));

    await c.ev("window.__ER__.goRoom(0,0)");
    await sleep(300);
    await c.shot(join(OUT, "03-puzzle-plates.png"));

    for (const [ri, pi, a] of [[0, 0, "16"], [0, 1, "crabs"], [1, 0, "16"]]) {
      await c.ev(`window.__ER__.goRoom(${ri},${pi})`);
      await c.ev(`window.__ER__.submitAnswer(${JSON.stringify(a)})`);
      await sleep(80);
    }
    await c.ev("window.__ER__.goRoom(1,1)");
    await c.ev("window.__ER__.setDial(0)");
    await sleep(250);
    await c.shot(join(OUT, "04-dial.png"));

    await c.ev("window.__ER__.submitAnswer('0')");
    await c.ev("window.__ER__.goRoom(2,0)");
    await sleep(250);
    await c.shot(join(OUT, "05-jersey.png"));

    for (const [ri, pi, a] of [[2, 0, "ravens"], [2, 1, "14"], [3, 0, "r"], [3, 1, "wrench"], [4, 0, "open"]]) {
      await c.ev(`window.__ER__.goRoom(${ri},${pi})`);
      await c.ev(`window.__ER__.submitAnswer(${JSON.stringify(a)})`);
      await sleep(50);
    }
    await c.ev("window.__ER__.goRoom(4,1)");
    await c.ev("window.__ER__.setSlideSolved()");
    await c.ev("window.__ER__.submitAnswer('TEAM')");
    await sleep(80);
    await c.ev("window.__ER__.goRoom(5,0)");
    await sleep(250);
    await c.shot(join(OUT, "06-vault.png"));
    await c.ev("window.__ER__.submitAnswer('161614')");
    for (let i = 0; i < 25; i++) {
      await sleep(200);
      if ((await c.ev("window.__ER__.getState().screen")) === "victory") break;
    }
    await sleep(500);
    await c.shot(join(OUT, "07-victory.png"));
    console.log("shots done");
  } finally {
    await c.close();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
