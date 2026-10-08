import { serializeStatement } from '../shared/openui/serialize.js';
import type { Message, RequestData, Turn } from '../shared/contracts.js';
import { ScreenDocument } from '../shared/openui/document.js';
import type { StatementNode } from '../shared/openui/openui-model.js';

// Deterministic offline director for the workout flow. It follows the same rules as
// skills/workout.md so the experience can be tried without a model, but it never reads
// the skill: a live provider is the only thing that interprets it.

type Kind = 'warm' | 'block' | 'rest';
type Step = { id: string; kind: Kind; label: string; seconds: number };
type Vibe = 'quiet' | 'gentle' | 'brisk' | 'steady';
type Situation = { minutes: number; place?: string; focus?: string; vibe: Vibe; buffer: number; capped: boolean };
type Session = { steps: Step[]; index: number; keys: string[]; cursor: string; reading: string };

const fence = (code: string) => '```openui\n' + code + '\n```';
const clear = fence('root = Screens([])');
const st = serializeStatement;
const refs = (name: string, component: string, children: string[]) => `${name} = ${component}([${children.join(', ')}])`;
const ACCENT = '#C2410C';
const REST: Record<Vibe, number> = { quiet: 60, steady: 60, gentle: 90, brisk: 30 };

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty'];
const words = (n: number) => n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const plural = (n: number, unit: string) => `${words(n)} ${unit}${n === 1 ? '' : 's'}`;
const dur = (seconds: number) => {
  const m = Math.floor(seconds / 60), s = seconds % 60;
  return m && s ? `${m} min ${s} s` : m ? `${m} min` : `${s} s`;
};
const total = (steps: Step[]) => steps.reduce((sum, step) => sum + step.seconds, 0);
const active = (steps: Step[]) => steps.filter(step => step.kind !== 'rest');

// ---- Reading the situation from the person's own words ----

