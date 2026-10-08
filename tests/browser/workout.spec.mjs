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
 // The stepper must not move between steps of different heights.
 const nextTop=()=>page.evaluate(()=>document.querySelector('#next').getBoundingClientRect().top+scrollY);const before=await nextTop();
 await page.locator('#next').click();await expect(page.locator('[data-statement="warm_k"]')).toContainText('1 of 3 · 2 min');expect(Math.abs(await nextTop()-before)).toBeLessThanOrEqual(1);
 await expect(page.locator('.timer-ring')).toBeVisible();await expect(page.locator('.timer-done-note')).toBeHidden();
 await tap(page,'Simulate finish');await expect(page.locator('.timer-status')).toHaveText('done');await expect(page.locator('.timer-done-note')).toHaveText("Time. Next when you're ready.");
 await page.locator('#next').click();await expect(page.locator('#position')).toHaveText('3 / 6');await page.screenshot({path:shots+'/05-workout-block.png',fullPage:true});
 await page.locator('#next').click();await expect(page.locator('#position')).toHaveText('4 / 6');
 await tap(page,'Shorter, please');await expect(page.locator('#position')).toHaveText('4 / 6');await expect(page.locator('[data-statement="r1_alert"]')).toContainText('Now 9 min');
 await page.locator('#next').click();await expect(page.locator('[data-statement="b2_k"]')).toContainText('3 of 3 · 2 min 30 s');
 await page.locator('#next').click();await expect(page.locator('[data-statement="land_k"]')).toContainText('9 min');
 // The close shows what really ran before any model turn: warm-up only.
 await expect(page.locator('[data-statement="land_map"] .segment.ran')).toHaveCount(1);await expect(page.locator('[data-statement="land_map"] .legend')).toHaveText(['ran','not started']);
 await tap(page,'How did it go?');
 await expect(page.locator('[data-statement="land_k"]')).toContainText('1 of 3');await expect(page.locator('#screen')).toContainText('Not started: Block one, Block two.');
 await expect(page.locator('.message.assistant').last()).toContainText('One of three block clocks ran to zero.');await page.screenshot({path:shots+'/06-workout-receipt.png',fullPage:true});
 expect(errors).toEqual([]);
});

test('offline workout fits a phone and stops on pain',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.locator('#message').fill('leg workout, 2 min');await page.locator('#send').click();await expect(page.locator('#pending')).toBeHidden();
 await expect(page.locator('#position')).toHaveText('1 / 3');await page.locator('#next').click();await expect(page.locator('[data-statement="b1_k"]')).toContainText('Lower block');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:shots+'/07-workout-mobile.png',fullPage:true});
 await page.locator('#message').fill('my knee hurts');await page.locator('#send').click();await expect(page.locator('#pending')).toBeHidden();
 await expect(page.locator('#screen')).toContainText("Stop here. This prototype can't give health advice.");await expect(page.locator('#navigation')).toBeHidden();
});
