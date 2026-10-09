import { el, button } from './dom.js';
import type { StatementNode } from '../shared/openui/openui-model.js';
import type { TimerLedger } from '../shared/openui/timer-store.js';
import { RING, SVG_NS, UI_TEXT } from './constants.js';
export type PlanStep = { id: string; label: string; seconds: number; current: boolean };
export type Context = { send: (text:string)=>void; timers: TimerLedger; timerAction: (id:string, action:'start'|'pause'|'reset'|'finish')=>void; updates: (()=>void)[]; paused: boolean; plan: ()=>PlanStep[] };
const RING_LENGTH=2*Math.PI*RING.radius,RING_CENTRE=String(RING.viewBox/2);
function ring(){const svg=document.createElementNS(SVG_NS,'svg');svg.setAttribute('viewBox',`0 0 ${RING.viewBox} ${RING.viewBox}`);svg.setAttribute('aria-hidden','true');svg.classList.add('timer-ring');
  const circle=(name:string)=>{const n=document.createElementNS(SVG_NS,'circle');n.setAttribute('cx',RING_CENTRE);n.setAttribute('cy',RING_CENTRE);n.setAttribute('r',String(RING.radius));n.classList.add(name);svg.append(n);return n;};
  circle('track');const arc=circle('arc');arc.setAttribute('stroke-dasharray',String(RING_LENGTH));return {svg,arc};}
const clock=(seconds:number)=>{const m=Math.floor(seconds/60),s=seconds%60;return m&&s?`${m} min ${s} s`:m?`${m} min`:`${s} s`;};
// Trusted DOM ports of the source component signatures; no model-generated code.
export const renderers: Record<string,(node:StatementNode,context:Context)=>HTMLElement> = {
  Text: ({props:p}) => el(p.variant==='title'?'h3':p.variant==='subtitle'?'h4':'p',String(p.text),'block block-'+String(p.variant??'body')),
  Keyword: ({props:p}) => {const n=el('div','','keyword');n.append(el('strong',String(p.text)));if(p.caption)n.append(el('p',String(p.caption)));return n;},
  Alert: ({props:p}) => el('aside',String(p.text),'block alert'),
  List: ({props:p},c) => {const n=el('ul','','block');for(const row of p.items as StatementNode[])n.append(renderComponent(row,c));return n;},
  ListItem: ({props:p}) => el('li',String(p.text)),
  FollowUps: ({props:p},c) => {const n=el('div','','row');for(const text of p.prompts as string[])n.append(button(text,()=>c.send(text)));return n;},
  Timer: ({key,props:p},c) => {
    const n=el('section','','timer');n.setAttribute('aria-label',String(p.label));
    n.append(el('p','SIMULATED TIMER · LOCAL ONLY','eyebrow'),el('h3',String(p.label)));
    // A ring that empties as time runs: readable from across a room, without reading digits.
    const value=el('strong'),status=el('span','','micro timer-status'),row=el('div','','row'),dial=el('div','','timer-dial'),{svg,arc}=ring();dial.append(svg,value,status);
    const done=el('p',UI_TEXT.timeUp,'timer-done-note');
    const start=button('Start simulation',()=>c.timerAction(key,'start'),'primary'),pause=button('Pause timer',()=>c.timerAction(key,'pause')),reset=button('Reset timer',()=>c.timerAction(key,'reset')),finish=button('Simulate finish',()=>c.timerAction(key,'finish'));
    row.append(start,pause,reset,finish);n.append(dial,done,row,el('p','Finishing records a local timer event.','micro'));
    const update=()=>{const entry=c.timers.list().find(t=>t.id===key);if(!entry)return;const seconds=Math.ceil(entry.remaining);value.textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;status.textContent=entry.status;
      arc.style.strokeDashoffset=String(RING_LENGTH*(1-entry.remaining/entry.seconds));n.classList.toggle('timer-done',entry.status==='done');done.hidden=entry.status!=='done';start.hidden=entry.status==='running'||entry.status==='paused';start.textContent=entry.status==='done'?'Restart simulation':'Start simulation';pause.hidden=entry.status==='stopped'||entry.status==='done';pause.textContent=entry.status==='paused'?'Resume timer':'Pause timer';for(const b of [start,pause,reset,finish])b.disabled=c.paused;};
    c.updates.push(update);update();return n;
  },
  // The model only places the map; the bar is drawn from the document's real Timers and
  // their local states, so it cannot report a block as run when it was not.
  SessionMap: ({props:p},c) => {
    const n=el('figure','','session-map'),bar=el('div','','session-bar'),caption=el('figcaption','','micro');n.append(bar,caption);
    const update=()=>{
      const states=new Map(c.timers.list().map(t=>[t.id,t.status])),steps=c.plan();
      const state=(s:PlanStep)=>states.get(s.id)??'stopped',word=(s:PlanStep)=>state(s)==='done'?'ran':state(s)==='stopped'?'not started':'partly';
      bar.replaceChildren(...steps.map(s=>{const seg=el('span','','segment'+(/^rest\b/i.test(s.label)?' rest':'')+(state(s)==='done'?' ran':state(s)==='stopped'?'':' partial')+(s.current?' current':''));seg.style.flexGrow=String(s.seconds);seg.title=`${s.label} · ${clock(s.seconds)} · ${word(s)}`;return seg;}));
      // The headline already gives counts; once something has happened the caption explains the colours instead.
      const shown=new Set(steps.some(s=>state(s)!=='stopped')?steps.map(word):[]),key=(['ran','partly','not started'] as const).filter(w=>shown.has(w));
      // Time on the clock, from the real timers: how much of the planned session actually ran.
      const left=new Map(c.timers.list().map(t=>[t.id,t.remaining])),total=steps.reduce((t,s)=>t+s.seconds,0),ran=Math.round(steps.reduce((t,s)=>t+s.seconds-(left.get(s.id)??s.seconds),0));
      const time=shown.size?[el('span',`${clock(ran)} of ${clock(total)} ran`,'map-time')]:[];
      caption.replaceChildren(...(p.caption?[el('span',String(p.caption),'map-caption')]:[]),...time,...key.map(w=>{const item=el('span','','legend');item.append(el('i','',w.replace(' ','-')),document.createTextNode(w));return item;}));
      caption.hidden=!caption.childNodes.length;
      n.setAttribute('aria-label',steps.map(s=>`${s.label}, ${clock(s.seconds)}, ${word(s)}`).join('; '));
    };
    c.updates.push(update);update();return n;
  },
};
export function renderComponent(node:StatementNode,context:Context):HTMLElement {
  if(!Object.hasOwn(renderers,node.name))throw new Error('No renderer for '+node.name);
  const n=renderers[node.name](node,context);n.dataset.statement=node.key;
  if(typeof node.props.color==='string' && /^#[0-9a-fA-F]{6}$/.test(node.props.color))n.style.color=node.props.color;
  return n;
}
