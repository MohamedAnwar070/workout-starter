# What I built

**The screen waits for the person, never the person for the screen.**

A workout is a hands-busy moment. So Aira reads the situation from one message, builds the whole session at once, shows one thing per screen, speaks only at the seams, and stays quiet while a clock runs.

## The experience

1. **One message, no interview.** "Hotel room, 10 minutes, keep it quiet" becomes a full session on the first turn. A vague "hi" gets a single question with four one-tap situations, never a chat. The arrival screen shows the reading ("Hotel room. Quiet. Two blocks.") with a **Somewhere else** chip, so one tap corrects it.
2. **The situation shapes the session.**
   - Minutes set the structure: 1–3 min is a single block; longer sessions add a warm-up, rests and up to three blocks.
   - Mood sets the rests: tired gets 90 s, "ready to go" gets 30 s.
   - Place sets the tone: a hotel, an office or before a meeting is quiet.
   - Focus names the blocks ("Lower block one") without describing a single movement.
   - "A meeting in 10 minutes" is read as a window, not a length: the session is 8 minutes, so there are two to spare.
3. **The numbers are always true.** The timers add up to exactly the minutes on screen, "2 of 3" means there really are three, and every timer has a unique label so events can be told apart.
4. **Mid-session changes touch only the future.**
   - **Shorter** trims the blocks ahead and keeps the rests.
   - **Longer rests** takes the time from the blocks ahead, so the person still fits their window.
   - The block they are in is never re-rendered. The change is announced with an alert where it lands and one sentence in the chat.
   - On a rest, if nothing can change, Aira says the clock can be paused: nothing moves until they tap Next.
5. **An honest receipt.** "How did it go?" counts the browser's own timer snapshot: what ran to zero, what stopped partway, what was never started, and any resets. Skipping everything gives "None of the three block clocks ran this time, and that's fine". There is no applause and no invented numbers. The next-time chip adapts: two minutes longer if most of it ran, shorter if not.
6. **Boundaries.** Fictional and synthetic: no exercise names, reps, intensity or health advice. Mentioning pain or dizziness replaces the session with a quiet stop screen.
7. **Glanceable from across the room.** Each clock is a ring that empties as time runs, readable without reading digits. At zero it turns green and says "Time. Next when you're ready.", and Next lights up, because a person with busy hands isn't watching the numbers.
8. **A component of my own: `SessionMap`.** One bar for the whole session, each segment sized by its length. On arrival it shows the shape of what's ahead. On the close it shows what actually ran: ran, partly, not started. The model only decides *where* the map goes. The app draws it from the real Timers and their local states, so it can't report a block that didn't run, and the close screen is truthful the moment the person arrives, before any model turn.
9. **Focus mode while the clock runs.** Once the session starts (the first clock screen), everything but the workout steps aside: page header, chat, builder tools. The screen fills the window with Back/Next and Aira's line pinned at the bottom, sized to fit from a phone to a large monitor. It ends on the close, so the receipt appears next to the chat. The chat is one tap away ("Show chat" or Esc), and a failed reply brings it back automatically so Retry is never hidden. The panel glides to its new place on entry and exit. Focus mode only applies to planned sessions (marked by a `SessionMap`), not the starter's wiring sample.
10. **The whole app fits the window.** Outside focus mode the workspace is exactly as tall as the window below the header and mode bar: the chat scrolls inside its column with the message box always visible, and the screen keeps Back/Next and Aira's line at the bottom. On phones the screen panel is one window tall with the chat below. Measured on every screen state at 390×844, 768×1024, 1024×768, 1280×720, 1366×768, 1440×900, 1920×930 and 1920×1080: nothing needs scrolling. Only a 360×640 phone scrolls inside the screen, with Next and Aira's line still visible.

## Where it lives

- `skills/workout.md`: how Aira directs a session (situation reading, the plan arithmetic, screen grammar, voice, live rewrite and receipt rules), with examples generated from the mock so the two agree.
- `src/server/mock.ts`: a deterministic offline director that follows the same rules, so the whole flow can be tried without a key. It does not read the skill.
- `src/web/`: a restyled canvas with a short fade between screens that turns off for reduced-motion users. The empty state has a **Start a session** button, and empty chat replies are hidden.
- `SessionMap` follows the starter's component path: signature in `src/shared/openui/openui-library.ts`, prop validation in `validate.ts`, a trusted renderer in `src/web/components.ts`. The ring timer and done state are changes to the existing Timer renderer.
- `tests/workout.test.mjs` and `tests/browser/workout.spec.mjs` cover the experience itself: timer sums for every length from 1 to 60 minutes, situation reading, future-only patches, the receipt and the safety stop.

## Testing the AI, not just the code

The mock proves the experience; only a live model proves the skill. `scripts/eval.mjs` (`npm run eval -- --consent`) sends nine fixed situations to the real model, using the app's own prompt loader and provider. Between turns it simulates what the browser would report (steps, timers started, finished or skipped, and the per-timer snapshot), then checks every reply against the skill's rules. The situations are:

