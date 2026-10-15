# Boyd Family Escape Room

Offline cooperative browser escape room for Char, Vic, and Boyd. The helper bots locked the house control room — clear six themed rooms (crabs, rockets, sports, robots, word play, vault) to win the keys back.

Progress saves in `localStorage` on this device. No accounts, no network, no CDN fonts or scripts.

## How to play

1. Open the game and tap **Start Escape** (45:00 challenge timer) or **Relaxed Mode** (no timer pressure).
2. Rooms unlock in order. Finish both puzzles in a room to open the next.
3. Puzzles are tagged **Vic-size**, **Char-size**, or **Team** so everyone gets a turn.
4. Use up to 3 progressive hints per puzzle. Mute with the speaker button.
5. Clear the Final Vault to earn the Certificate of Escape.

## Run

```bash
./run.sh all      # build + screenshots + smoke test + start server
./run.sh start    # build + serve http://127.0.0.1:4352/
./run.sh test     # build + smoke test
./run.sh shots    # build + screenshots/
./run.sh stop
```

Offline single file: `dist/escape-room.html` (open in any browser; works with no server).

Health check: `http://127.0.0.1:4352/healthz`

## Layout

| Path | Role |
|------|------|
| `web/index.html` · `app.css` · `app.js` | Source |
| `build.py` | Inlines web/ → `dist/escape-room.html` |
| `server.py` | Stdlib server on port **4352** |
| `run.sh` | build / start / stop / status / shots / test / all |
| `tests/smoke_test.py` | Offline checks + headless Chrome full playthrough |
| `tests/shots.py` | 1280×800 gameplay screenshots |
| `screenshots/00-best-title.png` | Hero shot |
| `dist/escape-room.html` | Deliverable snapshot |

## Rooms & puzzles (11 total)

1. **Crab Shack Kitchen** — Plate Count (add) · Bay Cipher (Caesar −3)
2. **Launch Pad** — Stage Sequence (powers of 2) · Azimuth Dial (heading 0)
3. **Locker Room** — Jersey Scramble (anagram) · Scoreboard Math
4. **Robot Workshop** — Blink Pattern · Find the Override (hotspot)
5. **Word Library** — Pig-Pen Note · Shelf Slider (spell TEAM)
6. **Final Vault** — Master Code

---

## Spoilers / solution path

<details>
<summary>Click to reveal answers</summary>

| Puzzle | Answer |
|--------|--------|
| Plate Count | `16` (4+7+5) |
| Bay Cipher | `CRABS` (FDEEV shifted back by 3) |
| Stage Sequence | `16` (1→2→4→8→16) |
| Azimuth Dial | Lock dial at `0` |
| Jersey Scramble | `RAVENS` |
| Scoreboard Math | `14` (3×4 + 2) |
| Blink Pattern | `R` (or red) |
| Override wrench | Click the yellow wrench (or type `wrench`) |
| Pig-Pen Note | `OPEN` |
| Shelf Slider | First four tiles `TEAM` (or type TEAM) |
| Master Code | `161614` (kitchen + launch + locker number answers) |

</details>


---
## Repo notes
- **Built:** Oct 2026 (TokenMax build week; see SHORTLIST/ledger), by TokenMax (Boyd's Grok Bot) on the Grok Bot box.
- **Run:** `./run.sh` (then open the localhost URL it prints).
- Imported from `/workspace/tokenmax/escape-room` on Oct 23, 2026. node_modules, virtualenvs, logs and files over 20 MB were left out.
