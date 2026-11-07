import { TRAIN, annotate } from './ciphers.js';
import { uri, toRaster, toPng, clean, utf8Base64, hasSecretLeak } from './security.js';
import { createChat, HIDE, buildSeekPrompt } from './api.js';
import { pickPlan, METHODS } from './encoding.js';
import { loadState, saveState, createProgression } from './state.js';
import { runSelfTest } from './selftest.js';
const APP_KEY='pk_zERtArHJHymnUbNl',API='https://gen.pollinations.ai/v1',$=s=>document.querySelector(s),conn=$('polli-connect');
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const norm=s=>s.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]/gu,'');
const lev=(a,b)=>{const d=Array.from({length:a.length+1},(_,i)=>[i,...Array(b.length).fill(0)]);for(let j=1;j<=b.length;j++)d[0][j]=j;for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[a.length][b.length]};
const sim=(a,b)=>{a=norm(a);b=norm(b);const m=Math.max(a.length,b.length);return m?1-lev(a,b)/m:0};
let R=null,T=loadState(),tok=0;const save=()=>saveState(T);const {RANKS,ACHIEVEMENTS,rankFor,grantXP,unlock,evaluateAchievements,fmtTime}=createProgression(()=>T);
const chat=createChat({getConnection:()=>conn,getTokenCount:()=>tok,setTokenCount:v=>tok=v,onUsage:()=>score()});
const score=()=>{const xp=T.xp||0,rank=rankFor(xp),next=RANKS.find(r=>r.xp>xp),base=rank.xp,progress=next?Math.min(100,(xp-base)/(next.xp-base)*100):100;$('#profile').innerHTML=`<div><strong>${rank.name}</strong><div><small>Rank ${RANKS.indexOf(rank)+1} · ${xp} XP${next?` / ${next.xp} XP`:' · MAX RANK'}</small><div class="xpbar"><i style="width:${progress}%"></i></div></div></div><b>🌙</b>`;const bests=Object.values(T.bestTimes||{});$('#bestTime').textContent=bests.length?fmtTime(Math.min(...bests)):'—';const earned=Object.keys(T.achievements||{}).length;$('#achievementCount').textContent=`${earned}/${ACHIEVEMENTS.length}`;$('#achievements').innerHTML=ACHIEVEMENTS.map(([id,ico,name,desc])=>`<div class="achievement ${T.achievements?.[id]?'':'locked'}"><span class="ico">${ico}</span><div><b>${name}</b><br><small>${desc}${T.achievements?.[id]?' · Unlocked':' · Locked'}</small></div></div>`).join('');$('#codexPreview').innerHTML=TRAIN.map((t,i)=>`<div class="achievement ${T.levels?.[i]?'':'locked'}"><span class="ico">${T.levels?.[i]?'📖':'🔒'}</span><div><b>${T.levels?.[i]?esc(t.n):`Unknown Cipher #${i+1}`}</b><br><small>${T.levels?.[i]?esc(t.s):'Complete this training level to reveal its entry.'}</small></div></div>`).join('');$('#score small').textContent=`Daily streak ${T.streak||0} · Levels ${Object.values(T.levels||{}).filter(Boolean).length}/${TRAIN.length} · Duels: you ${T.you}/${T.n} · AI seeker ${T.ai}/${T.an} · tokens: ${tok}${T.st&&T.st.n?` · avg stealth ${(T.st.s/T.st.n).toFixed(1)}/10 (${T.st.n})`:''}`;const seek=Object.entries(T.s||{}).map(([k,v])=>`<li>${esc(k)}: ${v.ok}/${v.n} read</li>`),stl=Object.entries(T.sh||{}).map(([k,v])=>`<li>${esc(k)}: avg stealth ${(v.s/v.n).toFixed(1)}/10 (${v.n})</li>`),rb=Object.entries(T.rb||{}).map(([k,v])=>`<li>Robustness · ${esc(k)}: ${v.ok}/${v.n} recovered, mean similarity ${Math.round(100*v.sim/v.n)}%</li>`);$('#report').innerHTML=[...seek,...stl,...rb].join('')||'<li>Play a Duel or hide a word yourself to fill this in.</li>'};
const say=(m,c='')=>{const s=$('#status');s.textContent=m;s.className=c};
let diagnostics=null;
const renderDiagnostics=()=>{
  const root=$('#diagnosticsContent');if(!root)return;
  if(!diagnostics){root.innerHTML='<small>No AI output captured yet. Start an AI vs AI Duel to inspect the Hider and Seeker responses.</small>';return}
  const d=diagnostics,h=d.hider||{},q=d.seeker||{},v=h.validation||{};
  const report=JSON.stringify({roundId:d.roundId,timestamp:d.timestamp,encoding:d.encoding,
    hider:{model:h.model,responseModel:h.responseModel,finishReason:h.finishReason,completionTokens:h.completionTokens,prompt:h.prompt,rawResponse:h.rawResponse,svg:h.svg,durationMs:h.durationMs,validation:v},
    seeker:q?{model:q.model,prompt:q.prompt,rawResponse:q.rawResponse,decodedMessage:q.decodedMessage,durationMs:q.durationMs,tokens:q.tokens,error:q.error}:null,
    result:d.result,errors:d.errors||[]},null,2);
  root.innerHTML=`<div class="diag-summary">
    <div><b>Encoding</b><small>${esc(d.encoding?.method||'—')} · ${esc(d.encoding?.scene||'—')}</small></div>
    <div><b>Hider</b><small>${esc(h.model||'—')} · ${h.durationMs==null?'pending':h.durationMs+' ms'}</small></div>
    <div><b>Seeker</b><small>${esc(q.model||'—')} · ${q.durationMs==null?'not run':q.durationMs+' ms'}</small></div>
    <div><b>SVG / XML</b><small class="${v.svgValid===true?'ok':v.svgValid===false?'bad':''}">${v.svgValid===true?'Valid':v.svgValid===false?'Invalid':'Not checked'}</small></div>
    <div><b>Encoding fidelity</b><small>Not verified automatically</small></div>
    <div><b>Result</b><small>${d.result?.exactMatch==null?'Pending':d.result.exactMatch?'Exact match':'Mismatch'}</small></div>
  </div>
  <div class="diag-actions"><button type="button" id="copyDiagnostics">Copy diagnostic JSON</button></div>
  <details><summary>Hider raw SVG</summary><pre>${esc(h.svg||'No validated SVG captured.')}</pre></details>
  <details><summary>Hider raw response</summary><pre>${esc(h.rawResponse||'No response captured.')}</pre></details>
  <details><summary>Hider prompt</summary><pre>${esc(h.prompt||'No prompt captured.')}</pre></details>
  <details><summary>Seeker raw response</summary><pre>${esc(q.rawResponse||'Seeker has not run yet.')}</pre></details>
  <details><summary>Seeker prompt</summary><pre>${esc(q.prompt||'Seeker has not run yet.')}</pre></details>
  <details><summary>Complete diagnostic JSON</summary><pre>${esc(report)}</pre></details>
  ${(d.errors||[]).length?'<p class="bad"><b>Errors</b><br>'+d.errors.map(esc).join('<br>')+'</p>':''}`;
  $('#copyDiagnostics')?.addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText(report);say('Diagnostic JSON copied. Review it before sharing.','ok')}
    catch{say('Clipboard access was blocked. Open Complete diagnostic JSON and copy it manually.','bad')}
  });
};

