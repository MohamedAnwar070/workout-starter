import test from 'node:test';
import assert from 'node:assert/strict';
import {ScreenDocument,splitReply} from '../dist/shared/openui/document.js';
import {mockTurn,planSession,readSituation} from '../dist/server/mock.js';

// Offline workout director: the numbers on screen must always be true.
function run(){
  const messages=[],doc=new ScreenDocument();
  const say=(text,client_events=[])=>{messages.push({role:'user',content:text});const turn=mockTurn({messages:structuredClone(messages),state:{ui_state:doc.echo(),client_events},provider:'mock',consent:false,fault:'none'},'');doc.apply(turn.reply);messages.push({role:'assistant',content:turn.reply});return splitReply(turn.reply).prose;};
  const timers=()=>doc.echo().split('\n').filter(l=>/_t = Timer/.test(l)).map(l=>({id:l.split(' ')[0],seconds:Number(l.match(/, (\d+)\)$/)[1])}));
  const line=name=>doc.echo().split('\n').find(l=>l.startsWith(name+' ='));
  return {doc,say,timers,line};
}
const snapshot=(id,status,remaining,seconds)=>`Simulated timer ${id} (x): ${status}, ${remaining} of ${seconds} seconds remaining.`;

test('every planned session adds up to exactly the minutes asked for',()=>{
  for(const vibe of ['quiet','steady','gentle','brisk'])for(let minutes=1;minutes<=60;minutes++){
    const steps=planSession({minutes,vibe,buffer:0,capped:false});
    assert.equal(steps.reduce((sum,s)=>sum+s.seconds,0),minutes*60,`${vibe} ${minutes}`);
    assert(steps.every(s=>s.seconds>=30&&s.seconds%30===0));assert.equal(new Set(steps.map(s=>s.label)).size,steps.length,'timer labels stay unique');
  }
});

test('situations are read from the person\'s own words',()=>{
  assert.deepEqual(readSituation('hotel room, 10 minutes, keep it quiet'),{minutes:10,place:'Hotel room',focus:undefined,vibe:'quiet',buffer:0,capped:false});
  assert.equal(readSituation('home, 20 minutes, a little tired').vibe,'gentle');
  assert.equal(readSituation('leg workout, 1 min').focus,'Lower');
  assert.equal(readSituation('i have a meeting in 10 minutes').minutes,8,'leaves time before the meeting');
  assert.equal(readSituation('gym for 2 hours').minutes,60);
  assert.equal(readSituation('asdf'),undefined);
});

test('suggested chips build sessions whose screens match what they promise',()=>{
  for(const [chip,minutes] of [['Hotel room, 10 minutes, keep it quiet',10],['Home, 20 minutes, a little tired',20],['Gym, 30 minutes, ready to go',30],['4 minutes before a meeting',4]]){
    const r=run();r.say('hi');r.say(chip);
    assert.equal(r.timers().reduce((s,t)=>s+t.seconds,0),minutes*60,chip);
    assert(r.line('ready_k').includes(`"${minutes} min"`));assert(r.line('land_k').includes(`"${minutes} min"`));
    const blocks=r.doc.echo().match(/Keyword\("[^"]+", "\d+ of (\d+) ·/g);assert.equal(blocks.length,Number(blocks[0].match(/of (\d+)/)[1]),'X of N matches the real block count');
  }
});

test('shorter patches only the future and keeps the person on their screen',()=>{
  const r=run();r.say('Hotel room, 10 minutes, keep it quiet');
  r.doc.move(2);const before=r.line('b1_t'),warm=r.line('warm_t');
  const prose=r.say('Shorter, please');
  assert.equal(r.doc.cursor,'s_b1');assert.equal(r.line('b1_t'),before,'current block untouched');assert.equal(r.line('warm_t'),warm,'past untouched');
  assert.match(prose,/minutes now/);assert(r.line('s_r1').includes('r1_alert'),'change announced on the next screen');
  const total=r.timers().reduce((s,t)=>s+t.seconds,0);assert(r.line('land_k').includes(`"${total/60} min"`),'close states the new total');
});

