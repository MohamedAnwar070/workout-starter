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

## Runtime modes tested

| Mode | Status |
|---|---|
| **Mock** | Tested on Linux (Node 22, headless Chromium). `npm run check`: 45/45. `npm run test:ui`: 10/10, including the full workout flow. Screenshots `04`–`07` in `evidence/screenshots/` come from that run. |
| **OpenAIAPI** | _Not yet verified with the current skill. Update this line after a live run._ |
| **ClaudeCLI** | Not tested. |
| **CodexCLI** | Disabled by the starter. |

Not tested on Windows or macOS.