/* ---------- game flow ---------- */
let uiBusy=false,aiInFlight=false,aiAttempted=false,hideInFlight=false;
function renderTries(){const t=$('#tries');if(!R||R.mode==='own'||R.done){t.textContent='';t.removeAttribute('aria-label');return}const left=Math.max(0,R.maxTries-R.tries);t.textContent='●'.repeat(left)+'○'.repeat(R.maxTries-left);t.setAttribute('aria-label',`${left} of ${R.maxTries} tries left`);t.title=`${left} tries left`}
function syncButtons(){
  renderTries();
  document.querySelectorAll('button').forEach(b=>{b.disabled=uiBusy});
  $('#after').hidden=!(R&&(R.done||R.mode==='duel'));
  if(!uiBusy&&R){
    $('#go').disabled=R.done;$('#giveup').disabled=R.done;
    $('#hint').disabled=R.done||R.used>=R.hints.length;
    $('#ai').disabled=(R.done&&R.mode!=='own'&&aiAttempted)||aiInFlight||aiAttempted;$('#ai').textContent=R.mode==='duel'?(R.aiHistory?.length?'Retry AI Seeker 💰':'Challenge AI Seeker 💰'):(aiAttempted?'AI answer locked':(R.aiHistory?.length?'Retry AI seeker 💰':'Let the AI try 💰'));
    $('#next').disabled=!R.done;
  }else if(!uiBusy){
    $('#go').disabled=true;$('#giveup').disabled=true;$('#hint').disabled=true;$('#ai').disabled=true;$('#next').disabled=true;
  }
}
function busy(b,m){uiBusy=!!b;syncButtons();if(m)say(m)}
function start(r){R=Object.assign({tries:0,used:0,done:false,ai:null,maxTries:3,noHints:false},r);if(R.diagnostics)diagnostics=R.diagnostics;renderDiagnostics();R.startedAt=performance.now();aiInFlight=false;aiAttempted=false;$('#imgbox').innerHTML=`<img alt="Puzzle picture" src="${uri(R.svg)}">`;$('#res').innerHTML='';$('#robustnessReport').innerHTML='';$('#hints').innerHTML='';$('#guess').value='';$('#game').hidden=false;const hiderDuel=R.mode==='duel';$('#game').classList.toggle('hider-duel',hiderDuel);$('#duelRoles').hidden=!hiderDuel;$('#guess').hidden=hiderDuel;$('#guess').previousElementSibling.hidden=hiderDuel;$('#go').parentElement.hidden=hiderDuel;$('#hints').hidden=hiderDuel;$('#giveup').hidden=hiderDuel;$('#next').hidden=true;$('#hint').hidden=hiderDuel||!!R.noHints;$('#hint').disabled=hiderDuel||!!R.noHints;$('#ai').hidden=false;$('#revealHow').hidden=false;$('#revealHow').textContent=R.schemeIdx==null?'✨ How was it hidden? (1 paid call)':'✨ How was it hidden?';syncButtons();say(hiderDuel?'AI Hider has hidden your chosen message. Now watch the AI Seeker try to decode it.':'Find the hidden message. '+R.maxTries+' tries.');if(!hiderDuel)$('#guess').focus()}
function finish(ok){if(!R||R.done)return;R.done=true;R.elapsedMs=Math.max(0,performance.now()-(R.startedAt||performance.now()));syncButtons();let earned=0;if(ok&&(R.mode==='train'||R.mode==='daily')){T.solves=(T.solves||0)+1;if(R.tries===1)T.firstTry=(T.firstTry||0)+1;if(R.used===0)T.noHintSolves=(T.noHintSolves||0)+1;const hr=new Date().getHours();if(hr>=0&&hr<5)T.nightSolves=(T.nightSolves||0)+1;const timeKey=R.mode==='daily'?`daily-${R.day}`:`training-${R.schemeIdx}`;T.bestTimes=T.bestTimes||{};if(!T.bestTimes[timeKey]||R.elapsedMs<T.bestTimes[timeKey])T.bestTimes[timeKey]=R.elapsedMs;if(R.mode==='train'){T.levels=T.levels||{};const first=!T.levels[R.schemeIdx];T.levels[R.schemeIdx]=true;if(first)earned+=grantXP(`training-${R.schemeIdx}`,50,'Training level completed');const tb=[...$('#tabs').children].find(x=>x.dataset.kind==='training'&&x.textContent.includes(`Level ${R.schemeIdx+1}`));if(tb)tb.textContent=`🎓 Level ${R.schemeIdx+1} ✓`}else{T.dailyWins=T.dailyWins||[];if(!T.dailyWins.includes(R.day)){T.dailyWins.push(R.day);earned+=grantXP(`daily-${R.day}`,75,'Daily cipher solved');if(R.used===0)earned+=grantXP(`daily-no-hints-${R.day}`,25,'Daily solved without hints');if(R.tries===1)earned+=grantXP(`daily-first-try-${R.day}`,25,'Daily solved on first try');}if(T.last!==R.day){T.streak=T.last===R.day-1?(T.streak||0)+1:1;T.last=R.day}}evaluateAchievements(TRAIN)}const pts=ok?Math.max(10,100-20*R.used-15*(R.tries-1)):0;$('#res').innerHTML=`<b class="${ok?'ok':'bad'}">${ok?'Found it! +'+pts+' points':'Out of tries.'}</b> The message was “${esc(R.secret)}”.<br><small>How it was hidden: ${esc(R.scheme||'unknown')}</small>${ok&&(R.mode==='train'||R.mode==='daily')?`<br><small>Time: ${fmtTime(R.elapsedMs)} · ${earned?`+${earned} XP`:'No new XP (already claimed)'}</small>`:''}`+stealthLine()+(R.ai?aiLine():'');if(R.mode==='duel'){T.n++;if(ok)T.you++;save();score()}if(R.mode==='daily'){$('#res').innerHTML+='<p><button id="sh">Copy result</button></p>';$('#sh').onclick=()=>{navigator.clipboard.writeText(`Night Cipher #${R.day-20000} ${ok?'✅':'❌'} ${R.tries}/${R.maxTries} tries · ${R.used} hints\n${location.href}`);say('Result copied!')}}if(ok){evaluateAchievements(TRAIN);save();score()}$('#next').hidden=false;say(ok?'Cipher solved. Progress saved locally.':'Round finished.')}
const aiLine=()=>`<p>🤖 AI seeker said: “${esc(R.ai.guess)}” — <b class="${R.ai.ok?'ok':'bad'}">${R.ai.ok?'it found it':'it missed it'}</b> (${Math.round(R.ai.s*100)}% similar).<br><small>Model: ${esc(R.ai.model||'unknown')} · ${R.ai.durationMs??'—'} ms · ${R.ai.tokens??'—'} tokens<br>Its method: ${esc(R.ai.method)}${R.method?`<br>Method fixed by the game: ${esc(R.methodLabel)} · Scene: ${esc(R.scene)}`:''}</small></p>`;
$('#go').onclick=()=>{if(!R||R.done)return;const g=$('#guess').value.trim();if(!g)return;R.tries++;renderTries();const s=sim(g,R.secret);
if(s>=.9)finish(true);else if(R.tries>=R.maxTries)finish(false);else say(`Not quite (${Math.round(s*100)}% similar). ${R.maxTries-R.tries} tries left.`,'bad')};
$('#guess').onkeydown=e=>{if(e.key=='Enter')$('#go').click()};
$('#hint').onclick=()=>{if(!R||R.done||R.used>=R.hints.length)return;$('#hints').innerHTML+=`<li>${esc(R.hints[R.used++])}</li>`;if(R.used>=R.hints.length)$('#hint').disabled=true};
$('#giveup').onclick=()=>{if(R&&!R.done)finish(false)};
const stealthLine=()=>R&&R.stealth?`<p>🕵️ <b>Stealth ${R.stealth}/10</b> — ${esc(R.stealthNote||'')}</p>`:'';
const JUDGE='Study this picture carefully. It may or may not hide a secret message encoded somewhere in its visual structure. Rate how INNOCENT it looks to a casual viewer: 10 = completely ordinary, nothing seems off; 1 = obviously suspicious or unnatural. Then give one short sentence of justification.\nReply with exactly two lines:\nSTEALTH: <integer 1-10>\nNOTE: <one sentence>';
async function judgeStealth(r){const key=conn&&conn.apiKey;if(!key)return null;try{const round=r,png=await toPng(round.svg),out=await chat($('#judgeModel').value,[{role:'user',content:[{type:'text',text:JUDGE},{type:'image_url',image_url:{url:png}}]}],1000,60000);if(round!==R)return null;const s=Math.max(1,Math.min(10,parseInt((out.match(/STEALTH:\s*(\d+)/i)||[,'5'])[1])||5)),note=(out.match(/NOTE:\s*(.*)/i)||[,''])[1].trim();round.stealth=s;round.stealthNote=note;T.st=T.st||{s:0,n:0};T.st.s+=s;T.st.n++;const hn=round.hider;if(hn){T.sh=T.sh||{};const e=T.sh[hn]=T.sh[hn]||{s:0,n:0};e.s+=s;e.n++}save();score();if(round===R&&round.done)$('#res').innerHTML+=stealthLine();return{s,note}}catch(e){if(r===R&&!R.done)say(e.message,'bad');return null}}


