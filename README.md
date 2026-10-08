# AiRA workout starter

A local browser harness derived from AiRA API and AiRA client code. Read the short assignment in [docs/EXERCISE.md](docs/EXERCISE.md) and the completed [Submission Explanation](docs/EXPLANATION.md).

## Run

Requires Node.js 22.18 or later and npm. From this directory:

```sh
npm ci --ignore-scripts
npm start
```

Open http://127.0.0.1:4319. Stop with Ctrl+C. Change `PORT` in a local `.env` if needed.

The app starts in Mock and needs no account or key. Tap **Start a session**, or type a situation such as `hotel room, 10 minutes, quiet`, `legs, 2 min` or `I have a meeting in 10 minutes`. Mock runs a deterministic offline version of the workout flow (`src/server/mock.ts`): it reads place, minutes, focus and mood from the message, trims or rebalances the session on **Shorter, please** / **Give me longer rests**, and builds the receipt on **How did it go?** from the browser's real timer states. It follows the same rules as the skill but does not read it; only a live provider interprets `skills/workout.md`. **Load wiring sample** still displays the generic component examples, and `/demo`, `next`, `back` and `change value to 6` still work. Use your editor to change files. Prompt/skill edits load on the next request; source changes need a restart and browser reload.

## Files

- `skills/workout.md`: your interaction instructions.
- `prompts/`: output protocol and current-turn context.
- `src/shared/openui/`: parser, component registry, validation, navigation, timers and serialization.
- `src/web/`: browser renderers and presentation.
- `src/server/`: prompt loading, local HTTP server, mock and model adapters.
- `examples/wiring.openui`: generic offline fixture.

See [AiRA harness](docs/HARNESS.md) for the included plumbing and [runtime setup](docs/RUNTIMES.md) for optional model adapters.

## Check and package

```sh
npm run check
npx playwright install chromium
npm run test:ui
npm run package
```

The browser checks start a mock server on port 4320. To use an installed Chrome instead, set `PLAYWRIGHT_CHROME_PATH` to its absolute executable path.

Packaging writes `output/workout-source.zip` locally. It includes source and records changes against this starter's baseline; it excludes `.env`, dependencies, build output and repository history. It does not submit anything. Builder tools can export a local run; optional run JSON files can be placed in `runs/`. Keep credentials out of source and exports.

The supplied tests exercise local harness behavior with fake transports. Live OpenAI and Claude requests have not been verified. This browser slice is not the production AiRA application.
