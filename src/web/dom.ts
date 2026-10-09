export function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); node.textContent = text; node.className = className; return node;
}
export function button(text: string, action: () => void, className = '') {
  const node = el('button', text, className); node.type = 'button'; node.addEventListener('click', action); return node;
}
export function byId<T extends HTMLElement>(id: string) { return document.getElementById(id) as T; }
// Status pill: one shared indicator for app state ("Aira is thinking", "Preview paused"). It lives in the
// status tray, starts hidden, and its detail drops on narrow screens. A busy pill shows a pulsing dot.
export function statusPill(id: string, label: string, detail = '', tone: 'busy' | 'quiet' = 'quiet') {
  const node = el('span', '', `status-pill status-pill--${tone}`); node.id = id; node.hidden = true;
  node.append(document.createTextNode(label)); if (detail) node.append(el('span', ` · ${detail}`, 'status-detail'));
  return node;
}