$('#revealHow').onclick=async()=>{
  const round=R;if(!round)return;
  if(round.schemeIdx!=null){$('#imgbox').innerHTML=`<img class="revealed" alt="Revealed encoding" src="${uri(annotate(round.svg,round.schemeIdx))}">`;say('The encoding, laid bare — every letter exactly where it hid.')}
  else{
    const key=conn&&conn.apiKey;if(!key)return say('Connect to let the hider reveal its own trick (1 call, paid with your Pollen).','bad');
    busy(true,'The hider is drawing its own confession…');
    try{
      const out=await chat(round.hider,[{role:'user',content:`Here is the SVG code of a picture you drew that hides the message "${round.secret}":\n${round.svg}\n\nOutput the SAME picture with the hiding visually revealed: draw bright pinkish-red outlines around every element that carries part of the message and add a bold monospace label next to each showing the letter it encodes, so a human can see at a glance exactly how the message was hidden. Do not change anything else about the scene. Reply with only the raw <svg>...</svg>.`}],16000,90000);
      if(round!==R)return;
      const m=out.match(/<svg[\s\S]*?<\/svg>/i);if(!m)throw Error('No annotated SVG came back. Try again.');
      $('#imgbox').innerHTML=`<img class="revealed" alt="Revealed encoding" src="${uri(clean(m[0]))}">`;say('The hider confessed — this is where every letter lived.');
    }catch(e){if(round===R)say(e.message,'bad')}
    finally{busy(false)}
  }
};
$('#save').onclick=async()=>{if(!R)return;const a=document.createElement('a');a.href=await toPng(R.svg);a.download='night-cipher.png';a.click()};
$('#ai').onclick=async()=>{
  const round=R;if(!round||(round.done&&round.mode!=='own'&&aiAttempted)||aiInFlight||aiAttempted)return;
  aiInFlight=true;aiAttempted=true;const attemptStarted=Date.now(),tokensBefore=tok,model=$(round.mode=='own'?'#seeker2':'#seeker').value;busy(true,'The AI seeker is studying the picture…');
  try{
    const seekerPrompt=buildSeekPrompt(round,{retry:!!round.aiHistory?.length}),seekerStarted=Date.now();
    if(diagnostics){diagnostics.seeker={model,prompt:seekerPrompt,rawResponse:'',decodedMessage:'',durationMs:null,tokens:null};renderDiagnostics()}
    const png=await toPng(round.svg),out=await chat(model,[{role:'user',content:[{type:'text',text:seekerPrompt},{type:'image_url',image_url:{url:png}}]}],4000,90000);
    if(round!==R)return;
    if(diagnostics){diagnostics.seeker.rawResponse=out;diagnostics.seeker.durationMs=Date.now()-seekerStarted;diagnostics.seeker.tokens=tok-tokensBefore}
    const gm=out.match(/^MESSAGE:\s*(.*)$/im);if(!gm)throw Error('The model returned no valid MESSAGE line. Try again or select another vision model.');
    const g=gm[1].trim(),mt=(out.match(/^METHOD:\s*(.*)$/im)||[,'(none given)'])[1].trim(),s=sim(g,round.secret);
    if(diagnostics){diagnostics.seeker.decodedMessage=g;diagnostics.result={success:s>=.9,exactMatch:norm(g)===norm(round.secret),similarity:s};renderDiagnostics()}
    round.ai={guess:g,method:mt,s,ok:s>=.9,model,durationMs:Date.now()-attemptStarted,tokens:tok-tokensBefore};round.aiHistory=round.aiHistory||[];round.aiHistory.push({...round.ai,at:Date.now()});
    if(round.mode=='duel'||round.mode=='own'){T.an++;if(round.ai.ok)T.ai++;const k=(round.mode=='own'?'your '+round.sname:'hider '+round.hider)+' → '+$(round.mode=='own'?'#seeker2':'#seeker').value+(round.method?' · '+METHODS[round.method].short:''),v=(T.s=T.s||{})[k]=T.s[k]||{n:0,ok:0};v.n++;if(round.ai.ok)v.ok++;save();score()}
    if(round.mode==='duel'){$('#res').innerHTML=aiLine();if(round.ai.ok){aiAttempted=true;say('AI Seeker decoded the message chosen for this duel.','ok')}else{aiAttempted=false;say(g.toUpperCase()==='NONE'?'AI Seeker could not produce a defensible decoding. You can retry or change the model.':'AI Seeker failed to recover the message. You can retry or change the model.','bad')}}else if(g.toUpperCase()==='NONE'||s<.9){aiAttempted=false;if(round.done)$('#res').innerHTML=$('#res').innerHTML.split('<p>🤖 AI seeker said:')[0]+aiLine();say(g.toUpperCase()==='NONE'?'The AI found no defensible decoding. Retry or choose another vision model.':'The AI returned an incorrect answer. Retry or choose another vision model.','bad')}else if(round.done){$('#res').innerHTML=$('#res').innerHTML.split('<p>🤖 AI seeker said:')[0]+aiLine();say('The AI recovered the message.')}else say('The AI has locked in an answer. Finish your round to see it.');
  }catch(e){if(round===R){if(diagnostics){diagnostics.errors.push(e.message);if(diagnostics.seeker&&!diagnostics.seeker.rawResponse)diagnostics.seeker.error=e.message;renderDiagnostics()}aiAttempted=false;say(e.message,'bad')}}
  finally{aiInFlight=false;busy(false)}
};
/* ---------- image degradation & robustness experiment ---------- */
let robustnessInFlight=false;
const ROBUST_VARIANTS=[
  {id:'png',label:'PNG · lossless',mime:'image/png'},
  {id:'jpg85',label:'JPEG · quality 85%',mime:'image/jpeg',quality:.85},
  {id:'jpg55',label:'JPEG · quality 55%',mime:'image/jpeg',quality:.55}
];
const robustnessModel=round=>$(round.mode==='own'?'#seeker2':'#seeker').value;
const robustnessHtml=rows=>`<section class="card" style="margin-top:10px;padding:10px"><b>Image robustness results</b><br><small>Same SVG, same seeker model, three image encodings. Success = ≥90% normalized text similarity.</small><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:.88rem"><thead><tr><th align="left">Image</th><th align="left">AI guess</th><th>Similarity</th><th>Status</th><th>Image KB</th><th>Tokens</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.label)}</td><td>${esc(r.guess||'—')}</td><td align="center">${r.s==null?'—':Math.round(r.s*100)+'%'}</td><td align="center" class="${r.ok?'ok':'bad'}">${r.error?'Error':r.ok?'Recovered':'Missed'}</td><td align="center">${r.imageKB??'—'}</td><td align="center">${r.tokens??'—'}</td></tr>`).join('')}</tbody></table></div><small>JPEG quality is the browser canvas encoder setting, not a guaranteed file-size or perceptual-quality percentage. Results depend on model, prompt, and image content.</small></section>`;
$('#robustness').onclick=async()=>{
  const round=R;if(!round||robustnessInFlight||aiInFlight)return;
  if(!conn||!conn.apiKey)return say('Connect your Pollinations account first. This experiment makes 3 additional paid vision requests.','bad');
  const model=robustnessModel(round);if(!model)return say('Select a vision-capable seeker model first.','bad');
  if(!confirm('Run the robustness experiment? It sends 3 additional requests to the selected vision model and uses Pollen.'))return;
  robustnessInFlight=true;const rows=[];$('#robustnessReport').innerHTML='';busy(true,'Preparing PNG and JPEG variants…');
  try{
    for(const variant of ROBUST_VARIANTS){
      if(R!==round)break;
      const before=tok,row={id:variant.id,label:variant.label,guess:'',s:null,ok:false,tokens:0};
      try{
        const image=await toRaster(round.svg,variant.mime,variant.quality);
        row.imageKB=Math.round((image.length- image.indexOf(',')-1)*.75/1024*10)/10;
        const out=await chat(model,[{role:'user',content:[{type:'text',text:buildSeekPrompt(round)},{type:'image_url',image_url:{url:image}}]}],4000,90000);
        const g=(out.match(/MESSAGE:\s*(.*)/i)||[,'NONE'])[1].trim();
        row.guess=g;row.method=(out.match(/METHOD:\s*(.*)/i)||[,''])[1].trim();row.s=sim(g,round.secret);row.ok=row.s>=.9;row.tokens=tok-before;
      }catch(e){row.error=e.message;row.tokens=tok-before}
      rows.push(row);$('#robustnessReport').innerHTML=robustnessHtml(rows);
    }
    if(R!==round)return;
    round.robustness=rows;
    T.rb=T.rb||{};
    for(const row of rows){if(row.s==null)continue;const key=model+' · '+row.id,v=T.rb[key]=T.rb[key]||{n:0,ok:0,sim:0};v.n++;v.sim+=row.s;if(row.ok)v.ok++}
    save();score();
    const valid=rows.filter(r=>r.s!=null),wins=valid.filter(r=>r.ok).length;
    say(`Robustness test complete: ${wins}/${valid.length} image variants recovered${rows.some(r=>r.error)?' (some requests failed)':''}.` ,wins===3?'ok':'');
  }finally{robustnessInFlight=false;busy(false)}
};

const MSGS=['MEET ME AT MIDNIGHT','THE BEES KNOW THE WAY','HONEY IS A MAP','TRUST THE QUIET STARS','OPEN THE BLUE DOOR','THE HONEY IS A MAP'];
const updCount=()=>{const m=$('#msg');$('#msgCount').textContent=`${m.value.length} / ${m.maxLength}`};
const rnd=()=>{$('#msg').value=MSGS[Math.random()*MSGS.length|0];updCount()};$('#dice').onclick=rnd;$('#msg').addEventListener('input',updCount);rnd();
$('#hide').onclick=async()=>{
  if(hideInFlight)return;
  const secret=$('#msg').value.trim(),ns=norm(secret);if(!/^[A-Z ]{3,24}$/i.test(secret)||ns.length<3)return say('Use 3–24 characters with at least 3 letters: English letters A–Z and spaces only. Digits and Greek characters are not supported by the current visual encodings.','bad');
  if(!conn||!conn.apiKey)return say('Connect your Pollinations account first (button, top right).','bad');
  hideInFlight=true;busy(true,'AI Hider is creating the image… this may take a minute or two.');
  if(!$('#imgbox img'))$('#imgbox').textContent='🎨 AI Hider is creating an image containing your chosen message…';
  try{
    const dl=T.duelLog=T.duelLog||{n:0},plan=pickPlan(secret,{lastMethod:dl.method,lastScene:dl.scene,round:dl.n});
    const hiderModel=$('#hider').value,hiderPrompt=HIDE(secret,$('#diff').value=='1',plan),hiderStarted=Date.now();
    diagnostics={roundId:(globalThis.crypto?.randomUUID?.()||String(hiderStarted)),timestamp:new Date().toISOString(),encoding:{method:plan.method,label:plan.label,scene:plan.scene,expectedMessage:secret},hider:{model:hiderModel,prompt:hiderPrompt,rawResponse:'',svg:'',durationMs:null,validation:{xmlValid:null,svgValid:null,encodingValid:null,errors:[]}},seeker:null,result:null,errors:[]};
    renderDiagnostics();
    const out=await chat(hiderModel,[{role:'system',content:'You are a creative SVG artist and steganographer. Output only what is asked.'},{role:'user',content:hiderPrompt}],16000,120000,{requestType:'hider',onRawResponse:meta=>{diagnostics.hider.rawResponse=meta.text;diagnostics.hider.responseModel=meta.model;diagnostics.hider.finishReason=meta.finishReason;diagnostics.hider.completionTokens=meta.completionTokens;diagnostics.hider.durationMs=Date.now()-hiderStarted;renderDiagnostics()}});
    diagnostics.hider.rawResponse=out;diagnostics.hider.durationMs=Date.now()-hiderStarted;renderDiagnostics();
    const m=out.match(/<svg[\s\S]*?<\/svg>/i);if(!m){diagnostics.hider.validation.errors.push('No complete SVG found in Hider response.');throw Error('No complete SVG came back (the model may have run out of tokens). Try again or use another model.')}
    let safe;try{safe=clean(m[0]);diagnostics.hider.validation.xmlValid=true;diagnostics.hider.validation.svgValid=true;diagnostics.hider.svg=safe}catch(e){diagnostics.hider.validation.xmlValid=false;diagnostics.hider.validation.svgValid=false;diagnostics.hider.validation.errors.push(e.message);throw e}
    renderDiagnostics();
    if(hasSecretLeak(safe,secret)){diagnostics.hider.validation.errors.push('Secret leakage detected in SVG text or attributes.');throw Error('The hider leaked the secret in SVG text or attributes, so the round was voided. Try again.')}
    const sc=(out.split(/SCHEME:/i)[1]||'').trim().slice(0,400),words=secret.split(/\s+/).length;
    if(!sc){diagnostics.hider.validation.errors.push('Missing SCHEME explanation.');throw Error('The hider did not provide a SCHEME explanation. Try again.')}
    if(hasSecretLeak(sc,secret,{strictWords:false})){diagnostics.hider.validation.errors.push('SCHEME explanation reveals the complete secret message.');throw Error('The SCHEME explanation reveals the complete secret message. The round was voided; try again.')}
    start({mode:'duel',schemeIdx:null,hider:hiderModel,secret,svg:safe,scheme:sc,method:plan.method,methodLabel:plan.label,scene:plan.scene,diagnostics,hints:[ns.length+' letters in '+words+' words.','It starts with “'+[...secret][0]+'”.','The hider confessed: '+sc]});
    dl.n++;dl.method=plan.method;dl.scene=plan.scene;save();    if($('#judge').checked&&conn.apiKey)judgeStealth(R);
  }catch(e){if(diagnostics){diagnostics.errors.push(e.message);renderDiagnostics()}say(e.message,'bad');if(!$('#imgbox img'))$('#imgbox').textContent=IDLE.duel}
  finally{hideInFlight=false;busy(false)}
}
$('#next').onclick=()=>{
  if(R.mode=='duel'){$('#duel').hidden=false;$('#hide').click();return}
  const i=allTabs.findIndex(x=>x.classList.contains('on'));
  allTabs[(i+1)%allTabs.length].click();
};
const DW=['HONEY','NECTAR','HIVE','BLOOM','POLLEN','CLOVER','AMBER','LANTERN','COMET','ORBIT','EMBER','FROST','HARBOR','MIRROR','SIGNAL','WHISPER','COPPER','ANCHOR','VELVET','MARBLE','RIVER','SHADOW','CRYSTAL','MEADOW'];
/* Daily uses LOCAL midnight (not UTC). Helpers: */
let dailyTimer=null;
const localDay=()=>Math.floor((Date.now()-new Date().getTimezoneOffset()*60000)/864e5);
const nextLocalMidnight=()=>{const d=new Date();return new Date(d.getFullYear(),d.getMonth(),d.getDate()+1).getTime()};
const fmtLeft=ms=>{const s=Math.max(0,Math.floor(ms/1000)),h=Math.floor(s/3600),m=Math.floor(s%3600/60);return h?`${h}h ${m}m`:`${m}m`};
const hash32=x=>{let h=2166136261;for(const c of String(x)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
const dailyIndexCache=new Map();
const dailyIndex=n=>{if(dailyIndexCache.has(n))return dailyIndexCache.get(n);let prev=-1;for(let d=0;d<=n;d++){let i=hash32('night-cipher-scheme-'+d)%TRAIN.length;if(i===prev)i=(i+1+hash32('rotate-'+d)%(TRAIN.length-1))%TRAIN.length;dailyIndexCache.set(d,i);prev=i}return prev};
const dailyWord=n=>DW[hash32('night-cipher-word-'+n)%DW.length];
function daily(){
  const n=localDay(),i=dailyIndex(n),t=TRAIN[i],w=dailyWord(n);
  const tier=i<3?'Easy':i<7?'Medium':'Hard',mods=['Standard','No-Hint Protocol','Time Pressure'];
  const modifier=mods[hash32('night-cipher-modifier-'+n)%mods.length],maxTries=modifier==='Time Pressure'?2:3,noHints=modifier==='No-Hint Protocol';
  start({mode:'daily',schemeIdx:i,day:n,difficulty:tier,modifier,maxTries,noHints,secret:w,svg:t.g(w,hash32('night-cipher-art-'+n)),scheme:t.s,hints:[...t.h,`It starts with “${w[0]}”.`]});
  const msg=()=>`Daily cipher #${n-20000} · ${tier} · ${modifier} · same puzzle for everyone in your timezone today. Next in ${fmtLeft(nextLocalMidnight()-Date.now())}. ${maxTries} tries${noHints?' · hints disabled':''}.`;
  say(msg());
  clearInterval(dailyTimer);
  dailyTimer=setInterval(()=>{
    if(!R||R.mode!=='daily'){clearInterval(dailyTimer);return}
    if(localDay()!==n){
      if(R.done){clearInterval(dailyTimer);say('🌅 A new daily cipher is ready — click 📅 Daily to play it.');}
      return;
    }
    if($('#status').textContent.startsWith(`Daily cipher #${n-20000}`))say(msg());
  },30000);
}
$('#osch').innerHTML=TRAIN.map((t,i)=>`<option value="${i}">Unknown Cipher #${String(i+1).padStart(2,'0')}</option>`).join('');
$('#ohide').onclick=async()=>{const w=norm($('#omsg').value);if(!/^[A-Z]{2,10}$/.test(w))return say('Use 2–10 letters A–Z.','bad');
if(!conn||!conn.apiKey)return say('Connect your Pollinations account first (button, top right).','bad');
const t=TRAIN[$('#osch').value],nm=`Cipher #${String(+$('#osch').value+1).padStart(2,'0')}`;start({mode:'own',schemeIdx:+$('#osch').value,secret:w,svg:t.g(w,Math.random()*1e6|0),scheme:t.s,sname:nm,hints:[]});R.done=true;$('#game').hidden=false;$('#guess').hidden=true;$('#guess').previousElementSibling.hidden=true;$('#go').parentElement.hidden=true;$('#hints').hidden=true;$('#giveup').hidden=true;$('#revealHow').hidden=false;
$('#res').innerHTML=`<b>Your puzzle: “${esc(w)}” hidden with ${esc(nm)}.</b>`;$('#ai').disabled=false;$('#ai').click()};

