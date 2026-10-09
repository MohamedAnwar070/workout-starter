import { test,expect } from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const shots='evidence/screenshots';
const tap=async(page,name)=>{await page.getByRole('button',{name,exact:true}).click();await expect(page.locator('#pending')).toBeHidden();};
// Reduced motion keeps screenshots from catching the screen mid-fade.
test.beforeEach(async({page})=>{await mkdir(shots,{recursive:true});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await expect(page.locator('#mode')).toHaveText('MOCK · NO MODEL CALLS');});

test('offline workout: situation, quiet blocks, live trim and an honest receipt',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1440,height:1000});
 await tap(page,'Start a session');await expect(page.locator('#screen')).toContainText('Where are you right now?');
 await tap(page,'Hotel room, 10 minutes, keep it quiet');
 await expect(page.locator('#position')).toHaveText('1 / 6');await expect(page.locator('[data-statement="ready_k"]')).toContainText('10 min');
 await expect(page.locator('[data-statement="ready_map"] .segment')).toHaveCount(4);await expect(page.locator('[data-statement="ready_map"] figcaption')).toBeHidden();
 await expect(page.locator('#spoken')).toHaveText("Two quiet blocks. Step forward when you're set.");await page.screenshot({path:shots+'/04-workout-arrival.png',fullPage:true});
 await page.locator('#next').click();await expect(page.locator('[data-statement="warm_k"]')).toContainText('1 of 3 · 2 min');
 // The session has started: focus mode leaves only the workout on screen.
 await expect(page.locator('body')).toHaveClass(/focus/);await expect(page.locator('.conversation')).toBeHidden();
 // An automatic switch explains itself.
 await expect(page.locator('#focus-on')).toHaveText('Focus mode on · Show chat or Esc for the conversation');
 // The stepper must not move between steps of different heights.
 const nextTop=()=>page.evaluate(()=>document.querySelector('#next').getBoundingClientRect().top+scrollY);const before=await nextTop();
 await expect(page.locator('.timer-ring')).toBeVisible();await expect(page.locator('.timer-done-note')).toBeHidden();
 await tap(page,'Simulate finish');await expect(page.locator('.timer-status')).toHaveText('done');await expect(page.locator('.timer-done-note')).toHaveText("Time. Next when you're ready.");
 await page.locator('#next').click();await expect(page.locator('#position')).toHaveText('3 / 6');expect(Math.abs(await nextTop()-before)).toBeLessThanOrEqual(1);await page.screenshot({path:shots+'/05-workout-block.png',fullPage:true});
 await page.locator('#next').click();await expect(page.locator('#position')).toHaveText('4 / 6');
 await tap(page,'Shorter, please');await expect(page.locator('#position')).toHaveText('4 / 6');await expect(page.locator('[data-statement="r1_alert"]')).toContainText('Now 9 min');
 await page.locator('#next').click();await expect(page.locator('[data-statement="b2_k"]')).toContainText('3 of 3 · 2 min 30 s');
 await page.locator('#next').click();await expect(page.locator('[data-statement="land_k"]')).toContainText('9 min');
 // Finished: focus steps aside and the chat is back for the receipt.
 await expect(page.locator('body')).not.toHaveClass(/focus/);await expect(page.locator('.conversation')).toBeVisible();
 await expect(page.locator('#focus-off')).toHaveText('Session complete · the chat is back');
 // The close shows what really ran before any model turn: warm-up only.
 await expect(page.locator('[data-statement="land_map"] .segment.ran')).toHaveCount(1);await expect(page.locator('[data-statement="land_map"] .legend')).toHaveText(['ran','not started']);
 await expect(page.locator('[data-statement="land_map"] .map-time')).toHaveText('2 min of 9 min ran');
 await tap(page,'How did it go?');
 await expect(page.locator('[data-statement="land_k"]')).toContainText('1 of 3');await expect(page.locator('#screen')).toContainText('Not started: Block one, Block two.');
 await expect(page.locator('.message.assistant').last()).toContainText('One of three ran to zero.');await page.screenshot({path:shots+'/06-workout-receipt.png',fullPage:true});
 expect(errors).toEqual([]);
});