const WORD_MINUTES: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15, 'twenty-five': 25, twenty: 20, thirty: 30, 'forty-five': 45, forty: 40, sixty: 60 };
const MINUTES = new RegExp(`(\\bin\\s+)?\\b(\\d{1,3}|${Object.keys(WORD_MINUTES).join('|')})\\s*-?\\s*(?:minutes?|mins?|m)\\b`);
const PLACES: [RegExp, string, Vibe?][] = [
  [/hotel/, 'Hotel room', 'quiet'],
  [/office|desk|\bwork\b|cubicle/, 'At work', 'quiet'],
  [/\bgym\b/, 'Gym'],
  [/bedroom/, 'Bedroom', 'quiet'],
  [/living room|\bhome\b|\bhouse\b|apartment|\bflat\b/, 'Home'],
  [/\bpark\b|outside|outdoors|garden|balcony|terrace/, 'Outdoors'],
  [/meeting|\bcall\b|interview/, 'Before a meeting', 'quiet'],
];
const FOCUS: [RegExp, string, string | undefined][] = [
  [/full[ -]?body|whole body/, 'Full body', undefined],
  [/\blegs?\b|lower|glute|thigh|calf|calves/, 'Lower', 'Lower'],
  [/chest|\barms?\b|upper|shoulder|bicep|tricep/, 'Upper', 'Upper'],
  [/\bcore\b|\babs\b|stomach/, 'Core', 'Core'],
  [/stretch|mobility|loosen|yoga/, 'Stretch', 'Stretch'],
];
const SAFETY = /\bpain|\bhurt|dizz|injur|faint|unwell|nause|can'?t breathe|\bsick\b/;
const VAGUE = /^(hi|hey|hello|start|begin|go|workout|exercise|start a session|start a workout|start workout|let'?s go|let'?s start|let'?s work ?out|somewhere else)\b/;

function minutesIn(text: string): { minutes: number; until: boolean } | undefined {
  const m = text.match(MINUTES);
  if (m) return { minutes: /^\d+$/.test(m[2]) ? Number(m[2]) : WORD_MINUTES[m[2]], until: Boolean(m[1]) };
  const hours = text.match(/(\bin\s+)?\b(\d)\s*(?:hours?|hrs?|h)\b/);
  if (hours) return { minutes: Number(hours[2]) * 60, until: Boolean(hours[1]) };
  if (/half an hour/.test(text)) return { minutes: 30, until: /in half an hour/.test(text) };
  if (/\ban hour\b|\bone hour\b/.test(text)) return { minutes: 60, until: /in (an|one) hour/.test(text) };
  return undefined;
}

export function readSituation(text: string): Situation | undefined {
  const time = minutesIn(text);
  const place = PLACES.find(([re]) => re.test(text));
  const focus = FOCUS.find(([re]) => re.test(text));
  if (!time && !place && !focus) return undefined;
  const vibe: Vibe = /tired|gentle|easy|slow|low energy|exhausted|sleepy|calm/.test(text) ? 'gentle'
    : /ready to go|energ|pumped|push|intense|let'?s go/.test(text) ? 'brisk'
    : /quiet|silent|neighbou?r|late|night|baby|asleep/.test(text) ? 'quiet'
    : place?.[2] ?? 'steady';
  // "A meeting in 10 minutes" means a window, not a session length: finish with time to spare.
  const buffer = time?.until && /meeting|call|class|interview|leave|leaving|train|bus/.test(text) && time.minutes > 3 ? 2 : 0;
  const asked = (time?.minutes ?? 10) - buffer;
  return { minutes: Math.min(60, Math.max(1, asked)), place: place?.[1], focus: focus?.[1], vibe, buffer, capped: asked > 60 };
}

// ---- Planning: the timers always add up to exactly the minutes on screen ----

export function planSession(sit: Situation): Step[] {
  const seconds = sit.minutes * 60, rest = REST[sit.vibe];
  const word = FOCUS.find(([, name]) => name === sit.focus)?.[2];
  const name = (i: number, n: number) => n === 1 ? `${word ?? 'Main'} block` : `${word ? word + ' block' : 'Block'} ${ONES[i + 1]}`;
  if (sit.minutes <= 3) return [{ id: 'b1', kind: 'block', label: name(0, 1), seconds }];
  if (sit.minutes <= 6) return [{ id: 'warm', kind: 'warm', label: 'Warm-up', seconds: 60 }, { id: 'b1', kind: 'block', label: name(0, 1), seconds: seconds - 60 }];
  const blocks = sit.minutes >= 15 ? 3 : 2, warm = sit.minutes >= 10 ? 120 : 60;
  const work = seconds - warm - rest * (blocks - 1), each = Math.floor(work / blocks / 30) * 30;
  const steps: Step[] = [{ id: 'warm', kind: 'warm', label: 'Warm-up', seconds: warm }];
  for (let i = 0; i < blocks; i++) {
    steps.push({ id: `b${i + 1}`, kind: 'block', label: name(i, blocks), seconds: i === blocks - 1 ? work - each * (blocks - 1) : each });
    if (i < blocks - 1) steps.push({ id: `r${i + 1}`, kind: 'rest', label: `Rest ${ONES[i + 1]}`, seconds: rest });
  }
  return steps;
}

function readingFor(sit: Situation, steps: Step[]) {
  const blocks = steps.filter(step => step.kind === 'block').length;
  const vibe = { quiet: 'Quiet', gentle: 'Gentle', brisk: 'Brisk', steady: '' }[sit.vibe];
  return [sit.place, sit.focus && `${sit.focus} focus`, vibe, `${cap(plural(blocks, 'block'))}`].filter(Boolean).join('. ') + '.';
}

// ---- Rendering a plan as OpenUI ----

function arrivalScreen(steps: Step[], reading: string, alert?: string): string[] {
  const blocks = steps.filter(step => step.kind === 'block').length, quiet = /Quiet/.test(reading);
  const chips = [
    ...(total(steps) > 60 ? ['Shorter, please'] : []),
    ...(steps.some(step => step.kind === 'rest') ? ['Give me longer rests'] : []),
    'Somewhere else',
  ];
  return [
    st('ready_k', 'Keyword', [`${total(steps) / 60} min`, reading]),
    st('ready_d', 'Text', ['Simulated session. Nothing here is exercise advice.', 'description']),
    ...(alert ? [st('ready_alert', 'Alert', ['info', alert])] : []),
    st('ready_cue', 'Cue', [`${cap(words(blocks))} ${quiet ? 'quiet ' : ''}block${blocks === 1 ? '' : 's'}. Step forward when you're set.`]),
    st('ready_f', 'FollowUps', [chips]),
    refs('s_ready', 'Screen', ['ready_k', 'ready_d', ...(alert ? ['ready_alert'] : []), 'ready_cue', 'ready_f']),
  ];
}

function stepScreen(step: Step, steps: Step[], alert?: string): string[] {
  const id = step.id, a = alert ? [st(`${id}_alert`, 'Alert', ['info', alert])] : [], aRef = alert ? [`${id}_alert`] : [];
  if (step.kind === 'rest') {
    const next = steps[steps.indexOf(step) + 1];
    return [
      st(`${id}_k`, 'Keyword', ['Rest', `${dur(step.seconds)} · then ${next.label}`]),
      ...a,
      st(`${id}_t`, 'Timer', [step.label, step.seconds]),
      st(`${id}_cue`, 'Cue', [`Rest. ${next.label} is next.`]),
      st(`${id}_f`, 'FollowUps', [['Longer rest', 'Shorter, please']]),
      refs(`s_${id}`, 'Screen', [`${id}_k`, ...aRef, `${id}_t`, `${id}_cue`, `${id}_f`]),
    ];
  }
  const list = active(steps), position = list.indexOf(step) + 1, blocks = list.filter(s => s.kind === 'block');
  const cue = step.kind === 'warm' ? 'Warm-up. Start the clock when you like.'
    : step === blocks[0] ? `${step.label}. I'll go quiet.`
    : step === blocks.at(-1) ? `${step.label}. The last one.`
    : `${step.label}. Quiet again.`;
  return [
    st(`${id}_k`, 'Keyword', [step.label, `${position} of ${list.length} · ${dur(step.seconds)}`, ACCENT]),
    ...a,
    st(`${id}_t`, 'Timer', [step.label, step.seconds]),
    st(`${id}_cue`, 'Cue', [cue]),
    refs(`s_${id}`, 'Screen', [`${id}_k`, ...aRef, `${id}_t`, `${id}_cue`]),
  ];
}

function closeScreen(steps: Step[], alert?: string): string[] {
  return [
    st('land_t', 'Text', ['Done for today.', 'title']),
    st('land_k', 'Keyword', [`${total(steps) / 60} min`, 'planned · simulated']),
    ...(alert ? [st('land_alert', 'Alert', ['info', alert])] : []),
    st('land_cue', 'Cue', ["That's the session. Nothing left to do."]),
    st('land_f', 'FollowUps', [['How did it go?', 'Same again tomorrow']]),
    refs('s_land', 'Screen', ['land_t', 'land_k', ...(alert ? ['land_alert'] : []), 'land_cue', 'land_f']),
  ];
}

const screenKeys = (steps: Step[]) => ['s_ready', ...steps.map(step => `s_${step.id}`), 's_land'];

function sessionTurn(sit: Situation, prose?: string): Turn {
  const steps = planSession(sit), clocks = steps.length;
  const meeting = sit.place === 'Before a meeting';
  const context = [!meeting && sit.place?.toLowerCase(), sit.focus && `${sit.focus.toLowerCase()} focus`, { quiet: 'kept quiet', gentle: 'gentle pace', brisk: 'brisk', steady: '' }[sit.vibe]].filter(Boolean).join(', ');
  const lead = cap(plural(sit.minutes, 'minute'))
    + (meeting ? ' before your meeting' : '')
    + (context ? `, ${context}` : '')
    + (sit.buffer ? `, with ${plural(sit.buffer, 'minute')} to spare` : '')
    + (sit.capped ? ' (an hour is the most I plan)' : '');
  const reply = prose ?? `${lead}; I'll stay silent while the clock${clocks === 1 ? ' runs' : 's run'}.`;
  const doc = [
    `root = Screens([${screenKeys(steps).join(', ')}])`,
    ...arrivalScreen(steps, readingFor(sit, steps)),
    ...steps.flatMap(step => stepScreen(step, steps)),
    ...closeScreen(steps),
  ];
  return { reply: clear + '\n' + fence(doc.join('\n')) + '\n' + reply };
}

function pickerTurn(prose: string): Turn {
  const doc = [
    'root = Screens([s_hello])',
    st('hello_t', 'Text', ['Where are you right now?', 'title']),
    st('hello_d', 'Text', ["One tap. I'll shape the session around it.", 'description']),
    st('hello_cue', 'Cue', ["Tell me where you are. I'll do the rest."]),
    st('hello_f', 'FollowUps', [['Hotel room, 10 minutes, keep it quiet', 'Home, 20 minutes, a little tired', 'Gym, 30 minutes, ready to go', '4 minutes before a meeting']]),
    refs('s_hello', 'Screen', ['hello_t', 'hello_d', 'hello_cue', 'hello_f']),
  ];
  return { reply: clear + '\n' + fence(doc.join('\n')) + '\n' + prose };
}

function safetyTurn(): Turn {
  const doc = [
    'root = Screens([s_stop])',
    st('stop_a', 'Alert', ['warning', "Stop here. This prototype can't give health advice."]),
    st('stop_t', 'Text', ['Please check with someone qualified before another session.', 'description']),
    st('stop_cue', 'Cue', ["Stopping here. That matters more than the session."]),
    refs('s_stop', 'Screen', ['stop_a', 'stop_t', 'stop_cue']),
  ];
  return { reply: clear + '\n' + fence(doc.join('\n')) + "\nLet's stop here; this prototype can't give health advice, so please check with someone qualified." };
}

// ---- Reading back a session the mock built earlier ----

function readSession(doc: ScreenDocument): Session | undefined {
  const screens = doc.screens, keys = screens.map(s => s.key);
  if (keys[0] !== 's_ready' || keys.at(-1) !== 's_land') return undefined;
  const steps: Step[] = [];
  for (const screen of screens.slice(1, -1)) {
    const id = screen.key.slice(2), timer = (screen.props.children as StatementNode[]).find(n => n.name === 'Timer');
    if (!timer || !/^(warm|b\d|r\d)$/.test(id)) return undefined;
    steps.push({ id, kind: id === 'warm' ? 'warm' : id.startsWith('r') ? 'rest' : 'block', label: String(timer.props.label), seconds: Number(timer.props.seconds) });
  }
  const ready = (screens[0].props.children as StatementNode[]).find(n => n.key === 'ready_k');
  return { steps, keys, cursor: doc.cursor, index: keys.indexOf(doc.cursor), reading: String(ready?.props.caption ?? '') };
}

// Rewrites only what the person has not reached. The screen they are on is touched only
// when their hands are free there (arrival, rest, close); a running block is never re-rendered.
function patchTurn(session: Session, steps: Step[], alert: string, prose: string): Turn {
  const { index, keys } = session, last = keys.length - 1;
  if (index === last) return { reply: fence(`root = Screens([${keys.join(', ')}], ${session.cursor})`) + "\nYou're at the close, so there's nothing ahead to change." };
  const current = keys[index], handsFree = current === 's_ready' || current === 's_land' || /^s_r\d$/.test(current);
  const target = handsFree ? index : Math.min(index + 1, last);
  const out: string[] = [];
  if (index === 0) out.push(...arrivalScreen(steps, session.reading, target === 0 ? alert : undefined));
  steps.forEach((step, i) => {
    const screen = i + 1;
    if (screen > index || (screen === index && screen === target)) out.push(...stepScreen(step, steps, screen === target ? alert : undefined));
  });
  out.push(...closeScreen(steps, target === last ? alert : undefined));
  out.push(`root = Screens([${keys.join(', ')}], ${session.cursor})`);
  return { reply: fence(out.join('\n')) + '\n' + prose };
}

// Takes `amount` seconds from the blocks ahead, last block first, never below one minute.
function takeFromBlocks(steps: Step[], index: number, amount: number) {
  for (const step of [...steps].reverse()) {
    if (amount <= 0) break;
    if (step.kind === 'rest' || steps.indexOf(step) + 1 <= index) continue;
    const take = Math.min(amount, Math.max(0, step.seconds - 60));
    step.seconds -= take; amount -= take;
  }
}
const spare = (steps: Step[], index: number) => steps.filter((s, i) => s.kind !== 'rest' && i + 1 > index).reduce((sum, s) => sum + Math.max(0, s.seconds - 60), 0);

function shorter(session: Session): Turn {
  const steps = session.steps.map(s => ({ ...s })), before = total(steps);
  const ahead = steps.filter((s, i) => s.kind !== 'rest' && i + 1 > session.index).reduce((sum, s) => sum + s.seconds, 0);
  const cut = Math.min(Math.max(60, Math.round(ahead / 3 / 60) * 60), Math.floor(spare(steps, session.index) / 60) * 60);
  if (cut <= 0) return patchTurn(session, steps, 'Nothing ahead left to trim. Stop whenever you like.', "There's nothing ahead left to trim, so stop whenever you like; nothing is lost.");
  takeFromBlocks(steps, session.index, cut);
  const minutes = total(steps) / 60;
  return patchTurn(session, steps, `Now ${minutes} min. Blocks ahead trimmed, rests kept.`,
    `${cap(plural(minutes, 'minute'))} now, down from ${words(before / 60)}; I trimmed the blocks ahead and kept the rests.`);
}

function longerRests(session: Session): Turn {
  const steps = session.steps.map(s => ({ ...s }));
  const rests = steps.filter((s, i) => s.kind === 'rest' && i + 1 > session.index && s.seconds < 120);
  const room = Math.min(rests.length, Math.floor(spare(steps, session.index) / 30));
  const onRest = /^s_r\d$/.test(session.keys[session.index]);
  if (!room) {
    const why = onRest ? "Pause this clock as long as you need. Nothing moves until you tap Next." : 'No rests ahead can grow without cutting a block below a minute.';
    return patchTurn(session, steps, why, onRest ? 'Take this rest as long as you like; nothing moves until you tap Next.' : "There's no rest ahead I can lengthen without cutting a block below a minute, so nothing changed.");
  }
  for (const rest of rests.slice(0, room)) rest.seconds += 30;
  takeFromBlocks(steps, session.index, room * 30);
  const minutes = total(steps) / 60;
  return patchTurn(session, steps, `Rests ahead +30 s. Still ${minutes} min in total.`,
    `The rest${room === 1 ? '' : 's'} ahead ${room === 1 ? 'is' : 'are'} thirty seconds longer and the blocks gave up the time, so you still finish in ${plural(minutes, 'minute')}.`);
}

// ---- The receipt: counted from the browser's timer snapshot, never assumed ----

const SNAPSHOT = /^Simulated timer (\w+) \((.*)\): (stopped|running|paused|done), (\d+) of (\d+) seconds remaining\.$/;

function receipt(session: Session, events: string[]): Turn {
  const clocks = new Map<string, { status: string; remaining: number }>();
  for (const event of events) { const m = event.match(SNAPSHOT); if (m) clocks.set(m[1], { status: m[3], remaining: Number(m[4]) }); }
  if (!clocks.size) return { reply: fence(`root = Screens([${session.keys.join(', ')}], ${session.cursor})`) + "\nI can't see the clocks from here, so I won't guess how it went." };
  const resets = new Map<string, number>();
  for (const event of events) { const m = event.match(/^Reset the timer for (.+) to /); if (m) resets.set(m[1], (resets.get(m[1]) ?? 0) + 1); }
  const work = active(session.steps), rests = session.steps.filter(s => s.kind === 'rest');
  const state = (s: Step) => clocks.get(`${s.id}_t`) ?? { status: 'stopped', remaining: s.seconds };
  const done = work.filter(s => state(s).status === 'done');
  const partway = work.filter(s => ['running', 'paused'].includes(state(s).status));
  const untouched = work.filter(s => state(s).status === 'stopped');
  const names = (list: Step[]) => list.map(s => s.label).join(', ');
  const items = [
    ...(done.length ? [`Ran to zero: ${names(done)}.`] : []),
    ...partway.map(s => `${s.label} stopped with ${dur(state(s).remaining)} left.`),
    ...(untouched.length ? [`Not started: ${names(untouched)}.`] : []),
    ...(rests.length ? [`Rest clocks: ${rests.filter(s => state(s).status === 'done').length} of ${rests.length} ran out.`] : []),
    ...[...resets].map(([label, n]) => `${label} was reset ${n === 1 ? 'once' : plural(n, 'time')}.`),
  ];
  const minutes = total(session.steps) / 60;
  const next = done.length * 2 >= work.length
    ? (minutes <= 58 ? 'Two minutes longer next time' : 'Same again tomorrow')
    : (minutes >= 3 ? 'Two minutes shorter next time' : 'Same again tomorrow');
  const n = work.length;
  const headline = done.length === n ? (n === 1 ? 'The clock ran to zero.' : n === 2 ? 'Both block clocks ran to zero.' : `All ${words(n)} block clocks ran to zero.`)
    : done.length === 0 ? (n === 1 ? "The clock didn't run this time, and that's fine." : `None of the ${words(n)} block clocks ran this time, and that's fine.`)
    : `${cap(words(done.length))} of ${words(n)} block clocks ran to zero.`;
  const doc = [
    st('land_t', 'Text', ["Here's what ran.", 'title']),
    ...items.map((text, i) => st(`land_i${i + 1}`, 'ListItem', [text, 'bullet'])),
    refs('land_l', 'List', items.map((_, i) => `land_i${i + 1}`)),
    st('land_k', 'Keyword', [`${done.length} of ${work.length}`, 'block clocks ran to zero · simulated']),
    st('land_f2', 'FollowUps', [[...new Set(['Same again tomorrow', next])]]),
    refs('s_land', 'Screen', ['land_t', 'land_k', 'land_l', 'land_cue', 'land_f2']),
  ];
  return { reply: fence(doc.join('\n')) + '\n' + headline };
}

// Earlier situation, for "same again" style requests. Chip phrases are skipped so
// "Two minutes longer next time" is never read as a two-minute session.
const COMMAND = /^(how did it go|same again|two minutes (longer|shorter) next time|shorter|longer rest|give me longer rests|somewhere else)/;
function previousSituation(messages: Message[]): Situation | undefined {
  for (const message of [...messages].reverse()) {
    if (message.role !== 'user') continue;
    const text = message.content.trim().toLowerCase();
    if (COMMAND.test(text)) continue;
    const sit = readSituation(text);
    if (sit) return sit;
  }
  return undefined;
}

export function mockTurn(request: RequestData, fixture: string): Turn {
  const last = request.messages.at(-1)?.content.trim().toLowerCase() ?? '';

  if (last === 'load wiring sample' || last === '/demo') {
    return { reply: 'Wiring fixture loaded. This is deterministic, not a model interpreting your skill.\n' + clear + '\n' + fence(fixture) };
  }
  if (SAFETY.test(last)) return safetyTurn();

  const doc = new ScreenDocument();
  if (request.state.ui_state) doc.apply(fence(request.state.ui_state));
  const screens = doc.screens;
  const index = screens.findIndex(s => s.key === doc.cursor);

  if (['next', 'back'].includes(last) && screens.length) {
    const target = screens[Math.max(0, Math.min(screens.length - 1, index + (last === 'back' ? -1 : 1)))];
    return { reply: 'Fixture cursor moved.\n' + fence(`root = Screens([${screens.map(s => s.key).join(', ')}], ${target.key})`) };
  }
  if (/^change value to (\d{1,2})$/.test(last) && doc.program.includes('count1 =')) {
    const value = Number(last.match(/\d+/)![0]);
    return { reply: 'Fixture values patched under their existing names.\n' + fence(serializeStatement('count1', 'Keyword', [String(value), 'Sample value']) + '\n' + serializeStatement('count2', 'Keyword', [String(value), 'Second sample value'])) };
  }

  const session = readSession(doc);
  if (/how did it go/.test(last)) return session ? receipt(session, request.state.client_events) : pickerTurn("Nothing has run yet, so let's start with where you are.");
  if (/same again|next time/.test(last)) {
    const minutes = session ? total(session.steps) / 60 : 10;
    const change = /longer next time/.test(last) ? 2 : /shorter next time/.test(last) ? -2 : 0;
    const sit = { ...(previousSituation(request.messages) ?? { vibe: 'steady' as Vibe }), minutes: Math.min(60, Math.max(1, minutes + change)), buffer: 0, capped: false };
    return sessionTurn(sit, change
      ? `${cap(plural(sit.minutes, 'minute'))} this time, otherwise the same; nothing is scheduled, it's here whenever you are.`
      : "Same again, rebuilt; nothing is scheduled in this prototype, it's here whenever you are.");
  }
  if (session && /shorter|less time|cut it/.test(last)) return shorter(session);
  if (session && /longer rest|more rest|gentler|breather/.test(last)) return longerRests(session);

  const sit = readSituation(last);
  if (sit) return sessionTurn(sit);
  return pickerTurn(VAGUE.test(last) || /workout|session/.test(last)
    ? "Let's start with where you are."
    : "I didn't catch a place or a time; pick one, or type something like “office, 5 minutes”.");
}