/* ---------- tabs & models ---------- */
function train(i){const t=TRAIN[i],w=DW[hash32('training-word-'+i+'-'+localDay())%DW.length],tier=i<3?'Easy':i<7?'Medium':'Hard';$('#duel').hidden=true;start({mode:'train',schemeIdx:i,difficulty:tier,secret:w,svg:t.g(w,hash32('training-art-'+i+'-'+localDay())),scheme:t.s,hints:[...t.h,`It starts with “${w[0]}”.`]});say(`Level ${i+1} · ${tier}. Find the hidden message. You have 3 tries.`)}
const tabs=$('#tabs'),levels=$('#levels'),allTabs=[];
const IDLE={duel:'Choose a secret message. AI Hider will hide it in an image, then AI Seeker will try to decode it.',own:'Pick a word and a hiding scheme on the right, then press “Challenge the AI”.'};
function stageIdle(m){$('#imgbox').textContent=m;$('#res').innerHTML='';$('#robustnessReport').innerHTML=''}
const INTRO={daily:'Every picture hides a word. Spot the pattern, then type the word on the right. One puzzle a day, the same for everyone.',learn:'Every picture hides a word. Spot the pattern, then type it on the right. Hints cost points.',duel:'Choose a secret message and watch two AI models compete: AI Hider conceals it in an image, then AI Seeker tries to recover it. You are the referee.',own:'Choose a word and a hiding scheme, then see whether an AI seeker can read your picture.'};
function learn(){const lv=allTabs.filter(x=>x.dataset.kind==='training'),i=Math.max(0,TRAIN.findIndex((_,k)=>!(T.levels&&T.levels[k])));lv[i].click()}
const tabDefs=[
  ['📅 Daily',daily,'daily'],
  ['🎓 Learn',learn,'learn'],
  ...TRAIN.map((t,i)=>['🎓 Level '+(i+1)+(T.levels&&T.levels[i]?' ✓':''),()=>train(i),'training']),
  ['⚔ AI vs AI Duel 💰',()=>{if(!(R&&R.mode==='duel'))stageIdle(IDLE.duel);$('#duel').hidden=false;$('#game').hidden=!(R&&R.mode=='duel');say('Choose the secret message and AI models, then start the duel.')},'duel'],
  ['🕵 You hide, AI seeks 💰',()=>{if(!(R&&R.mode==='own'))stageIdle(IDLE.own);$('#own').hidden=false;$('#game').hidden=true;say('Hide a word with a scheme of your choice and see if the AI can read it.')},'own']
];
tabDefs.forEach(([label,fn,kind])=>{
  const b=document.createElement('button');
  b.textContent=label;
  b.dataset.kind=kind;
  b.onclick=()=>{
    allTabs.forEach(x=>x.classList.remove('on','in'));
    const inLearn=kind==='training'||kind==='learn';
    b.classList.add(kind==='learn'?'in':'on');
    if(kind==='training')allTabs.find(x=>x.dataset.kind==='learn').classList.add('in');
    levels.hidden=!inLearn;
    $('#intro').textContent=INTRO[inLearn&&kind!=='daily'?'learn':kind];
    $('#duel').hidden=$('#own').hidden=true;
    fn();
  };
  allTabs.push(b);(kind==='training'?levels:tabs).append(b);
});

