import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// The stylesheet's theme contract: colours live only in :root tokens, each with a light and a dark
// value, and every text pair that carries content is readable (WCAG AA, 4.5:1) in both themes.
const css=await readFile(new URL('../src/web/styles.css',import.meta.url),'utf8');
const start=css.indexOf(':root {'),end=css.indexOf('\n}\n',start)+3;
const root=css.slice(start,end),rest=css.slice(0,start)+css.slice(end);
const tokens=Object.fromEntries([...root.matchAll(/--([\w-]+):\s*light-dark\((#[0-9a-fA-F]{6,8}),\s*(#[0-9a-fA-F]{6,8})\)/g)].map(m=>[m[1],{light:m[2],dark:m[3]}]));

const luminance=hex=>{const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(c=>c<=0.03928?c/12.92:((c+0.055)/1.055)**2.4);return 0.2126*r+0.7152*g+0.0722*b;};
const contrast=(a,b)=>{const [x,y]=[luminance(a),luminance(b)].sort((p,q)=>q-p);return (x+0.05)/(y+0.05);};

test('colours are named only in theme tokens',()=>{
  assert.deepEqual(rest.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g)??[],[],'use a var(--token) instead of a raw colour');
  assert(Object.keys(tokens).length>=30,'tokens define light and dark values with light-dark()');
  assert.match(root,/color-scheme:\s*light dark/);
  assert.match(css,/:root\[data-theme="dark"\]\s*\{\s*color-scheme:\s*dark/);assert.match(css,/:root\[data-theme="light"\]\s*\{\s*color-scheme:\s*light/);
});

test('text that carries content is readable in light and dark (WCAG AA)',()=>{
  const pairs=[
    ['text-main','bg'],['text-main','surface'],['text-main','surface-sunken'],['text-main','surface-chat'],
    ['text-muted','bg'],['text-muted','surface'],['text-muted','surface-sunken'],['text-muted','surface-chat'],
    ['on-ink','ink'],['accent-text','accent-light'],['accent-text','surface-sunken'],
    ['success-text','success-bg'],['success-text','surface-sunken'],
  ];
  for(const theme of ['light','dark'])for(const [fg,bg] of pairs){
    const ratio=contrast(tokens[fg][theme],tokens[bg][theme]);
    assert(ratio>=4.5,`${theme}: --${fg} on --${bg} is ${ratio.toFixed(2)}:1`);
  }
});
