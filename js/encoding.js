/* Night Cipher · js/encoding.js
   Deterministic selector for AI-vs-AI duels: the code, not the model, decides which encoding the Hider uses,
   which scene it paints, and exactly which symbol goes in each group. The Hider only does the artwork.
   Pure functions, no DOM. */
const MORSE={A:'.-',B:'-...',C:'-.-.',D:'-..',E:'.',F:'..-.',G:'--.',H:'....',I:'..',J:'.---',K:'-.-',L:'.-..',M:'--',N:'-.',O:'---',P:'.--.',Q:'--.-',R:'.-.',S:'...',T:'-',U:'..-',V:'...-',W:'.--',X:'-..-',Y:'-.--',Z:'--..'};
const hash32=s=>{let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};

/* maxLetters keeps each picture readable: counts need up to 26 objects per letter, binary five marks, Morse at most four. */
export const METHODS={
  counts:{short:'counts',label:'Letter counts (A=1 … Z=26)',maxLetters:12,
    rule:'Each letter is one group of identical, individually countable luminous objects. The number of objects in a group is the letter’s position in the alphabet (A=1, B=2 … Z=26).',
    scenes:['petals on luminous night-blooming flowers, one flower per letter','stars gathered into small constellations, one constellation per letter','glowing lanterns hanging in clusters, one cluster per letter']},
  binary:{short:'binary',label:'Five-bit binary',maxLetters:20,
    rule:'Each letter is one group of exactly five positions in a fixed left-to-right order. A lit, bright or raised position means 1 and an unlit, dim or lowered position means 0. The five positions are the letter’s alphabet position in binary (A=00001 … Z=11010).',
    scenes:['lit and unlit apertures in an ancient observatory dome','glowing and dark gems set into an astronomical mechanism','raised and lowered pillars in a moonlit ruined colonnade']},
  morse:{short:'morse',label:'Morse code',maxLetters:30,
    rule:'Each letter is one group of dots and dashes in international Morse code, laid out in a single evenly spaced row. A dot is a small round mark and a dash is a clearly longer bar.',
    scenes:['glowing beads and bars strung along moonlit wires','fireflies and slender light trails in a night garden','embers and thin streaks of light above a dark skyline']}
};

export const wordsOf=msg=>String(msg).toUpperCase().replace(/[^A-Z ]/g,' ').trim().split(/\s+/).filter(Boolean);
export const letterCount=msg=>wordsOf(msg).join('').length;
export const eligibleMethods=msg=>{const n=letterCount(msg);return Object.keys(METHODS).filter(k=>n<=METHODS[k].maxLetters)};

const symbolFor=(method,ch)=>{const n=ch.charCodeAt(0)-64;return method==='counts'?n:method==='binary'?n.toString(2).padStart(5,'0'):MORSE[ch]};
const formatSpec=(method,groups)=>groups.map((g,i)=>`Word ${i+1} (${g.length} group${g.length>1?'s':''}): ${g.join('  ·  ')}${method==='counts'?'  (objects per group)':method==='morse'?'  (. = dot, - = dash)':'  (1 = lit, 0 = unlit)'}`).join('\n');

/* pickPlan(message, {lastMethod, lastScene, round}) -> {method,label,rule,scene,groups,spec}
   Same inputs always give the same plan. The previous method and scene are skipped when an alternative exists. */
export function pickPlan(msg,{lastMethod='',lastScene='',round=0}={}){
  const words=wordsOf(msg);if(!words.length)throw new Error('The message needs at least one letter A–Z.');
  let pool=eligibleMethods(msg);if(!pool.length)pool=['morse'];
  const fresh=pool.filter(k=>k!==lastMethod);if(fresh.length)pool=fresh;
  const key=`${words.join(' ')}|${round}`,method=pool[hash32(key+'|method')%pool.length],m=METHODS[method];
  let scenes=m.scenes;const freshScenes=scenes.filter(s=>s!==lastScene);if(freshScenes.length)scenes=freshScenes;
  const scene=scenes[hash32(key+'|scene')%scenes.length],groups=words.map(w=>[...w].map(ch=>symbolFor(method,ch)));
  return {method,label:m.label,rule:m.rule,scene,groups,spec:formatSpec(method,groups)};
}

/* Inverse of the plan: lets tests (and later, validators) confirm the groups really spell the message. */
export function decodePlan(plan){
  const inv=Object.fromEntries(Object.entries(MORSE).map(([k,v])=>[v,k]));
  return plan.groups.map(w=>w.map(s=>plan.method==='counts'?String.fromCharCode(64+s):plan.method==='binary'?String.fromCharCode(64+parseInt(s,2)):inv[s]).join('')).join(' ');
}
