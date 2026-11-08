/* Server-only deterministic encoding planner. Never import this from browser code. */
const MORSE={A:'.-',B:'-...',C:'-.-.',D:'-..',E:'.',F:'..-.',G:'--.',H:'....',I:'..',J:'.---',K:'-.-',L:'.-..',M:'--',N:'-.',O:'---',P:'.--.',Q:'--.-',R:'.-.',S:'...',T:'-',U:'..-',V:'...-',W:'.--',X:'-..-',Y:'-.--',Z:'--..'};
const hash32=s=>{let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
export const METHODS={
  counts:{short:'counts',label:'Constellation counts',maxLetters:12,rule:'Each letter is one naturally separated constellation. Count its individual stars; A=1 through Z=26.',scenes:['a remote mountain observatory beneath a natural field of small constellations','a quiet alpine lake reflecting a deep indigo sky with scattered constellations','a nocturnal desert plateau with distant ruins and faint star clusters']},
  binary:{short:'binary',label:'Binary star states',maxLetters:20,rule:'Each letter is represented by five positions in a fixed left-to-right order. Bright means 1, dim means 0; interpret the five-bit value as A=1 through Z=26.',scenes:['an old astronomical instrument beneath a star-filled night sky','a moonlit observatory terrace with tiny lights in a distant mechanical structure','a quiet night garden with a subtle line of antique glass signal lamps']},
  morse:{short:'morse',label:'Morse light patterns',maxLetters:30,rule:'Each letter is international Morse code, read left to right. A small round light is a dot; a longer narrow light is a dash.',scenes:['a moonlit harbor with tiny distant signal lights','a remote lighthouse above a dark coastline with faint lights along the horizon','an atmospheric night railway scene with distant signal lamps']}
};
export const wordsOf=msg=>String(msg).toUpperCase().replace(/[^A-Z ]/g,' ').trim().split(/\s+/).filter(Boolean);
export const letterCount=msg=>wordsOf(msg).join('').length;
export const eligibleMethods=msg=>{const n=letterCount(msg);return Object.keys(METHODS).filter(k=>n<=METHODS[k].maxLetters)};
const symbolFor=(method,ch)=>{const n=ch.charCodeAt(0)-64;return method==='counts'?n:method==='binary'?n.toString(2).padStart(5,'0'):MORSE[ch]};
export function pickPlan(msg,{lastMethod='',lastScene='',round=0}={}){
 const words=wordsOf(msg);if(!words.length)throw Error('The message needs at least one letter A-Z.');
 let pool=eligibleMethods(msg);if(!pool.length)throw Error('Message is too long for the available visual encodings.');
 const fresh=pool.filter(k=>k!==lastMethod);if(fresh.length)pool=fresh;
 const key=words.join(' ')+'|'+round,method=pool[hash32(key+'|method')%pool.length],m=METHODS[method];
 let scenes=m.scenes;const freshScenes=scenes.filter(s=>s!==lastScene);if(freshScenes.length)scenes=freshScenes;
 const scene=scenes[hash32(key+'|scene')%scenes.length],groups=words.map(w=>[...w].map(ch=>symbolFor(method,ch)));
 return {method,label:m.label,rule:m.rule,scene,groups};
}
export function decodePlan(plan){
 const inv=Object.fromEntries(Object.entries(MORSE).map(([k,v])=>[v,k]));
 return plan.groups.map(w=>w.map(s=>plan.method==='counts'?String.fromCharCode(64+Number(s)):plan.method==='binary'?String.fromCharCode(64+parseInt(s,2)):inv[s]).join('')).join(' ');
}
