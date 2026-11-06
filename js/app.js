import { TRAIN, MORSE, BR } from './ciphers.js';
import { uri, toPng, clean, hasSecretLeak } from './security.js';
import { createChat, HIDE, SEEK } from './api.js';
import { loadState, saveState, createProgression } from './state.js';

const $=s=>document.querySelector(s), conn=$('polli-connect'), APP_KEY='pk_REPLACE_ME';
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const norm=s=>String(s).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]/gu,'');
const lev=(a,b)=>{const d=Array.from({length:a.length+1},(_,i)=>[i,...Array(b.length).fill(0)]);for(let j=1;j<=b.length;j++)d[0][j]=j;for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[a.length][b.length]};
const sim=(a,b)=>{a=norm(a);b=norm(b);return Math.max(a.length,b.length)?1-lev(a,b)/Math.max(a.length,b.length):0};
let T=loadState(),R=null,tokens=0;
const save=()=>saveState(T),progress=createProgression(()=>T);
const chat=createChat({getConnection:()=>conn,getTokenCount:()=>tokens,setTokenCount:v=>tokens=v,onUsage:renderScore});
const say=(m,c='')=>{const e=$('#status');e.textContent=m;e.className=c};
const renderScore=()=>{
 const rank=progress.rankFor(T.xp||0),earned=Object.keys(T.achievements||{}).length;
 $('#profile').innerHTML=`<div><strong>${rank.name}</strong><div><small>${T.xp||0} XP · ${tokens} tokens</small></div></div><b>🌙</b>`;
 $('#achievementCount').textContent=`${earned}/8`;
 $('#bestTime').textContent=Object.values(T.bestTimes||{}).length?progress.fmtTime(Math.min(...Object.values(T.bestTimes))):'—';
 $('#score small').textContent=`Daily streak ${T.streak||0} · Training ${Object.values(T.levels||{}).filter(Boolean).length}/${TRAIN.length} · Duel wins ${T.you||0}/${T.n||0}`;
 $('#achievements').innerHTML=progress.ACHIEVEMENTS.map(([id,ico,name,desc])=>`<div class="achievement ${T.achievements?.[id]?'':'locked'}"><span class="ico">${ico}</span><div><b>${name}</b><br><small>${desc}</small></div></div>`).join('');
 $('#codexPreview').innerHTML=TRAIN.map((t,i)=>`<div class="achievement ${T.levels?.[i]?'':'locked'}"><span class="ico">${T.levels?.[i]?'📖':'🔒'}</span><div><b>${T.levels?.[i]?esc(t.n):'Unknown Cipher #'+(i+1)}</b><br><small>${T.levels?.[i]?esc(t.s):'Complete this level to unlock it.'}</small></div></div>`).join('');
};
const start=r=>{R={tries:0,used:0,done:false,maxTries:3,...r,startedAt:performance.now()};$('#imgbox').innerHTML=`<img alt="Cipher puzzle" src="${uri(R.svg)}">`;$('#res').innerHTML='';$('#hints').innerHTML='';$('#robustnessReport').innerHTML='';$('#guess').value='';$('#game').hidden=false;$('#guess').hidden=false;$('#guess').previousElementSibling.hidden=false;$('#go').parentElement.hidden=false;$('#hints').hidden=false;$('#giveup').hidden=false;$('#hint').hidden=false;$('#next').hidden=true;$('#revealHow').hidden=false;$('#hint').disabled=false;$('#go').disabled=false;$('#giveup').disabled=false;say(`Find the hidden message. ${R.maxTries} tries.`)};
const finish=ok=>{
 if(!R||R.done)return;R.done=true;const elapsed=performance.now()-R.startedAt;let xp=0;
 if(ok&&(R.mode==='train'||R.mode==='daily')){
  T.solves=(T.solves||0)+1;if(R.tries===1)T.firstTry=(T.firstTry||0)+1;if(R.used===0)T.noHintSolves=(T.noHintSolves||0)+1;
  const key=R.mode==='daily'?'daily-'+R.day:'training-'+R.schemeIdx;T.bestTimes=T.bestTimes||{};if(!T.bestTimes[key]||elapsed<T.bestTimes[key])T.bestTimes[key]=elapsed;
  if(R.mode==='train'){T.levels=T.levels||{};if(!T.levels[R.schemeIdx])xp+=progress.grantXP(key,50,'Training completed');T.levels[R.schemeIdx]=true}
  else{T.dailyWins=T.dailyWins||[];if(!T.dailyWins.includes(R.day)){T.dailyWins.push(R.day);xp+=progress.grantXP(key,75,'Daily solved')}if(T.last!==R.day){T.streak=T.last===R.day-1?(T.streak||0)+1:1;T.last=R.day}}
  progress.evaluateAchievements(TRAIN);
 }
 if(R.mode==='duel'){T.n=(T.n||0)+1;if(ok)T.you=(T.you||0)+1}
 $('#res').innerHTML=`<b class="${ok?'ok':'bad'}">${ok?'Solved!':'Round finished.'}</b> Message: “${esc(R.secret)}”.<br><small>${esc(R.scheme||'Unknown scheme')}${ok&&(R.mode==='train'||R.mode==='daily')?' · '+progress.fmtTime(elapsed)+' · +'+xp+' XP':''}</small>`;
 $('#next').hidden=false;say(ok?'Cipher solved. Progress saved locally.':'The round has ended.');save();renderScore();
};
$('#go').onclick=()=>{if(!R||R.done)return;const guess=$('#guess').value.trim();if(!guess)return;R.tries++;const s=sim(guess,R.secret);if(s>=.9)finish(true);else if(R.tries>=R.maxTries)finish(false);else say(`Not quite (${Math.round(s*100)}%). ${R.maxTries-R.tries} tries left.`,'bad')};
$('#guess').onkeydown=e=>{if(e.key==='Enter')$('#go').click()};
$('#hint').onclick=()=>{if(!R||R.done||R.used>=R.hints.length)return;$('#hints').innerHTML+=`<li>${esc(R.hints[R.used++])}</li>`;if(R.used>=R.hints.length)$('#hint').disabled=true};
$('#giveup').onclick=()=>finish(false);
$('#save').onclick=async()=>{if(!R)return;const a=document.createElement('a');a.href=await toPng(R.svg);a.download='night-cipher.png';a.click()};
$('#revealHow').onclick=()=>{if(R)$('#res').innerHTML+=`<p><b>Encoding:</b> ${esc(R.scheme||'AI-generated visual pattern')}</p>`};
const DW=['HONEY','NECTAR','HIVE','BLOOM','POLLEN','CLOVER','AMBER','LANTERN','COMET','ORBIT','EMBER','FROST','HARBOR','MIRROR','SIGNAL','WHISPER','COPPER','ANCHOR','VELVET','MARBLE','RIVER','SHADOW','CRYSTAL','MEADOW'];
const hash=x=>{let h=2166136261;for(const c of String(x)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
const day=()=>Math.floor((Date.now()-new Date().getTimezoneOffset()*60000)/864e5);
function train(i){const t=TRAIN[i],w=DW[hash('training-'+i+'-'+day())%DW.length];$('#duel').hidden=$('#own').hidden=true;start({mode:'train',schemeIdx:i,secret:w,svg:t.g(w,hash('art-'+i+'-'+day())),scheme:t.s,hints:t.h})}
function daily(){const n=day(),i=hash('daily-scheme-'+n)%TRAIN.length,t=TRAIN[i],w=DW[hash('daily-word-'+n)%DW.length];$('#duel').hidden=$('#own').hidden=true;start({mode:'daily',schemeIdx:i,day:n,secret:w,svg:t.g(w,hash('daily-art-'+n)),scheme:t.s,hints:t.h});say('Daily Cipher · '+(i<3?'Easy':i<7?'Medium':'Hard')+'. Same daily puzzle for your local day.')}
const tabs=$('#tabs');
const definitions=[['📅 Daily',daily,'daily'],...TRAIN.map((t,i)=>['🎓 Level '+(i+1),()=>train(i),'training']),['⚔ Duel vs AI (Pollen)',()=>{$('#duel').hidden=false;$('#own').hidden=true;say('Choose models and hide a message.')},'duel'],['🕵 You hide, AI seeks',()=>{$('#own').hidden=false;$('#duel').hidden=true;$('#game').hidden=true},'own']];
definitions.forEach(([label,fn,kind])=>{const b=document.createElement('button');b.textContent=label;b.dataset.kind=kind;b.onclick=()=>{[...tabs.children].forEach(x=>x.classList.remove('on'));b.classList.add('on');fn()};tabs.append(b)});
$('#next').onclick=()=>{if(R?.mode==='duel')$('#hide').click();else{const i=[...tabs.children].indexOf(document.querySelector('#tabs .on'));tabs.children[(i+1)%tabs.children.length].click()}};
const MSGS=['MEET ME AT MIDNIGHT','THE BEES KNOW THE WAY','HONEY IS A MAP','TRUST THE QUIET STARS','OPEN THE BLUE DOOR'];
$('#dice').onclick=()=>$('#msg').value=MSGS[Math.random()*MSGS.length|0];$('#dice').click();
$('#hide').onclick=async()=>{
 const secret=$('#msg').value.trim();if(norm(secret).length<3)return say('Use a message with at least 3 letters.','bad');if(!conn?.apiKey)return say('Connect your Pollinations account first.','bad');
 $('#hide').disabled=true;say('The hider is drawing…');
 try{const out=await chat($('#hider').value,[{role:'system',content:'You are a creative SVG artist and steganographer.'},{role:'user',content:HIDE(secret,$('#diff').value==='1')}],16000,120000),m=out.match(/<svg[\s\S]*?<\/svg>/i);if(!m)throw Error('No complete SVG returned.');if(hasSecretLeak(m[0],secret))throw Error('The SVG leaked the secret.');const svg=clean(m[0]),scheme=(out.split(/SCHEME:/i)[1]||'AI-generated visual pattern').trim().slice(0,400);start({mode:'duel',secret,svg,scheme,hider:$('#hider').value,hints:['The message has '+norm(secret).length+' letters.','It starts with '+secret[0]+'.']})}catch(e){say(e.message,'bad')}finally{$('#hide').disabled=false}
};
$('#ai').onclick=async()=>{
 if(!R||!conn?.apiKey)return say('Connect Pollinations and select a vision-capable seeker model.','bad');
 $('#ai').disabled=true;say('The AI seeker is studying the image…');
 try{const png=await toPng(R.svg),out=await chat($('#seeker').value,[{role:'user',content:[{type:'text',text:SEEK},{type:'image_url',image_url:{url:png}}]}],4000,90000),guess=(out.match(/MESSAGE:\s*(.*)/i)||[,'NONE'])[1].trim(),method=(out.match(/METHOD:\s*(.*)/i)||[,'No method given'])[1].trim(),ok=sim(guess,R.secret)>=.9;R.ai={guess,method,ok};$('#res').innerHTML+=`<p>🤖 AI: “${esc(guess)}” — ${ok?'recovered':'missed'}<br><small>${esc(method)}</small></p>`;if(R.mode==='own'||R.mode==='duel'){T.an=(T.an||0)+1;if(ok)T.ai=(T.ai||0)+1;save();renderScore()}}catch(e){say(e.message,'bad')}finally{$('#ai').disabled=false}
};
$('#ohide').onclick=()=>{const word=norm($('#omsg').value);if(!/^[A-Z]{2,10}$/.test(word))return say('Use 2–10 letters A–Z.','bad');const i=+$('#osch').value,t=TRAIN[i];start({mode:'own',secret:word,svg:t.g(word,Math.random()*1e6|0),scheme:t.s,schemeIdx:i,hints:[]});R.done=true;$('#guess').hidden=$('#go').parentElement.hidden=$('#hints').hidden=$('#giveup').hidden=true;$('#res').textContent='Your word is hidden. Let the AI try to decode it.';$('#ai').disabled=false;$('#ai').click()};
function fill(sel,models){$(sel).innerHTML=models.map(m=>`<option value="${esc(m)}">${esc(m)}</option>`).join('')}
fetch('https://gen.pollinations.ai/v1/models').then(r=>r.json()).then(j=>{const models=(j.data||j).map(m=>typeof m==='string'?m:m.id).filter(Boolean);fill('#hider',models.filter(x=>!/image|audio|video|tts/i.test(x)));fill('#seeker',models.filter(x=>/gemini|gpt|fable|claude/i.test(x)));fill('#seeker2',models.filter(x=>/gemini|gpt|fable|claude/i.test(x)));fill('#judgeModel',models.filter(x=>/gemini|gpt|fable|claude/i.test(x))) }).catch(()=>say('Could not load the Pollinations model list.','bad'));
if(APP_KEY.includes('REPLACE'))$('#setup').hidden=false;
renderScore();tabs.children[0].click();
