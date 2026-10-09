// Product rules for the offline workout director (src/server/mock.ts), kept in one place.
// skills/workout.md states the same rules for the live model: its plan table is generated from
// planSession(), and a unit test fails if the skill's examples drift from what these rules produce.

export type Vibe = 'quiet' | 'gentle' | 'brisk' | 'steady';

export const PLAN = {
  defaultMinutes: 10,
  minMinutes: 1,
  maxMinutes: 60,
  singleBlockMaxMinutes: 3, // up to this: one block, no warm-up
  oneBlockMaxMinutes: 6, // up to this: warm-up and one block
  threeBlocksFromMinutes: 15, // from this: three blocks with two rests (otherwise two and one)
  longWarmupFromMinutes: 10, // from this the warm-up is the long one
  shortWarmupSeconds: 60,
  longWarmupSeconds: 120,
  roundingSeconds: 30, // block lengths are multiples of this; the last block takes the remainder
} as const;

// Rest length by mood: tired gets longer rests, "ready to go" shorter ones.
export const REST_SECONDS: Record<Vibe, number> = { quiet: 60, steady: 60, gentle: 90, brisk: 30 };

// Changes during a session only touch what is ahead.
export const CHANGES = {
  minBlockSeconds: 60, // no change leaves a block shorter than this
  shorterFraction: 1 / 3, // "Shorter" trims about this share of the block time ahead, in whole minutes
  restStepSeconds: 30, // "Longer rests" adds this to each rest ahead, taken from the blocks
  maxRestSeconds: 120,
  nextTimeStepMinutes: 2, // "Two minutes longer / shorter next time"
} as const;

// "A meeting in 10 minutes" is a window, not a length: finish a little early.
export const WINDOW = {
  bufferMinutes: 2,
  minMinutes: 3, // shorter windows are taken as they are
  context: /meeting|call|class|interview|leave|leaving|train|bus/,
} as const;

// Accent colour for block keywords (OpenUI data, so a literal colour rather than a CSS token).
export const BLOCK_ACCENT = '#C2410C';

// Button labels. The mock matches them when they come back as messages, and the skill uses the same words.
export const CHIPS = {
  shorter: 'Shorter, please',
  longerRests: 'Give me longer rests',
  longerRest: 'Longer rest',
  somewhereElse: 'Somewhere else',
  howDidItGo: 'How did it go?',
  sameAgain: 'Same again tomorrow',
  longerNextTime: 'Two minutes longer next time',
  shorterNextTime: 'Two minutes shorter next time',
} as const;

export const PICKER_CHIPS = ['Hotel room, 10 minutes, keep it quiet', 'Home, 20 minutes, a little tired', 'Gym, 30 minutes, ready to go', '4 minutes before a meeting'];

// ---- Vocabulary for reading a situation from the person's own words ----

export const MEETING_PLACE = 'Before a meeting';

export const WORD_MINUTES: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15, 'twenty-five': 25, twenty: 20, thirty: 30, 'forty-five': 45, forty: 40, sixty: 60 };

// [pattern, place label, mood the place implies]
export const PLACES: [RegExp, string, Vibe?][] = [
  [/hotel/, 'Hotel room', 'quiet'],
  [/office|desk|\bwork\b|cubicle/, 'At work', 'quiet'],
  [/\bgym\b/, 'Gym'],
  [/bedroom/, 'Bedroom', 'quiet'],
  [/living room|\bhome\b|\bhouse\b|apartment|\bflat\b/, 'Home'],
  [/\bpark\b|outside|outdoors|garden|balcony|terrace/, 'Outdoors'],
  [/meeting|\bcall\b|interview/, MEETING_PLACE, 'quiet'],
];

// [pattern, focus label, word used in block names]
export const FOCUS: [RegExp, string, string | undefined][] = [
  [/full[ -]?body|whole body/, 'Full body', undefined],
  [/\blegs?\b|lower|glute|thigh|calf|calves/, 'Lower', 'Lower'],
  [/chest|\barms?\b|upper|shoulder|bicep|tricep/, 'Upper', 'Upper'],
  [/\bcore\b|\babs\b|stomach/, 'Core', 'Core'],
  [/stretch|mobility|loosen|yoga/, 'Stretch', 'Stretch'],
];

export const MOODS = {
  gentle: /tired|gentle|easy|slow|low energy|exhausted|sleepy|calm/,
  brisk: /ready to go|energ|pumped|push|intense|let'?s go/,
  quiet: /quiet|silent|neighbou?r|late|night|baby|asleep/,
} as const;

// Any of these stops the session: this prototype cannot give health advice.
export const SAFETY = /\bpain|\bhurt|dizz|injur|faint|unwell|nause|can'?t breathe|\bsick\b/;

export const VAGUE = /^(hi|hey|hello|start|begin|go|workout|exercise|start a session|start a workout|start workout|let'?s go|let'?s start|let'?s work ?out|somewhere else)\b/;