test('focus mode steps aside for the chat: on request, on Esc and when a reply fails',async({page})=>{
 await page.setViewportSize({width:1280,height:720});
 // The app fits the window on a common laptop: chat box visible, and screens need no inner scrolling.
 const fits=()=>page.evaluate(()=>{const sc=document.querySelector('#screen');return {app:document.querySelector('.workspace').getBoundingClientRect().bottom<=innerHeight+1,composer:document.querySelector('#composer').getBoundingClientRect().bottom<=innerHeight+1,screen:sc.scrollHeight<=sc.clientHeight+1};});
 await tap(page,'Start a session');await tap(page,'Hotel room, 10 minutes, keep it quiet');await expect(page.locator('body')).not.toHaveClass(/focus/);
 expect(await fits()).toEqual({app:true,composer:true,screen:true});
 await page.locator('#next').click();await expect(page.locator('body')).toHaveClass(/focus/);expect((await fits()).screen).toBe(true);
 await page.getByRole('button',{name:'Show chat',exact:true}).click();await expect(page.locator('body')).not.toHaveClass(/focus/);await expect(page.locator('.conversation')).toBeVisible();
 await expect(page.locator('#focus-on')).toBeHidden();
 // With the chat shown, a clock screen still fits its area: no inner scrolling.
 expect((await fits()).screen).toBe(true);
 await page.getByRole('button',{name:'Focus',exact:true}).click();await expect(page.locator('body')).toHaveClass(/focus/);
 await page.keyboard.press('Escape');await expect(page.locator('body')).not.toHaveClass(/focus/);
 await page.getByRole('button',{name:'Focus',exact:true}).click();await page.locator('#next').click();await page.locator('#next').click();await expect(page.locator('#position')).toHaveText('4 / 6');
 // While Aira thinks, the shared status pill shows at the top right and covers no control.
 await page.locator('#fault').evaluate(e=>{e.value='slow';});await page.getByRole('button',{name:'Longer rest',exact:true}).click();await expect(page.locator('#pending')).toBeVisible();
 expect(await page.evaluate(()=>{const p=document.querySelector('#pending').getBoundingClientRect();return [...document.querySelectorAll('button')].filter(b=>b.offsetParent).filter(b=>{const r=b.getBoundingClientRect();return !(r.right<=p.left||r.left>=p.right||r.bottom<=p.top||r.top>=p.bottom);}).map(b=>b.textContent);})).toEqual([]);
 await expect(page.locator('#pending')).toBeHidden();
 // A failed reply must never be hidden behind focus mode.
 await page.locator('#fault').evaluate(e=>{e.value='request';});await page.getByRole('button',{name:'Shorter, please',exact:true}).click();
 await expect(page.locator('#error')).toBeVisible();await expect(page.locator('body')).not.toHaveClass(/focus/);
 await page.locator('#retry').click();await expect(page.locator('#error')).toBeHidden();await expect(page.locator('body')).toHaveClass(/focus/);
 await expect(page.locator('[data-statement="r1_alert"]')).toContainText('Now 9 min');
 // Reaching the close ends the session: a clock still running is paused, so the receipt and the map agree.
 await page.locator('#next').click();await page.getByRole('button',{name:'Start simulation',exact:true}).click();await page.locator('#next').click();
 await expect(page.locator('.event').filter({hasText:'Paused the timer for Block two'})).toHaveCount(1);await expect(page.locator('[data-statement="land_map"] .segment.partial')).toHaveCount(1);
 await page.locator('#next').click();await expect(page.locator('#next')).toHaveText('Session ended');await expect(page.locator('#next')).toBeDisabled();
});

test('offline workout fits a phone and stops on pain',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.locator('#message').fill('leg workout, 2 min');await page.locator('#send').click();await expect(page.locator('#pending')).toBeHidden();
 await expect(page.locator('#position')).toHaveText('1 / 3');await page.locator('#next').click();await expect(page.locator('[data-statement="b1_k"]')).toContainText('Lower block');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:shots+'/07-workout-mobile.png',fullPage:true});
 await expect(page.locator('body')).toHaveClass(/focus/);await page.getByRole('button',{name:'Show chat',exact:true}).click();
 await page.locator('#message').fill('my knee hurts');await page.locator('#send').click();await expect(page.locator('#pending')).toBeHidden();
 await expect(page.locator('#screen')).toContainText("Stop here. This prototype can't give health advice.");await expect(page.locator('#navigation')).toBeHidden();await expect(page.locator('body')).not.toHaveClass(/focus/);
});

test('dark theme: the toggle switches every surface, is remembered, and the workout stays readable',async({page})=>{
 await page.setViewportSize({width:1280,height:720});
 const bg=()=>page.evaluate(()=>getComputedStyle(document.body).backgroundColor);const light=await bg();
 await expect(page.getByRole('switch',{name:'Dark theme',exact:true})).toHaveAttribute('aria-checked','false');await page.getByRole('switch',{name:'Dark theme',exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');expect(await bg()).not.toBe(light);
 await expect(page.getByRole('switch',{name:'Dark theme',exact:true})).toHaveAttribute('aria-checked','true');
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await tap(page,'Start a session');await tap(page,'Hotel room, 10 minutes, keep it quiet');await page.screenshot({path:shots+'/10-dark-arrival.png'});
 await page.locator('#next').click();await expect(page.locator('body')).toHaveClass(/focus/);await page.screenshot({path:shots+'/11-dark-focus.png'});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:shots+'/12-dark-mobile.png'});
});