test('longer rests keep the total when the person has a fixed window',()=>{
  const r=run();r.say('Gym, 30 minutes, ready to go');
  const prose=r.say('Give me longer rests');
  assert.equal(r.timers().reduce((s,t)=>s+t.seconds,0),1800);assert(r.line('r1_t').includes(', 60)'));assert.match(prose,/still finish in thirty minutes/);
});

test('the receipt counts the real timer snapshot and never invents a result',()=>{
  const r=run();r.say('Hotel room, 10 minutes, keep it quiet');r.doc.move(5);
  assert.match(r.say('How did it go?',[snapshot('warm_t','stopped',120,120),snapshot('b1_t','stopped',210,210),snapshot('r1_t','stopped',60,60),snapshot('b2_t','stopped',210,210)]),/None of the three/);
  assert(r.line('land_k').includes('"0 of 3"'));
  assert.match(r.say('How did it go?',[snapshot('warm_t','done',0,120),snapshot('b1_t','paused',40,210),snapshot('r1_t','stopped',60,60),snapshot('b2_t','stopped',210,210),'Reset the timer for Block one to 3 minutes 30 seconds.']),/One of three/);
  assert(r.doc.echo().includes('Block one stopped with 40 s left.'));assert(r.doc.echo().includes('Block one was reset once.'));
  assert.equal(r.say('How did it go?',[]),"I can't see the clocks from here, so I won't guess how it went.");assert(r.line('land_k').includes('"1 of 3"'),'unknown clocks leave the receipt as it was');
});

test('pain stops the session instead of planning more',()=>{
  const r=run();r.say('Gym, 30 minutes, ready to go');r.say('my knee hurts');
  assert.deepEqual(r.doc.screens.map(s=>s.key),['s_stop']);assert(!r.doc.echo().includes('Timer('));
});

test('skill examples stay identical to what the offline director produces',async()=>{
  const {readFile}=await import('node:fs/promises');
  const skill=await readFile(new URL('../skills/workout.md',import.meta.url),'utf8');
  const examples=[...skill.matchAll(/```openui\n([\s\S]*?)\n```/g)].map(m=>m[1]);
  const norm=code=>code.split('\n').filter(l=>l.trim()&&l.trim()!=='root = Screens([])').map(l=>l.replace(/\s+/g,'')).sort();
  const turn=(text,ui_state='',client_events=[])=>splitReply(mockTurn({messages:[{role:'user',content:text}],state:{ui_state,client_events},provider:'mock',consent:false,fault:'none'},'').reply).fences.join('\n');
  assert.deepEqual(norm(examples[0]),norm(turn('hi')),'example 1: picker');
  assert.deepEqual(norm(examples[1]),norm(turn('Hotel room, 10 minutes, keep it quiet')),'example 2: full session');
  const r=run();r.say('Hotel room, 10 minutes, keep it quiet');r.doc.move(5);
  const events=[snapshot('warm_t','done',0,120),snapshot('b1_t','done',0,210),snapshot('r1_t','done',0,60),snapshot('b2_t','paused',35,150)];
  assert.deepEqual(norm(examples[3]),norm(turn('How did it go?',r.doc.echo(),events)),'example 4: receipt');
});

test('SessionMap is placed on arrival and close, and only takes an optional caption',async()=>{
  const {validateProgram}=await import('../dist/shared/openui/validate.js');
  const doc=c=>validateProgram('root = Screens([s])\ns = Screen([m])\nm = '+c);
  assert.equal(doc('SessionMap()').props.screens[0].props.children[0].name,'SessionMap');
  assert.equal(doc('SessionMap("What ran")').props.screens[0].props.children[0].props.caption,'What ran');
  for(const bad of ['SessionMap(5)','SessionMap("a", "b")'])assert.throws(()=>doc(bad));
  const r=run();r.say('Hotel room, 10 minutes, keep it quiet');
  assert(r.line('s_ready').includes('ready_map'));assert(r.line('s_land').includes('land_map'));
  r.doc.move(5);r.say('How did it go?',[snapshot('warm_t','done',0,120)]);assert(r.line('s_land').includes('land_map'),'receipt keeps the map');
});
