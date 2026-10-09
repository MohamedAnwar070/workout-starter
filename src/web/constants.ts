// Browser-side constants for the parts we built: interface text used in more than one place (and
// by the browser tests), the theme storage key, and the timer ring geometry. Starter-owned copy
// stays where the starter put it.

export const UI_TEXT = {
  pending: 'Aira is thinking',
  pendingDetail: 'this screen stays put',
  paused: 'Preview paused',
  pausedDetail: 'your place is kept',
  showChat: 'Show chat',
  focus: 'Focus',
  next: 'Next →',
  finish: 'Finish preview',
  sessionEnded: 'Session ended',
  timeUp: "Time. Next when you're ready.",
  startSession: 'Start a session',
  focusOn: 'Focus mode on',
  focusOnDetail: 'Show chat or Esc for the conversation',
  focusOff: 'Session complete',
  focusOffDetail: 'the chat is back',
  themeSwitch: 'Dark theme',
  themeToDark: 'Switch to dark theme',
  themeToLight: 'Switch to light theme',
} as const;

// How long a status note (such as "Focus mode on") stays before it fades.
export const NOTE_MS = 4000;

// Remembered per browser only; the page works the same when storage is unavailable.
export const STORAGE_KEYS = { theme: 'aira-workout-theme' } as const;

// Timer ring in SVG units (the stroke width is styled in CSS).
export const RING = { viewBox: 120, radius: 54 } as const;
export const SVG_NS = 'http://www.w3.org/2000/svg';