/* ---------- model discovery: vision-aware ---------- */
function fill(sel,ids,pref){$(sel).innerHTML=ids.map(i=>`<option value="${esc(i)}">${/fable/i.test(i)?'★ ':''}${esc(i)}</option>`).join('');const p=ids.find(i=>pref.test(i));if(p)$(sel).value=p}
const supportsVisionInput=m=>typeof m==='object'&&m!==null&&(
  (Array.isArray(m.input_modalities)&&m.input_modalities.includes('image'))||
  Number(m.max_reference_images)>0
);
if(!/selftest/.test(location.search))fetch(API+'/models')
  .then(r=>{if(!r.ok)throw Error(`Model discovery failed (${r.status})`);return r.json()})
  .then(j=>(j.data||j))
  .then(models=>{
    if(!Array.isArray(models))throw Error('Unexpected model list format.');
    const text=models.filter(m=>{
      const id=typeof m==='string'?m:m?.id;
      return typeof id==='string'&&!/flux|image|video|tts|audio|whisper|embed|music|realtime|3d|sora|veo|seedance|suno/i.test(id);
    });
    const idOf=m=>typeof m==='string'?m:m.id;
    const allIds=text.map(idOf).filter(Boolean);
    const visionIds=text.filter(supportsVisionInput).map(idOf).filter(Boolean);
    fill('#hider',allIds,/fable/i);
    fill('#seeker',visionIds,/fable|gemini|gpt/i);fill('#seeker2',visionIds,/fable|gemini|gpt/i);fill('#judgeModel',visionIds,/gemini|gpt/i);
    if(!visionIds.length){
      const heuristicIds=allIds.filter(id=>/claude|gemini|gpt-5|fable|kimi/i.test(id));
      ['#seeker','#seeker2','#judgeModel'].forEach(sel=>{
        const el=$(sel);
        el.innerHTML='<option value="">No verified vision models found</option>'+
          (heuristicIds.length?'<option value="__try_heuristic__">⚠ Try unverified vision candidates…</option>':'');
        el.disabled=!heuristicIds.length;
        el.onchange=()=>{
          if(el.value!=='__try_heuristic__')return;
          el.innerHTML=heuristicIds.map(id=>`<option value="${esc(id)}">${esc(id)} — unverified</option>`).join('');
          el.value=heuristicIds[0]||'';
          say('Warning: these models were selected by name only. Pollinations has not confirmed image-input support; requests may fail or incur Pollen charges.','bad');
        };
      });
      say(heuristicIds.length
        ?'No verified vision metadata was returned. You can explicitly opt in to unverified model-name candidates from the Seeker/Judge selectors.'
        :'No vision-capable models or heuristic candidates were found in the catalog.','bad');
    }else ['#seeker','#seeker2','#judgeModel'].forEach(sel=>{$(sel).disabled=false;$(sel).onchange=null});
  })
  .catch(e=>{
    ['#seeker','#seeker2','#judgeModel'].forEach(sel=>{$(sel).innerHTML='<option value="">Vision model discovery unavailable</option>';$(sel).disabled=true});
    say(e.message+' — reload after checking the Pollinations API.','bad');
  });
if(APP_KEY.includes('REPLACE'))$('#setup').hidden=false;score();allTabs[0].click();

/* ---------- first-visit "How to play" ---------- */
const howto=$('#howto'),HOWTO_KEY='nc-howto-seen';
const openHowto=()=>{if(!howto.open){howto.showModal();howto.scrollTop=0}};
$('#howtoBtn').onclick=openHowto;
$('#howtoClose').onclick=()=>howto.close();
howto.addEventListener('close',()=>{try{localStorage.setItem(HOWTO_KEY,'1')}catch{/* storage unavailable */}});
try{if(!localStorage.getItem(HOWTO_KEY)&&!/selftest/.test(location.search))openHowto()}catch{/* storage unavailable */}

if(/selftest/.test(location.search))runSelfTest({getState:()=>T,setState:v=>{T=v},getRound:()=>R,setRound:v=>{R=v},getTokens:()=>tok,setTokens:v=>{tok=v},conn,$,esc,TRAIN,toPng,toRaster,dailyIndex,dailyWord,hash32,sim,supportsVisionInput,clean,hasSecretLeak,utf8Base64,annotate,chat,score,syncButtons});
