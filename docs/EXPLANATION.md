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

## Where it lives

- `skills/workout.md`: how Aira directs a session (situation reading, the plan arithmetic, screen grammar, voice, live rewrite and receipt rules), with examples generated from the mock so the two agree.
- `src/server/mock.ts`: a deterministic offline director that follows the same rules, so the whole flow can be tried without a key. It does not read the skill.
- `src/web/`: a restyled canvas with a short fade between screens that turns off for reduced-motion users. The empty state has a **Start a session** button, and empty chat replies are hidden.
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

Results on the same nine scenarios (`runs/eval-*.json`):

| Skill · model | Scenarios fully correct | Checks passed |
|---|---|---|
| Starter skill · gpt-4o-mini | 0/9 | 17/36 |
| This skill · gpt-4o-mini | 3/9 | 104/121 |
| This skill · gpt-4.1-mini | 3/9 | 87/98 |
| This skill · gpt-4.1 | 5/9 | 116/121 |

Check totals differ because a turn that fails outright skips the checks that depend on it. Single runs vary by a few checks.

What the evals changed in the skill:

- **Fence first, sentence last.** Small models often wrote the sentence and stopped, leaving the screen unchanged. Putting the screen first removed that failure entirely.
- **Look up the plan, don't calculate it.** Models are unreliable at arithmetic, so the skill carries an exact plan table generated from the same planner as the mock.
- **Receipts count after listing.** gpt-4.1 once headlined "1 of 3" over a list showing two finished blocks. Writing the list first, then counting it, fixed that in the live browser run.
- **Explicit name reuse.** One model renamed timers during a patch, which would silently reset a running clock. The skill now says so directly.

What still fails, honestly:

- the longest plans occasionally drift by a minute;
- one model renames timers on "longer rests";
- an occasional cue runs to ten words;
- in the live browser run, the receipt said a never-started rest "stopped with 1 min left" and offered "shorter" even though most blocks ran;
- gpt-4o-mini sometimes breaks the reply format itself.

A platform fix would move timer arithmetic out of the model entirely, either as a planner tool or a validate-and-retry step on the server. I'd want to discuss that rather than build it into this slice.

## Runtime modes tested

| Mode | Status |
|---|---|
| **Mock** | Linux, Node 22, headless Chromium. `npm run check`: 46/46. `npm run test:ui`: 10/10, including the full workout flow. Screenshots 04–07 come from that run. |
| **OpenAIAPI** | Live, Linux. `npm run eval` on gpt-4o-mini, gpt-4.1-mini and gpt-4.1 (table above), plus one browser session on gpt-4.1 exported as `runs/after.json`. That session ran hotel 10 min → "Shorter" mid-block (10 → 9 min, alert on the rest screen) → receipt "2 of 3". Screenshots 08–09 come from it. gpt-4.1 is the model I'd recommend; gpt-4o-mini is not reliable enough for this skill. |
| **ClaudeCLI** | Not tested. |
| **CodexCLI** | Disabled by the starter. |

Not tested on Windows or macOS.
