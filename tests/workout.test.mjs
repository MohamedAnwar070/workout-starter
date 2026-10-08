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
  assert.equal(r.say('How did it go?',[]),"I can't see the clocks from here, so I won't guess how it went.");
});

test('pain stops the session instead of planning more',()=>{
  const r=run();r.say('Gym, 30 minutes, ready to go');r.say('my knee hurts');
  assert.deepEqual(r.doc.screens.map(s=>s.key),['s_stop']);assert(!r.doc.echo().includes('Timer('));
});