- a greeting;
- a chip;
- hotel, then "Shorter" mid-block, then the receipt;
- gym, then longer rests;
- 1-minute legs;
- a meeting in 10 minutes;
- everything skipped;
- pain mid-session;
- a prompt injection.

Results (`runs/eval-*.json`; each file records the model and the skill hash it ran against):

| Model | Skill version | Scenario runs fully correct | Checks |
|---|---|---|---|
| gpt-4o-mini | starter's empty skill | 0/9 | 17/36 |
| gpt-4o-mini | earlier revision | 3/9 | 104/121 |
| gpt-4.1-mini | earlier revision | 3/9 | 87/98 |
| gpt-5 | earlier revision | 6/6 that finished; 3 cut off (see below) | 64/68 |
| gpt-5.1 | one revision before final | 6/9 | 118/121 |
| gpt-4.1 | final, before `SessionMap` | 7/9 | 119/121 |
| **gpt-5.2** | **final, before `SessionMap`** | **20/20 runs that completed** (3 rounds × 9; 7 runs were stopped by my account's rate limit, not by a wrong answer) | 262/270 |

Check totals differ because a turn that fails outright skips the checks that depend on it. `SessionMap` was added after these runs. The eval now also checks that the model places it on the arrival and the close, but that check has not run live yet: my account had reached its rate limit.

The point of running the strongest available model was to separate my mistakes from the model's. Every gpt-5.2 failure on earlier revisions traced back to the skill:
- the greeting gained an extra "about" screen because the skill said "a single page", not exactly one screen;
- `Screen([...], true)` was rejected because the skill never said `Screen` takes only its children;
- a 20-minute plan dropped a block because the plan table was bare numbers, not named rows with totals.

The eval script also had a bug of its own: it flagged a refusal ("I can't provide reps or links") as a prescription.

gpt-5 answered correctly whenever it finished, but it averages about 29 s per turn and three replies hit the starter's 3,000-token output cap. A half-minute pause after "Shorter, please" breaks a hands-busy experience, so I'd run this on **gpt-5.2**: 4.6 s median per turn, and correct in every completed run.

What the evals changed in the skill:

- **Fence first, sentence last.** Small models often wrote the sentence and stopped, leaving the screen unchanged. Putting the screen first removed that failure entirely.
- **Look up the plan, don't calculate it.** Models are unreliable at arithmetic, so the skill carries an exact plan table generated from the same planner as the mock.
- **Receipts count after listing.** gpt-4.1 once headlined "1 of 3" over a list showing two finished blocks. Writing the list first, then counting it, fixed that in the live browser run.
- **Explicit name reuse.** One model renamed timers during a patch, which would silently reset a running clock. The skill now says so directly.
- **Named plan rows with totals.** Every plan line spells out each timer and the sum, so a model copies it instead of improvising.
- **Exact structure for the greeting, and how to remove things.** One `s_hello` screen and nothing else; to remove an alert, repeat the screen without it (gpt-4.1 had written `r2_alert = None`).

What still fails, honestly. These are all on older or smaller models; gpt-5.2 had no failures on the final skill:

- the longest plans occasionally drift by a minute (gpt-4.1, gpt-5.1);
- gpt-4.1 sometimes renames timers on "longer rests";
- an occasional cue runs to ten words;
- in the live browser run, the receipt said a never-started rest "stopped with 1 min left" and offered "shorter" even though most blocks ran;
- gpt-4o-mini sometimes breaks the reply format itself;
- gpt-4.1 once wrote the screen outside its fence; the server now rejects that and offers Retry instead of showing code in the chat.

A platform fix would move timer arithmetic out of the model entirely, either as a planner tool or a validate-and-retry step on the server. I'd want to discuss that rather than build it into this slice.

## Runtime modes tested

| Mode | Status |
|---|---|
| **Mock** | Linux, Node 22, headless Chromium. `npm run check`: 48/48. `npm run test:ui`: 11/11, including the full workout flow and focus mode. Screenshots 04–07 come from that run. |
| **OpenAIAPI** | Live, Linux. `npm run eval` on gpt-4o-mini, gpt-4.1-mini, gpt-4.1, gpt-5, gpt-5.1 and gpt-5.2 (table above), plus one browser session on gpt-4.1 (earlier skill revision) exported as `runs/after.json`. That session ran hotel 10 min → "Shorter" mid-block (10 → 9 min, alert on the rest screen) → receipt "2 of 3". Screenshots 08–09 come from it. **gpt-5.2 is the model I'd recommend**; gpt-4o-mini is not reliable enough for this skill. |
| **ClaudeCLI** | Not tested. |
| **CodexCLI** | Disabled by the starter. |

Not tested on Windows or macOS.
