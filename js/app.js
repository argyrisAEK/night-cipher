import { TRAIN, annotate } from './ciphers.js';
import { uri, toRaster, toPng, clean, utf8Base64, hasSecretLeak } from './security.js';
import { createChat, HIDE, buildSeekPrompt } from './api.js';
import { loadState, saveState } from './state.js';
import { runSelfTest } from './selftest.js';
import { parseSeekerResponse, compareSeekers, auditBlindRequest, normalizeMessage } from './quality.js';
import { POLLINATIONS_MODELS } from './models.js';
import { loadModelCatalog, getModelMetadata, describeModel, estimatePollenCost, formatPollenCost } from './model-catalog.js';
import { mountLsbLab } from './lsb-lab.js';
import { mountCipherWalkthrough } from './walkthrough.js';
import { mountStructuralSandbox } from './structural-sandbox.js';
import { summarizeEvidence, filterEvidence, evidenceToCSV } from './failure-analysis.js';
import { createDegradationVariants } from './degradation.js';
const APP_KEY='pk_zERtArHJHymnUbNl',API='https://gen.pollinations.ai/v1',$=s=>document.querySelector(s),conn=$('polli-connect');
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const norm=s=>s.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]/gu,'');
const lev=(a,b)=>{const d=Array.from({length:a.length+1},(_,i)=>[i,...Array(b.length).fill(0)]);for(let j=1;j<=b.length;j++)d[0][j]=j;for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[a.length][b.length]};
const sim=(a,b)=>{a=norm(a);b=norm(b);const m=Math.max(a.length,b.length);return m?1-lev(a,b)/m:0};
const simMessage=(a,b)=>{a=normalizeMessage(a);b=normalizeMessage(b);const m=Math.max(a.length,b.length);return m?1-lev(a,b)/m:0};
let R=null,T=loadState(),tok=0,modelCatalog=new Map();const save=()=>saveState(T);
const chat=createChat({getConnection:()=>conn,getTokenCount:()=>tok,setTokenCount:v=>tok=v,onUsage:()=>score()});
const recordEvidence=event=>{T.evidence=Array.isArray(T.evidence)?T.evidence:[];T.evidence.unshift({id:globalThis.crypto?.randomUUID?.()||String(Date.now()),timestamp:new Date().toISOString(),...event});T.evidence=T.evidence.slice(0,200);save();renderEvidence()};
const renderEvidence=()=>{const root=$('#evidenceTable');if(!root)return;const events=Array.isArray(T.evidence)?T.evidence:[],type=$('#evidenceType')?.value||'all',outcome=$('#evidenceOutcome')?.value||'all',model=$('#evidenceModel')?.value||'',query=$('#evidenceSearch')?.value||'',models=[...new Set(events.flatMap(e=>[e.hiderModel,e.seekerModel]).filter(Boolean))].sort(),sel=$('#evidenceModel'),selected=sel?.value||'';if(sel){sel.innerHTML='<option value="">All models</option>'+models.map(m=>'<option value="'+esc(m)+'">'+esc(m)+'</option>').join('');sel.value=models.includes(selected)?selected:''}const rows=filterEvidence(events,{type,outcome,model,query}),s=summarizeEvidence(events);$('#evidenceStats').innerHTML=[['Recorded events',s.total],['Failures',s.failures],['Successful checks',s.successes],['Failure rate',s.failureRate==null?'Not tested':Math.round(s.failureRate*100)+'%']].map(([a,b])=>'<div><b>'+b+'</b><small>'+a+'</small></div>').join('');if(!rows.length){root.innerHTML='<p class="report-empty">'+(events.length?'No events match these filters.':'No experiments recorded yet. Run an AI Hider / Seeker duel to begin collecting evidence.')+'</p>';return}const c=v=>esc(v==null||v===''?'—':v);root.innerHTML='<table class="evidence-table"><thead><tr><th>Time</th><th>Experiment</th><th>Variant</th><th>Outcome</th><th>Failure / check</th><th>Hider</th><th>Seeker</th><th>Expected</th><th>Decoded</th><th>Exact</th><th>Similarity</th><th>Duration</th><th>Tokens</th></tr></thead><tbody>'+rows.slice(0,100).map(e=>'<tr><td>'+c(new Date(e.timestamp).toLocaleString())+'</td><td>'+c(e.type)+'</td><td>'+c(e.variant)+'</td><td class="evidence-outcome-'+c(e.outcome)+'">'+c(e.outcome)+'</td><td>'+c(e.category)+'</td><td>'+c(e.hiderModel)+'</td><td>'+c(e.seekerModel)+'</td><td>'+c(e.expectedMessage)+'</td><td>'+c(e.decodedMessage)+'</td><td>'+c(e.exactMatch==null?'—':e.exactMatch?'Yes':'No')+'</td><td>'+c(e.similarity==null?'—':Math.round(e.similarity*100)+'%')+'</td><td>'+c(e.durationMs==null?'—':e.durationMs+' ms')+'</td><td>'+c(e.tokens)+'</td></tr>').join('')+'</tbody></table><p class="report-footnote">Showing '+Math.min(rows.length,100)+' of '+rows.length+' matching events.</p>'};
const downloadEvidence=format=>{const rows=filterEvidence(T.evidence||[],{type:$('#evidenceType').value,outcome:$('#evidenceOutcome').value,model:$('#evidenceModel').value,query:$('#evidenceSearch').value}),data=format==='csv'?evidenceToCSV(rows):JSON.stringify({schemaVersion:1,exportedAt:new Date().toISOString(),events:rows},null,2),blob=new Blob([data],{type:format==='csv'?'text/csv;charset=utf-8':'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='night-cipher-evidence-'+new Date().toISOString().slice(0,10)+'.'+format;a.click();URL.revokeObjectURL(url)};
const score=()=>{
 const hiderStats=Object.entries(T.hm||{}),seekerStats=Object.entries(T.sm||{}),matchStats=Object.entries(T.s||{}),qualityStats=Object.entries(T.qh||{}),stealthStats=Object.entries(T.sh||{}),robustStats=Object.entries(T.rb||{});
 const sum=(rows,key)=>rows.reduce((n,[,v])=>n+(Number(v[key])||0),0);
 const attempts=sum(seekerStats,'attempts'),exact=sum(seekerStats,'exact'),hiders=sum(hiderStats,'attempts'),rendered=sum(hiderStats,'rendered'),bests=Object.values(T.bestTimes||{}),levels=Object.values(T.levels||{}).filter(Boolean).length;
 const savedTokens=sum(hiderStats,'totalTokens')+sum(seekerStats,'totalTokens');
 const count=n=>Number(n)||0,rate=(n,d)=>d?Math.round(100*n/d)+'%':'Not tested',avg=(total,n,suffix)=>n&&total?Math.round(total/n).toLocaleString()+' '+suffix:'—';
 const table=(headers,rows,empty)=>rows.length?`<div class="report-table-wrap"><table class="report-table"><thead><tr>${headers.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`:`<p class="report-empty">${empty}</p>`;
 const row=cells=>`<tr>${cells.map((v,i)=>`<td${i?'':' class="report-primary"'}>${v}</td>`).join('')}</tr>`;
 const details=(title,description,content,open=false)=>`<details class="report-group"${open?' open':''}><summary><span>${title}</span><small>${description}</small></summary><div class="report-group-body">${content}</div></details>`;
 $('#researchStats').innerHTML=`<div class="research-metrics">
  <div><b>${count(T.n)}</b><small>AI duels</small></div><div><b>${hiders}</b><small>Hider runs</small></div>
  <div><b>${rate(exact,attempts)}</b><small>Seeker exact recovery</small></div><div><b>${hiders?rendered+'/'+hiders:'Not tested'}</b><small>Valid rendered SVGs</small></div>
  <div><b>${T.st?.n?(T.st.s/T.st.n).toFixed(1)+'/10':'Not tested'}</b><small>Mean stealth rating</small></div>
  <div><b>${levels}/${TRAIN.length}</b><small>Training levels completed</small></div><div><b>${bests.length?(Math.min(...bests)/1000).toFixed(1)+'s':'—'}</b><small>Best solve time</small></div>
  <div><b>${tok?tok.toLocaleString():'—'}</b><small>Session tokens · since page load</small></div><div><b>${savedTokens?savedTokens.toLocaleString():'—'}</b><small>Saved Hider + Seeker tokens</small></div>
 </div><p class="report-footnote">Session usage includes all calls since page load. Saved Hider and Seeker token totals persist locally in this browser; they are not account-wide.</p>`;
 const hiderRows=hiderStats.map(([model,v])=>row([esc(model),`${count(v.rendered)}/${count(v.attempts)}`,rate(count(v.primaryExact),count(v.primaryEvaluated)),rate(count(v.independentExact),count(v.independentEvaluated)),avg(v.totalTokens,count(v.attempts),'tokens'),avg(v.totalDurationMs,count(v.attempts),'ms')]));
 const seekerRows=seekerStats.map(([model,v])=>row([esc(model),`${count(v.exact)}/${count(v.attempts)}`,rate(count(v.exact),count(v.attempts)),count(v.failed).toLocaleString(),avg(v.totalTokens,count(v.attempts),'tokens'),avg(v.totalDurationMs,count(v.attempts),'ms')]));
 const modelContent=`<h4>Hider models</h4>${table(['Model','Valid SVGs','Primary exact','Independent exact','Avg tokens','Avg time'],hiderRows,'No Hider runs recorded yet.')}`+
  `<h4>Seeker models</h4>${table(['Model','Exact matches','Exact rate','Failed','Avg tokens','Avg time'],seekerRows,'No Seeker attempts recorded yet.')}`;
 const grouped=new Map();
 for(const [key,v] of matchStats){const parts=key.split(' → ');if(parts.length<2)continue;const hider=parts[0].replace(/^hider /,'').replace(/^your /,'User scheme · '),seeker=parts.slice(1).join(' → ').split(' · ')[0],id=hider+'||'+seeker,current=grouped.get(id)||{hider,seeker,n:0,ok:0};current.n+=count(v.n);current.ok+=count(v.ok);grouped.set(id,current)}
 const matchupRows=[...grouped.values()].map(v=>row([esc(v.hider),esc(v.seeker),`${v.ok}/${v.n}`,rate(v.ok,v.n)]));
 const qualityRows=qualityStats.map(([key,v])=>{const parts=key.split(' → '),models=(parts[1]||'').split(' + ');return row([esc(parts[0]||key),esc(models[0]||'—'),esc(models[1]||'—'),rate(count(v.bothExact),count(v.n)),rate(count(v.agreement),count(v.n)),count(v.n)])});
 const stealthRows=stealthStats.map(([model,v])=>row([esc(model),v.n?(v.s/v.n).toFixed(1)+'/10':'Not tested',count(v.n)]));
 const robustRows=robustStats.map(([key,v])=>{const cut=key.lastIndexOf(' · ');return row([esc(cut<0?key:key.slice(0,cut)),esc(cut<0?'—':key.slice(cut+3)),`${count(v.ok)}/${count(v.n)}`,rate(count(v.ok),count(v.n)),v.n?Math.round(100*v.sim/v.n)+'%':'Not tested'])});
 $('#report').innerHTML=[details('Model leaderboard','Hider and Seeker performance',modelContent,true),details('Matchups','Exact recovery by Hider → Seeker pair',table(['Hider model / scheme','Seeker model','Exact','Win rate'],matchupRows,'No matchup results recorded yet.')),details('Quality & independent validation','Agreement and dual-model exact recovery',table(['Hider','Primary Seeker','Independent Seeker','Both exact','Agreement','Runs'],qualityRows,'No independent validation runs recorded yet.')),details('Stealth ratings','Average visual innocuousness by model',table(['Hider model','Mean rating','Ratings'],stealthRows,'No stealth ratings recorded yet.')),details('Robustness','Recovery across PNG and JPEG variants',table(['Seeker model','Image variant','Recovered','Recovery rate','Mean similarity'],robustRows,'No robustness tests recorded yet.'))] .join('');
 renderEvidence();
};
const say=(m,c='')=>{const research=!$('#researchMode').hidden,s=$(research?'#researchStatus':'#status');s.textContent=m;s.className=c};
let diagnostics=null;
const modelStat=(bucket,model)=>{T[bucket]=T[bucket]||{};return T[bucket][model]=T[bucket][model]||{attempts:0,exact:0,failed:0,totalSimilarity:0,totalDurationMs:0,totalTokens:0}};
const recordHiderOutcome=success=>{
  const h=diagnostics?.hider;if(!h||h.statsRecorded)return;
  T.hm=T.hm||{};const s=T.hm[h.model]=T.hm[h.model]||{attempts:0,validSvg:0,rendered:0,schemePresent:0,failed:0,primaryEvaluated:0,primaryExact:0,independentEvaluated:0,independentExact:0,totalDurationMs:0,totalTokens:0};
  s.attempts++;if(h.validation?.svgValid===true)s.validSvg++;if(h.validation?.renderValid===true)s.rendered++;if(h.validation?.schemePresent===true)s.schemePresent++;if(!success)s.failed++;
  s.totalDurationMs+=h.durationMs||0;s.totalTokens+=h.usage?.total_tokens||h.totalTokens||h.completionTokens||0;
  h.statsRecorded=true;const hv=h.validation||{},failureText=(hv.errors||[]).join(' ')+' '+(diagnostics?.errors||[]).join(' '),category=success?'valid_hider_output':!hv.svgValid?'invalid_or_missing_svg':!hv.renderValid?'png_rasterization_failed':!hv.schemePresent?'missing_scheme':/secret|leak/i.test(failureText)?'secret_leak':'hider_generation_error';recordEvidence({type:'hider',outcome:success?'success':'failure',category,hiderModel:h.model,expectedMessage:diagnostics?.encoding?.expectedMessage||null,svgValid:hv.svgValid,renderValid:hv.renderValid,schemePresent:hv.schemePresent,durationMs:h.durationMs,tokens:h.usage?.total_tokens||h.totalTokens||h.completionTokens||null,error:success?null:failureText.trim()});save();score();
};
const recordSeekerOutcome=(record,role='primary')=>{
  if(!record||record.statsRecorded)return;
  const s=modelStat('sm',record.model);s.attempts++;
  if(record.status==='completed'){if(record.exactMatch)s.exact++;s.totalSimilarity+=record.similarity||0;}
  else s.failed++;
  s.totalTokens+=record.usage?.total_tokens||record.tokens||0;
  s.totalDurationMs+=record.durationMs||0;
  record.statsRecorded=true;const failed=record.status!=='completed',roleType=role==='independent'?'independent':'primary',failureCategory=failed?(record.blindAudit?.verified===false?'blind_payload_audit_failed':/MESSAGE line|parse|valid MESSAGE/i.test(record.failureReason||record.error||'')?'seeker_response_parse_error':'seeker_request_error'):(record.exactMatch?'exact_recovery':'message_mismatch');recordEvidence({type:roleType,outcome:!failed&&record.exactMatch?'success':'failure',category:failureCategory,hiderModel:diagnostics?.hider?.model||null,seekerModel:record.model||null,scheme:diagnostics?.encoding?.method||null,expectedMessage:diagnostics?.encoding?.expectedMessage||null,decodedMessage:record.decodedMessage||null,exactMatch:record.exactMatch??null,similarity:record.similarity??null,durationMs:record.durationMs??null,tokens:record.usage?.total_tokens||record.tokens||null,blindAuditVerified:record.blindAudit?.verified??null,error:failed?(record.failureReason||record.error||null):null});
  const hs=diagnostics?.hider?.model&&T.hm?.[diagnostics.hider.model];
  if(hs&&role==='primary'&&record.status==='completed'){hs.primaryEvaluated++;if(record.exactMatch===true)hs.primaryExact++;}
  if(hs&&role==='independent'&&record.status==='completed'){hs.independentEvaluated++;if(record.exactMatch===true)hs.independentExact++;}
  save();score();
};
const renderDiagnostics=()=>{
  const root=$('#diagnosticsContent');if(!root)return;
  if(!diagnostics){root.innerHTML='<small>No AI output captured yet. Start an AI vs AI Duel to inspect the Hider and Seeker responses.</small>';return}
  const d=diagnostics,h=d.hider||{},q=d.seeker||{},v=h.validation||{};
  const report=JSON.stringify({schemaVersion:2,roundId:d.roundId,timestamp:d.timestamp,expectedMessage:d.encoding?.expectedMessage,encoding:d.encoding,image:d.image||null,
    hider:{model:h.model,responseModel:h.responseModel,finishReason:h.finishReason,usage:h.usage||null,completionTokens:h.completionTokens,promptTokens:h.promptTokens,totalTokens:h.totalTokens,prompt:h.prompt,rawResponse:h.rawResponse,svg:h.svg,durationMs:h.durationMs,validation:v},
    seeker:q?{...q}:null,primarySeeker:q?{...q}:null,
    result:d.result||{status:'not_run',success:null,exactMatch:null,similarity:null},
    independentSeeker:d.independentSeeker||{status:'not_run',model:null,exactMatch:null},
    quality:d.quality||{complete:false,agreement:null,bothExact:null,primaryExact:d.result?.exactMatch??null,independentExact:null},
    modelStats:{hider:T.hm?.[h.model]||null,primarySeeker:T.sm?.[q.model]||null,independentSeeker:T.sm?.[d.independentSeeker?.model]||null},errors:d.errors||[]},null,2);
  root.innerHTML=`<div class="diag-summary">
    <div><b>Encoding</b><small>${esc(d.encoding?.method||'—')} · ${esc(d.encoding?.scene||'—')}</small></div>
    <div><b>Hider</b><small>${esc(h.model||'—')} · ${h.durationMs==null?'pending':h.durationMs+' ms'}</small></div>
    <div><b>Seeker</b><small>${esc(q.model||'—')} · ${q.durationMs==null?'not run':q.durationMs+' ms'}</small></div>
    <div><b>SVG / XML</b><small class="${v.svgValid===true?'ok':v.svgValid===false?'bad':''}">${v.svgValid===true?'Valid':v.svgValid===false?'Invalid':'Not checked'}</small></div>
    <div><b>PNG rasterization</b><small class="${v.renderValid===true?'ok':v.renderValid===false?'bad':''}">${v.renderValid===true?'Valid':v.renderValid===false?'Failed':'Not checked'}</small></div>
    <div><b>SCHEME</b><small class="${v.schemePresent===true?'ok':v.schemePresent===false?'bad':''}">${v.schemePresent===true?'Present':v.schemePresent===false?'Missing':'Not checked'}</small></div>
    <div><b>Encoding fidelity</b><small>Measured end-to-end by blind exact recovery; internal consistency is not independently proven.</small></div>
    <div><b>Independent Seeker</b><small>${d.independentSeeker?.status==='completed'?`${esc(d.independentSeeker.model)} · ${d.independentSeeker.exactMatch?'Exact recovery':'Missed'} · ${d.independentSeeker.durationMs??'—'} ms`:d.independentSeeker?.status==='error'?'Request failed':d.independentSeeker?.status==='running'?'Running':'Not tested'}</small></div>
    <div><b>Primary exact recovery</b><small class="${d.result?.exactMatch===true?'ok':d.result?.exactMatch===false?'bad':''}">${d.result?.status==='completed'?(d.result.exactMatch?'Exact match':'Mismatch'):d.result?.status==='error'?'Request / parse error':'Not run'}</small></div>
    <div><b>Independent agreement</b><small>${d.quality?.agreement==null?'Not measurable':d.quality.agreement?'Agrees':'Disagrees'} · both exact: ${d.quality?.bothExact==null?'—':d.quality.bothExact?'Yes':'No'}</small></div>
  </div>
  <div class="diag-actions"><button type="button" id="copyDiagnostics">Copy diagnostic JSON</button></div>
  <details><summary>Hider raw SVG</summary><pre>${esc(h.svg||'No validated SVG captured.')}</pre></details>
  <details><summary>Hider raw response</summary><pre>${esc(h.rawResponse||'No response captured.')}</pre></details>
  <details><summary>Hider prompt</summary><pre>${esc(h.prompt||'No prompt captured.')}</pre></details>
  <details><summary>Hider validation &amp; image metadata</summary><pre>${esc(JSON.stringify({validation:v,image:d.image||null},null,2))}</pre></details>
  <details><summary>Primary Seeker request audit &amp; usage</summary><pre>${esc(JSON.stringify({status:q.status||'not_run',blindAudit:q.blindAudit||null,imageReceived:q.imageReceived??null,requestedModel:q.model||null,responseModel:q.responseModel||null,finishReason:q.finishReason||null,usage:q.usage||null,failureReason:q.failureReason||q.error||null},null,2))}</pre></details>
  <details><summary>Seeker raw response</summary><pre>${esc(q.rawResponse||'Seeker has not run yet.')}</pre></details>
  <details><summary>Seeker prompt</summary><pre>${esc(q.prompt||'Seeker has not run yet.')}</pre></details>
  <details><summary>Independent Seeker request audit &amp; usage</summary><pre>${esc(JSON.stringify({status:d.independentSeeker?.status||'not_run',blindAudit:d.independentSeeker?.blindAudit||null,imageReceived:d.independentSeeker?.imageReceived??null,requestedModel:d.independentSeeker?.model||null,responseModel:d.independentSeeker?.responseModel||null,finishReason:d.independentSeeker?.finishReason||null,usage:d.independentSeeker?.usage||null,failureReason:d.independentSeeker?.failureReason||d.independentSeeker?.error||null},null,2))}</pre></details>
  <details><summary>Independent Seeker raw response</summary><pre>${esc(d.independentSeeker?.rawResponse||'Independent Seeker has not run yet.')}</pre></details>
  <details><summary>Independent Seeker prompt</summary><pre>${esc(d.independentSeeker?.prompt||'Independent Seeker has not run yet.')}</pre></details>
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
function renderHintLabel(){const total=R?.hints?.length||0;$('#hint').textContent=total?`Hint (${R.used}/${total} · −20)`:'Hint (−20)';}
function syncButtons(){
  renderTries();renderHintLabel();
  ['#go','#giveup','#hint','#ai','#next','#independent','#robustness','#degradationRun'].forEach(sel=>{const button=$(sel);if(button)button.disabled=uiBusy});
  $('#after').hidden=!(R&&(R.done||R.mode==='duel'));
  const researchRound=!!(R&&(R.mode==='duel'||R.mode==='own')&&R.svg);
  $('#independent').hidden=!(researchRound&&R.mode==='duel');
  $('#robustness').hidden=!researchRound;
  $('#independent').disabled=uiBusy||diagnostics?.independentSeeker?.status==='completed';$('#robustness').disabled=uiBusy||!R||!R.svg;
  if($('#degradationRun'))$('#degradationRun').disabled=uiBusy||!R||!R.svg||!['duel','own'].includes(R.mode);
  if(!uiBusy&&R){
    $('#go').disabled=R.done;$('#giveup').disabled=R.done;
    $('#hint').disabled=R.done||R.used>=R.hints.length;
    $('#ai').disabled=(R.done&&R.mode!=='own'&&aiAttempted)||aiInFlight||aiAttempted;$('#ai').textContent=R.mode==='duel'?(R.aiHistory?.length?'Retry AI Seeker 💰':'Challenge AI Seeker 💰'):(aiAttempted?'AI answer locked':(R.aiHistory?.length?'Try another model 💰':'Let the AI try 💰'));
    $('#next').disabled=R.mode==='duel'?!R.ai:!R.done;
  }else if(!uiBusy){
    $('#go').disabled=true;$('#giveup').disabled=true;$('#hint').disabled=true;$('#ai').disabled=true;$('#next').disabled=true;
  }
}
function busy(b,m){uiBusy=!!b;syncButtons();if(m)say(m)}
function start(r){R=Object.assign({tries:0,used:0,done:false,ai:null,maxTries:3,noHints:false},r);if(R.diagnostics)diagnostics=R.diagnostics;renderDiagnostics();R.startedAt=performance.now();aiInFlight=false;aiAttempted=false;$('#roundModelPicker').hidden=true;$('#imgbox').innerHTML=`<img alt="Puzzle picture" src="${uri(R.svg)}">`;$('#res').innerHTML='';$('#robustnessReport').innerHTML='';$('#hints').innerHTML='';$('#guess').value='';$('#game').hidden=false;const hiderDuel=R.mode==='duel';$('#game').classList.toggle('hider-duel',hiderDuel);$('#duelRoles').hidden=!hiderDuel;$('#guess').hidden=hiderDuel;$('#guess').previousElementSibling.hidden=hiderDuel;$('#go').parentElement.hidden=hiderDuel;$('#hints').hidden=hiderDuel;$('#giveup').hidden=hiderDuel;$('#next').hidden=true;$('#next').textContent=hiderDuel?'New Duel':'Next ▶';$('#hint').hidden=hiderDuel||!!R.noHints;$('#hint').disabled=hiderDuel||!!R.noHints;$('#ai').hidden=false;$('#revealHow').hidden=hiderDuel;$('#revealHow').textContent='✨ How was it hidden?';syncButtons();say(hiderDuel?'AI Hider has hidden your chosen message. Now watch the AI Seeker try to decode it.':'Find the hidden message. '+R.maxTries+' tries.');if(!hiderDuel)$('#guess').focus()}
function finish(ok){
 if(!R||R.done)return;R.done=true;R.elapsedMs=Math.max(0,performance.now()-(R.startedAt||performance.now()));syncButtons();
 if(ok&&(R.mode==='train'||R.mode==='daily')){const k=R.mode==='daily'?`daily-${R.day}`:`training-${R.schemeIdx}`;T.bestTimes=T.bestTimes||{};if(!T.bestTimes[k]||R.elapsedMs<T.bestTimes[k])T.bestTimes[k]=R.elapsedMs;if(R.mode==='train'){T.levels=T.levels||{};T.levels[R.schemeIdx]=true;const tb=[...$('#tabs').children].find(x=>x.dataset.kind==='training'&&x.textContent.includes(`Level ${R.schemeIdx+1}`));if(tb)tb.textContent=`🎓 Level ${R.schemeIdx+1} ✓`;}else{T.dailyWins=T.dailyWins||[];if(!T.dailyWins.includes(R.day))T.dailyWins.push(R.day);}}
 const pts=ok?Math.max(10,100-20*R.used-15*(R.tries-1)):0;$('#res').innerHTML=`<b class="${ok?'ok':'bad'}">${ok?'Found it! +'+pts+' points':'Out of tries.'}</b> The message was “${esc(R.secret)}”.<br><small>How it was hidden: ${esc(R.scheme||'unknown')}</small>`+(ok&&(R.mode==='train'||R.mode==='daily')?`<br><small>Time: ${(R.elapsedMs/1000).toFixed(1)} seconds</small>`:'')+stealthLine()+(R.ai?aiLine():'');
 if(R.mode==='duel'){T.n++;if(ok)T.you++;save();score()}if(R.mode==='daily'){$('#res').innerHTML+='<p><button id="sh">Copy result</button></p>';$('#sh').onclick=()=>{navigator.clipboard.writeText(`Night Cipher #${R.day-20000} ${ok?'✅':'❌'} ${R.tries}/${R.maxTries} tries · ${R.used} hints\n${location.href}`);say('Result copied!')}}save();score();$('#next').hidden=false;say(ok?'Cipher solved. Progress saved locally.':'Round finished.');
}
const aiLine=()=>`<p>🤖 AI seeker said: “${esc(R.ai.guess)}” — <b class="${R.ai.ok?'ok':'bad'}">${R.ai.ok?'it found it':'it missed it'}</b> (${Math.round(R.ai.s*100)}% similar).<br><small>Model: ${esc(R.ai.model||'unknown')}${R.ai.requestedModel&&R.ai.requestedModel!==R.ai.model?` (requested: ${esc(R.ai.requestedModel)})`:''} · ${R.ai.durationMs??'—'} ms · ${R.ai.tokens??'—'} tokens · ${R.ai.estimatedPollen==null?'Pollen estimate unavailable':esc(formatPollenCost(R.ai.estimatedPollen))}<br>Its method: ${esc(R.ai.method)}${R.method?`<br>Method fixed by the game: ${esc(R.methodLabel)} · Scene: ${esc(R.scene)}`:''}</small></p>`;
$('#go').onclick=()=>{if(!R||R.done)return;const g=$('#guess').value.trim();if(!g)return;R.tries++;renderTries();const s=sim(g,R.secret);
if(s>=.9)finish(true);else if(R.tries>=R.maxTries)finish(false);else say(`Not quite (${Math.round(s*100)}% similar). ${R.maxTries-R.tries} tries left.`,'bad')};
$('#guess').onkeydown=e=>{if(e.key=='Enter')$('#go').click()};
$('#hint').onclick=()=>{if(!R||R.done||R.used>=R.hints.length)return;$('#hints').innerHTML+=`<li>${esc(R.hints[R.used++])}</li>`;renderHintLabel();if(R.used>=R.hints.length)$('#hint').disabled=true};
$('#giveup').onclick=()=>{if(R&&!R.done)finish(false)};
const stealthLine=()=>R&&R.stealth?`<p>🕵️ <b>Stealth ${R.stealth}/10</b> — ${esc(R.stealthNote||'')}</p>`:'';
const JUDGE='Study this picture carefully. It may or may not hide a secret message encoded somewhere in its visual structure. Rate how INNOCENT it looks to a casual viewer: 10 = completely ordinary, nothing seems off; 1 = obviously suspicious or unnatural. Then give one short sentence of justification.\nReply with exactly two lines:\nSTEALTH: <integer 1-10>\nNOTE: <one sentence>';
async function judgeStealth(r){const key=conn&&conn.apiKey;if(!key)return null;try{const round=r,png=await toPng(round.svg),out=await chat($('#judgeModel').value,[{role:'user',content:[{type:'text',text:JUDGE},{type:'image_url',image_url:{url:png}}]}],1000,60000);if(round!==R)return null;const s=Math.max(1,Math.min(10,parseInt((out.match(/STEALTH:\s*(\d+)/i)||[,'5'])[1])||5)),note=(out.match(/NOTE:\s*(.*)/i)||[,''])[1].trim();round.stealth=s;round.stealthNote=note;T.st=T.st||{s:0,n:0};T.st.s+=s;T.st.n++;const hn=round.hider;if(hn){T.sh=T.sh||{};const e=T.sh[hn]=T.sh[hn]||{s:0,n:0};e.s+=s;e.n++}save();score();if(round===R&&round.done)$('#res').innerHTML+=stealthLine();return{s,note}}catch(e){if(r===R&&!R.done)say(e.message,'bad');return null}}

$('#revealHow').onclick=()=>{
  const round=R;if(!round)return;
  if(round.schemeIdx!=null){
    $('#imgbox').innerHTML=`<img class="revealed" alt="Revealed encoding" src="${uri(annotate(round.svg,round.schemeIdx))}">`;
    say('The encoding, laid bare — every letter exactly where it hid.');
  }else{
    $('#imgbox').innerHTML=`<img alt="Puzzle picture" src="${uri(round.svg)}">`;
    $('#res').innerHTML+=`<p><b>Hider's private explanation:</b> ${esc(round.scheme||'No explanation was returned.')}</p>`;
    say('The Hider’s private explanation is now revealed. No extra AI call was needed.');
  }
};
$('#save').onclick=async()=>{if(!R)return;const a=document.createElement('a');a.href=R.png||await toPng(R.svg);a.download='night-cipher.png';a.click()};
$('#saveSvg').onclick=()=>{
  if(!R||!R.svg)return;
  const svg=R.mode==='duel'?R.svg:R.svg.replace(/\sdata-cipher="[^"]*"/g,'');
  const blob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  const tag=R.mode==='train'?`level-${String((R.schemeIdx??0)+1).padStart(2,'0')}`
    :R.mode==='daily'?`daily-${R.day}`
    :R.mode==='duel'?'duel'
    :'own';
  a.download=`night-cipher-${tag}.svg`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  say(R.mode==='duel'?'SVG saved (sanitized AI output).':'SVG saved (internal encoding metadata removed).');
};
function openRoundModelPicker(round){
  if(!round||!['daily','train'].includes(round.mode))return;
  $('#roundSeeker').value=round.selectedSeekerModel||$('#seeker').value;
  updateModelMeta('#roundSeeker','#roundSeekerMeta',true);
  $('#roundModelPicker').hidden=false;
  say('Choose the vision model for this attempt. No AI request has been sent yet.');
}
$('#runSelectedSeeker').onclick=()=>{
  if(!R||!['daily','train'].includes(R.mode)||aiInFlight)return;
  R.selectedSeekerModel=$('#roundSeeker').value;
  R.selectedModelConfirmed=true;
  $('#roundModelPicker').hidden=true;
  $('#ai').click();
};
$('#cancelModelChoice').onclick=()=>{$('#roundModelPicker').hidden=true;say('Model selection cancelled. No AI request was sent.')};
$('#ai').onclick=async()=>{
  const round=R;if(!round||(round.done&&round.mode!=='own'&&aiAttempted)||aiInFlight||aiAttempted)return;
  if(['daily','train'].includes(round.mode)&&!round.selectedModelConfirmed){openRoundModelPicker(round);return}
  aiInFlight=true;aiAttempted=true;const attemptStarted=Date.now(),tokensBefore=tok,model=round.selectedSeekerModel||$(round.mode=='own'?'#seeker2':'#seeker').value;busy(true,'The AI seeker is studying the picture…');
  try{
    const seekerPrompt=buildSeekPrompt(round,{retry:!!round.aiHistory?.length}),seekerStarted=Date.now(),png=round.png||await toPng(round.svg);
    const messages=[{role:'user',content:[{type:'text',text:seekerPrompt},{type:'image_url',image_url:{url:png}}]}];
    const blindAudit=auditBlindRequest({prompt:messages[0].content.find(part=>part.type==='text')?.text,secret:round.secret,scheme:round.scheme,imageAttached:messages.some(message=>message.content?.some(part=>part.type==='image_url'&&!!part.image_url?.url)),schemeExpected:round.mode!=='duel'});
    if(diagnostics){diagnostics.seeker={status:'running',model,startedAt:seekerStarted,prompt:seekerPrompt,blindAudit,imageReceived:blindAudit.imageAttached,rawResponse:'',decodedMessage:'',durationMs:null,tokens:null,usage:null};diagnostics.result={status:'running',success:null,exactMatch:null,similarity:null};diagnostics.independentSeeker={status:'not_run',model:null,exactMatch:null};diagnostics.quality={complete:false,agreement:null,bothExact:null,primaryExact:null,independentExact:null};renderDiagnostics()}
    if(!blindAudit.verified)throw Error('Blind Seeker payload audit failed: secret, SCHEME, or image isolation check did not pass.');
    let responseMeta=null;
    const out=await chat(model,messages,4000,90000,{onRawResponse:meta=>{responseMeta=meta;meta.estimatedPollen=estimatePollenCost(getModelMetadata(modelCatalog,meta.model),meta.usage);if(diagnostics?.seeker){Object.assign(diagnostics.seeker,{responseModel:meta.model,estimatedPollen:meta.estimatedPollen,finishReason:meta.finishReason,usage:meta.usage||null,promptTokens:meta.promptTokens??null,completionTokens:meta.completionTokens??null,totalTokens:meta.totalTokens??null})}}});
    if(round!==R)return;
    const parsed=parseSeekerResponse(out),g=parsed.message,mt=parsed.method,s=simMessage(g,round.secret),exact=normalizeMessage(g)===normalizeMessage(round.secret),elapsed=Date.now()-seekerStarted;
    if(diagnostics){Object.assign(diagnostics.seeker,{status:'completed',responseModel:responseMeta?.model||model,finishReason:responseMeta?.finishReason||null,usage:responseMeta?.usage||null,promptTokens:responseMeta?.promptTokens??null,completionTokens:responseMeta?.completionTokens??null,totalTokens:responseMeta?.totalTokens??null,rawResponse:out,durationMs:elapsed,tokens:tok-tokensBefore,decodedMessage:g,method:mt,exactMatch:exact,similarity:s});diagnostics.result={status:'completed',success:exact,exactMatch:exact,similarity:s};recordSeekerOutcome(diagnostics.seeker,'primary');renderDiagnostics()}
    round.ai={guess:g,method:mt,s,ok:round.mode==='duel'?exact:s>=.9,model:responseMeta?.model||model,requestedModel:model,estimatedPollen:responseMeta?.estimatedPollen??null,durationMs:Date.now()-attemptStarted,tokens:tok-tokensBefore};if(round.mode==='duel')$('#revealHow').hidden=false;round.aiHistory=round.aiHistory||[];round.aiHistory.push({...round.ai,at:Date.now()});
    if(round.mode=='duel'||round.mode=='own'){T.an++;if(round.ai.ok)T.ai++;const k=(round.mode=='own'?'your '+round.sname:'hider '+round.hider)+' → '+$(round.mode=='own'?'#seeker2':'#seeker').value+(round.method?' · '+round.method:''),v=(T.s=T.s||{})[k]=T.s[k]||{n:0,ok:0};v.n++;if(round.ai.ok)v.ok++;save();score()}
    if(round.mode==='duel'){$('#res').innerHTML=aiLine();$('#next').hidden=false;if(round.ai.ok){aiAttempted=true;say('AI Seeker decoded the message chosen for this duel.','ok')}else{aiAttempted=false;say(g.toUpperCase()==='NONE'?'AI Seeker could not produce a defensible decoding. You can retry or change the model.':'AI Seeker failed to recover the message. You can retry or change the model.','bad')}}else if(g.toUpperCase()==='NONE'||s<.9){aiAttempted=false;if(round.done)$('#res').innerHTML=$('#res').innerHTML.split('<p>🤖 AI seeker said:')[0]+aiLine();say(g.toUpperCase()==='NONE'?'The AI found no defensible decoding. Retry or choose another vision model.':'The AI returned an incorrect answer. Retry or choose another vision model.','bad')}else if(round.done){$('#res').innerHTML=$('#res').innerHTML.split('<p>🤖 AI seeker said:')[0]+aiLine();say('The AI recovered the message.')}else say('The AI has locked in an answer. Finish your round to see it.');
  }catch(e){if(round===R){if(diagnostics){diagnostics.errors.push(e.message);if(diagnostics.seeker?.status==='running'){diagnostics.seeker.status='error';diagnostics.seeker.failureReason=e.message;diagnostics.seeker.error=e.message;diagnostics.seeker.durationMs=Date.now()-(diagnostics.seeker.startedAt||attemptStarted);diagnostics.seeker.tokens=tok-tokensBefore;recordSeekerOutcome(diagnostics.seeker,'primary');diagnostics.result={status:'error',success:false,exactMatch:null,similarity:null,failureReason:e.message}}renderDiagnostics()}aiAttempted=false;say(e.message,'bad')}}
  finally{aiInFlight=false;if(round===R&&['daily','train'].includes(round.mode)){aiAttempted=false;round.selectedModelConfirmed=false}busy(false)}
};
/* ---------- independent blind Seeker validation ---------- */
let independentInFlight=false;
$('#independent').onclick=async()=>{
  const round=R;
  if(!round||round.mode!=='duel'||independentInFlight||aiInFlight)return;
  if(diagnostics?.result?.status!=='completed')return say('Run the primary Seeker first so the independent result can be compared against it.','bad');
  if(!conn||!conn.apiKey)return say('Connect your Pollinations account first. This test makes one additional paid vision request.','bad');
  const model=$('#seekerAudit').value,primaryModel=diagnostics?.seeker?.model||$('#seeker').value;
  if(!model)return say('Select an independent vision-capable model first.','bad');
  if(model===primaryModel)return say('Choose a different model from the primary Seeker. Independent validation requires a second model.','bad');
  if(diagnostics?.independentSeeker?.status==='completed')return say('An independent Seeker result is already recorded for this round.','bad');
  independentInFlight=true;
  const started=Date.now(),before=tok;let prompt,png;
  try{prompt=diagnostics.seeker?.prompt||buildSeekPrompt(round);png=round.png||await toPng(round.svg)}
  catch(e){independentInFlight=false;return say('Could not prepare the image for the independent Seeker: '+e.message,'bad')}
  const messages=[{role:'user',content:[{type:'text',text:prompt},{type:'image_url',image_url:{url:png}}]}];
  const blindAudit=auditBlindRequest({prompt:messages[0].content.find(part=>part.type==='text')?.text,secret:round.secret,scheme:round.scheme,imageAttached:messages.some(message=>message.content?.some(part=>part.type==='image_url'&&!!part.image_url?.url))});
  const record={status:'running',model,prompt,blindAudit,imageReceived:blindAudit.imageAttached,rawResponse:'',decodedMessage:'',method:'',durationMs:null,tokens:null,exactMatch:null,similarity:null,usage:null};
  if(diagnostics){diagnostics.independentSeeker=record;renderDiagnostics()}
  busy(true,'A second, independent Seeker is analyzing the same image without hints…');
  try{
    if(!blindAudit.verified)throw Error('Independent blind Seeker payload audit failed.');
    let responseMeta=null;
    const out=await chat(model,messages,4000,90000,{onRawResponse:meta=>{responseMeta=meta;Object.assign(record,{responseModel:meta.model,finishReason:meta.finishReason,usage:meta.usage||null,promptTokens:meta.promptTokens??null,completionTokens:meta.completionTokens??null,totalTokens:meta.totalTokens??null})}});
    if(round!==R)return;
    const parsed=parseSeekerResponse(out),g=parsed.message,s=simMessage(g,round.secret),exact=normalizeMessage(g)===normalizeMessage(round.secret);
    Object.assign(record,{status:'completed',responseModel:responseMeta?.model||model,finishReason:responseMeta?.finishReason||null,usage:responseMeta?.usage||null,promptTokens:responseMeta?.promptTokens??null,completionTokens:responseMeta?.completionTokens??null,totalTokens:responseMeta?.totalTokens??null,rawResponse:out,decodedMessage:g,method:parsed.method,durationMs:Date.now()-started,tokens:tok-before,exactMatch:exact,similarity:s,normalized:normalizeMessage(g)});
    recordSeekerOutcome(record,'independent');
    const primary=diagnostics?.result?{normalized:normalizeMessage(diagnostics.seeker?.decodedMessage||''),exactMatch:diagnostics.result.exactMatch}:null;
    const comparison=compareSeekers(primary,record);
    diagnostics.quality=comparison;
    const key=round.hider+' → '+primaryModel+' + '+model;
    T.qh=T.qh||{};const stats=T.qh[key]=T.qh[key]||{n:0,primaryExact:0,independentExact:0,bothExact:0,agreement:0};
    stats.n++;if(comparison.primaryExact)stats.primaryExact++;if(comparison.independentExact)stats.independentExact++;if(comparison.bothExact)stats.bothExact++;if(comparison.agreement)stats.agreement++;
    save();score();renderDiagnostics();
    $('#robustnessReport').innerHTML='<section class="card" style="margin-top:10px;padding:10px"><b>Independent blind validation</b><p>Primary: <b class="'+(comparison.primaryExact?'ok':'bad')+'">'+(comparison.primaryExact?'Exact':'Missed')+'</b> · '+esc(primaryModel)+'</p><p>Independent: <b class="'+(exact?'ok':'bad')+'">'+(exact?'Exact':'Missed')+'</b> · '+esc(model)+' · '+Math.round(s*100)+'% similarity</p><p>Model agreement: <b>'+(comparison.agreement?'Yes':'No')+'</b> · Both exact: <b>'+(comparison.bothExact?'Yes':'No')+'</b></p><small>'+record.durationMs+' ms · '+record.tokens+' tokens. The second model received only the blind prompt and rasterized image.</small></section>';
    say(exact&&comparison.primaryExact?'Both independent Seekers recovered the exact message.':exact?'The independent Seeker recovered the message; the primary Seeker did not.':'The independent Seeker did not recover the exact message.',exact&&comparison.primaryExact?'ok':'bad');
    $('#independent').textContent='Independent Seeker complete';
  }catch(e){if(round===R){record.status='error';record.error=e.message;record.failureReason=e.message;record.durationMs=Date.now()-started;record.tokens=tok-before;recordSeekerOutcome(record,'independent');if(diagnostics){diagnostics.errors.push('Independent Seeker: '+e.message);renderDiagnostics()}say(e.message,'bad')}}
  finally{independentInFlight=false;busy(false);$('#independent').disabled=diagnostics?.independentSeeker?.status==='completed'}
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
    for(const row of rows){if(row.s==null){recordEvidence({type:'robustness',outcome:'failure',category:'image_variant_request_error',hiderModel:diagnostics?.hider?.model||null,seekerModel:model,expectedMessage:round.secret,variant:row.id,tokens:row.tokens??null,error:row.error||'No similarity score returned'});continue}const key=model+' · '+row.id,v=T.rb[key]=T.rb[key]||{n:0,ok:0,sim:0};v.n++;v.sim+=row.s;if(row.ok)v.ok++;recordEvidence({type:'robustness',outcome:row.ok?'success':'failure',category:row.ok?'image_variant_recovered':'image_variant_mismatch',hiderModel:diagnostics?.hider?.model||null,seekerModel:model,expectedMessage:round.secret,decodedMessage:row.guess||null,exactMatch:normalizeMessage(row.guess||'')===normalizeMessage(round.secret),similarity:row.s,variant:row.id,tokens:row.tokens??null,error:row.error||null})}
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
    const dl=T.duelLog=T.duelLog||{n:0};
    const hiderModel=$('#hider').value,hiderPrompt=HIDE(secret,$('#diff').value=='1'),hiderStarted=Date.now();
    diagnostics={schemaVersion:2,roundId:(globalThis.crypto?.randomUUID?.()||String(hiderStarted)),timestamp:new Date().toISOString(),encoding:{method:'AI-selected organic visual encoding',label:'Model-authored',scene:'Model-selected natural scene',expectedMessage:secret},image:null,hider:{model:hiderModel,startedAt:hiderStarted,prompt:hiderPrompt,rawResponse:'',svg:'',durationMs:null,usage:null,validation:{xmlValid:null,svgValid:null,renderValid:null,schemePresent:null,encodingValid:null,schemeConsistency:null,errors:[]}},seeker:null,result:{status:'not_run',success:null,exactMatch:null,similarity:null},independentSeeker:{status:'not_run',model:null,exactMatch:null},quality:{complete:false,agreement:null,bothExact:null,primaryExact:null,independentExact:null},errors:[]};
    renderDiagnostics();
    const out=await chat(hiderModel,[{role:'system',content:'You are a creative SVG artist and steganographer. Output only what is asked.'},{role:'user',content:hiderPrompt}],16000,120000,{requestType:'hider',onRawResponse:meta=>{diagnostics.hider.rawResponse=meta.text;diagnostics.hider.responseModel=meta.model;diagnostics.hider.finishReason=meta.finishReason;diagnostics.hider.usage=meta.usage||null;diagnostics.hider.promptTokens=meta.promptTokens??null;diagnostics.hider.completionTokens=meta.completionTokens;diagnostics.hider.totalTokens=meta.totalTokens??null;diagnostics.hider.durationMs=Date.now()-hiderStarted;renderDiagnostics()}});
    diagnostics.hider.rawResponse=out;diagnostics.hider.durationMs=Date.now()-hiderStarted;renderDiagnostics();
    const m=out.match(/<svg[\s\S]*?<\/svg>/i);if(!m){diagnostics.hider.validation.errors.push('No complete SVG found in Hider response.');throw Error('No complete SVG came back (the model may have run out of tokens). Try again or use another model.')}
    let safe;try{safe=clean(m[0]);diagnostics.hider.validation.xmlValid=true;diagnostics.hider.validation.svgValid=true;diagnostics.hider.svg=safe}catch(e){diagnostics.hider.validation.xmlValid=false;diagnostics.hider.validation.svgValid=false;diagnostics.hider.validation.errors.push(e.message);throw e}
    renderDiagnostics();
    if(/<(?:text|tspan)\b/i.test(safe)){diagnostics.hider.validation.errors.push('Readable text elements are not allowed in the hidden artwork.');throw Error('The Hider added readable text or labels to the artwork. The image must communicate through visual details only; try again.')}
    if(secret.includes(' ')&&hasSecretLeak(safe,secret,{strictWords:false})){diagnostics.hider.validation.errors.push('The complete secret message was detected in SVG content.');throw Error('The Hider leaked the complete secret message in the SVG, so the round was voided. Try again.')}
    const sc=(out.split(/SCHEME:/i)[1]||'').trim().slice(0,400),words=secret.split(/\s+/).length;
    diagnostics.hider.validation.schemePresent=!!sc;
    if(!sc){diagnostics.hider.validation.errors.push('Missing SCHEME explanation.');throw Error('The hider did not provide a SCHEME explanation. Try again.')}
    let png;try{png=await toPng(safe);diagnostics.hider.validation.renderValid=true;const vb=(safe.match(/viewBox=["']([^"']+)["']/i)||[])[1]?.trim().split(/[ ,]+/).map(Number)||[0,0,800,500];const b64=png.slice(png.indexOf(',')+1);diagnostics.image={mime:'image/png',width:1024,height:Math.round(1024*vb[3]/vb[2]),byteLength:Math.max(0,Math.floor(b64.length*3/4)-(b64.endsWith('==')?2:b64.endsWith('=')?1:0)),rasterized:true};}catch(e){diagnostics.hider.validation.renderValid=false;diagnostics.hider.validation.errors.push('PNG rasterization failed: '+e.message);throw e}
    diagnostics.hider.durationMs=Date.now()-hiderStarted;recordHiderOutcome(true);
    start({mode:'duel',schemeIdx:null,hider:hiderModel,secret,svg:safe,png,scheme:sc,method:null,methodLabel:null,scene:null,diagnostics,hints:[ns.length+' letters in '+words+' words.','It starts with “'+[...secret][0]+'”.','The hider confessed: '+sc]});
    dl.n=(dl.n||0)+1;save();    if($('#judge').checked&&conn.apiKey)judgeStealth(R);
  }catch(e){if(diagnostics){diagnostics.hider.durationMs=diagnostics.hider.durationMs??Date.now()-(diagnostics.hider.startedAt||Date.now());diagnostics.hider.validation.schemePresent=diagnostics.hider.validation.schemePresent??false;diagnostics.errors.push(e.message);recordHiderOutcome(false);renderDiagnostics()}say(e.message,'bad');if(!$('#imgbox img'))$('#imgbox').textContent=IDLE.duel}
  finally{hideInFlight=false;busy(false)}
}
$('#next').onclick=()=>{
  if(R?.mode==='duel'){$('#duel').hidden=false;$('#own').hidden=true;$('#game').hidden=true;stageIdle(IDLE.duel);say('Ready for another Duel. Review your message and settings, then start when you are ready.');return}
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
  const mods=['Standard','No-Hint Protocol'];
  const modifier=mods[hash32('night-cipher-modifier-'+n)%mods.length],maxTries=3,noHints=modifier==='No-Hint Protocol';
  start({mode:'daily',schemeIdx:i,day:n,modifier,maxTries,noHints,secret:w,svg:t.g(w,hash32('night-cipher-art-'+n)),scheme:t.s,hints:[...t.h,`It starts with “${w[0]}”.`]});
  const msg=()=>`Daily cipher #${n-20000} · ${modifier} · same puzzle for everyone in your timezone today. Next in ${fmtLeft(nextLocalMidnight()-Date.now())}. 3 tries${noHints?' · hints disabled':''}.`;
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
$('#osch').innerHTML=TRAIN.map((t,i)=>`<option value="${i}">Scheme #${String(i+1).padStart(2,'0')}</option>`).join('');
$('#ohide').onclick=async()=>{const w=norm($('#omsg').value);if(!/^[A-Z]{2,10}$/.test(w))return say('Use 2–10 letters A–Z.','bad');
if(!conn||!conn.apiKey)return say('Connect your Pollinations account first (button, top right).','bad');
const t=TRAIN[$('#osch').value],nm=`Cipher #${String(+$('#osch').value+1).padStart(2,'0')}`;start({mode:'own',schemeIdx:+$('#osch').value,secret:w,svg:t.g(w,Math.random()*1e6|0),scheme:t.s,sname:nm,hints:[]});R.done=true;$('#game').hidden=false;$('#guess').hidden=true;$('#guess').previousElementSibling.hidden=true;$('#go').parentElement.hidden=true;$('#hints').hidden=true;$('#giveup').hidden=true;$('#revealHow').hidden=false;
$('#res').innerHTML=`<b>Your puzzle: “${esc(w)}” hidden with ${esc(nm)}.</b>`;$('#ai').disabled=false;$('#ai').click()};

/* ---------- tabs & models ---------- */
function train(i){const t=TRAIN[i],w=t.m,seed=hash32('training-art-'+i);$('#duel').hidden=true;start({mode:'train',schemeIdx:i,secret:w,svg:t.g(w,seed),scheme:t.s,hints:[...t.h,`It starts with “${w[0]}”.`]});say(`Level ${i+1} · ${t.n}. Find the hidden message. You have 3 tries.`)}
const tabs=$('#tabs'),levels=$('#levels'),allTabs=[];
const IDLE={duel:'AI Hider conceals your message in an image. AI Seeker then tries to decode it.',own:'Pick a word and a hiding scheme on the right, then press “Challenge the AI”.'};
function stageIdle(m){$('#imgbox').textContent=m;$('#res').innerHTML='';$('#robustnessReport').innerHTML=''}
const INTRO={daily:'Every picture hides a word. Spot the pattern, then type the word on the right. One puzzle a day, the same for everyone.',learn:'Every picture hides a word. Spot the pattern, then type it on the right. Hints cost points.',duel:'Choose a secret message and watch two AI models compete: AI Hider conceals it in an image, then AI Seeker tries to recover it. You are the referee.',own:'Choose a word and a hiding scheme, then see whether an AI seeker can read your picture.'};
function learn(){const lv=allTabs.filter(x=>x.dataset.kind==='training'),i=Math.max(0,TRAIN.findIndex((_,k)=>!(T.levels&&T.levels[k])));lv[i].click()}
const tabDefs=[
  ['📅 Daily',daily,'daily'],
  ['🎓 Learn',learn,'learn'],
  ...TRAIN.map((t,i)=>['🎓 Level '+(i+1)+(T.levels&&T.levels[i]?' ✓':''),()=>train(i),'training']),
  ['⚔ AI vs AI Duel 💰',()=>{if(!(R&&R.mode==='duel'))stageIdle(IDLE.duel);$('#duel').hidden=false;$('#game').hidden=!(R&&R.mode=='duel');say('Choose the secret message and AI models, then start the duel.')},'duel'],
  ['🕵 You hide, AI seeks 💰',()=>{if(!(R&&R.mode==='own'))stageIdle(IDLE.own);$('#own').hidden=false;$('#game').hidden=true;say('Hide a word with a scheme of your choice and see if the AI can read it.')},'own'],
  ['🧬 Interactive Sandbox',()=>say('Experiment with pixel-level LSB editing and live structural cipher encoding in your browser.'),'lab'],
  ['🧭 Cipher Walkthrough',()=>say('Explore the ten training ciphers step by step, from visible clues to decoded letters.'),'walkthrough'],
  ['🧪 Image Degradation Lab',()=>{refreshDegradationLab();say('Test Seeker recovery after controlled image degradation. Each run makes five additional vision requests.')},'degradation']
];
tabDefs.forEach(([label,fn,kind])=>{
  const b=document.createElement('button');
  b.textContent=label;
  b.dataset.kind=kind;
  b.onclick=()=>{
    allTabs.forEach(x=>x.classList.remove('on','in'));researchTab.classList.remove('on');
    const inLearn=kind==='training'||kind==='learn';
    const inLab=kind==='lab';
    const inWalkthrough=kind==='walkthrough';
    const inDegradation=kind==='degradation';
    b.classList.add(kind==='learn'?'in':'on');
    if(kind==='training')allTabs.find(x=>x.dataset.kind==='learn').classList.add('in');
    levels.hidden=!inLearn;$('#mainGame').hidden=inLab||inWalkthrough||inDegradation;$('#researchMode').hidden=true;$('#lsbLab').hidden=!inLab;$('#cipherWalkthrough').hidden=!inWalkthrough;$('#degradationLab').hidden=!inDegradation;
    $('#intro').textContent=INTRO[inLearn&&kind!=='daily'?'learn':kind]||'';
    $('#duel').hidden=$('#own').hidden=true;
    fn();
  };
  allTabs.push(b);(kind==='training'?levels:tabs).append(b);
});
const researchTab=document.createElement('button');researchTab.type='button';researchTab.textContent='🧪 Research';researchTab.dataset.kind='research';
researchTab.onclick=()=>{allTabs.forEach(x=>x.classList.remove('on','in'));researchTab.classList.add('on');$('#mainGame').hidden=true;$('#lsbLab').hidden=true;$('#cipherWalkthrough').hidden=true;$('#degradationLab').hidden=true;$('#researchMode').hidden=false;$('#intro').textContent='Evaluate Hider and Seeker performance with controlled experiments, independent blind validation and round-level diagnostics.';score();renderDiagnostics()};tabs.append(researchTab);

/* ---------- interactive image degradation lab ---------- */
let degradationInFlight=false;
const refreshDegradationLab=()=>{
 const source=$('#degradationSource'),button=$('#degradationRun');
 const available=!!(R&&R.svg&&['duel','own'].includes(R.mode));
 if(source)source.textContent=available?('Active round · '+(R.mode==='duel'?'AI vs AI Duel':'You hide, AI seeks')+' · '+R.svg.length.toLocaleString()+' SVG characters · message length '+String(R.secret||'').length):'Start an AI vs AI Duel or You hide, AI seeks round first.';
 if(button)button.disabled=uiBusy||!available||degradationInFlight;
 if($('#degradationStatus')&&!/^(Completed|Stopped)/.test($('#degradationStatus').textContent))$('#degradationStatus').textContent=available?'Ready · five additional vision requests will be sent after confirmation.':'Waiting for an active AI round.';
};
const degradationReport=rows=>'<div class="degradation-grid">'+rows.map(r=>'<article class="degradation-card"><div class="degradation-thumb"><img src="'+r.dataUrl+'" alt="'+esc(r.label)+' preview"></div><div class="degradation-card-body"><b>'+esc(r.label)+'</b><small>'+esc(r.description)+'</small><div class="degradation-result-row"><span class="'+(r.error?'bad':r.ok?'ok':'bad')+'">'+(r.error?'Request error':r.ok?'Recovered':'Not recovered')+'</span><strong>'+(r.similarity==null?'—':Math.round(r.similarity*100)+'%')+'</strong></div><p><small>Decoded: </small>'+esc(r.guess||'—')+'</p><small>'+((r.durationMs==null)?'—':Math.round(r.durationMs)+' ms')+' · '+(r.tokens??'—')+' tokens · '+(r.imageKB??'—')+' KB</small></div></article>').join('')+'</div>';
$('#degradationRun').onclick=async()=>{
 const round=R;if(!round||degradationInFlight||aiInFlight)return;
 if(!conn||!conn.apiKey)return say('Connect your Pollinations account first. This experiment makes five additional paid vision requests.','bad');
 const model=robustnessModel(round);if(!model)return say('Select a vision-capable seeker model first.','bad');
 if(!confirm('Run five image degradation tests? This sends 5 additional requests to '+model+' and uses Pollen.'))return;
 degradationInFlight=true;const button=$('#degradationRun'),root=$('#degradationResults'),rows=[];
 button.disabled=true;$('#degradationStatus').textContent='Preparing five deterministic image variants…';root.innerHTML='<p class="report-empty">Generating five deterministic image variants…</p>';busy(true,'Preparing image degradation variants…');
 try{
  const source=await toRaster(round.svg,'image/png'),variants=await createDegradationVariants(source),prompt=buildSeekPrompt(round);
  const audit=auditBlindRequest({prompt,secret:round.secret,scheme:round.scheme||'',schemeExpected:round.mode!=='duel'&&!!round.scheme,imageAttached:true});
  if(!audit.verified)throw new Error('Blind Seeker request audit failed. The experiment was stopped before sending any image.');
  root.innerHTML=degradationReport(variants.map(v=>({...v,guess:'Waiting…',similarity:null,ok:false,tokens:0,durationMs:null,imageKB:Math.round(v.bytes/102.4)/10})));
  for(let i=0;i<variants.length;i++){
   if(R!==round)break;
   const variant=variants[i],before=tok,started=performance.now(),row={...variant,guess:'',similarity:null,ok:false,tokens:0,durationMs:null,imageKB:Math.round(variant.bytes/102.4)/10};
   try{
    const output=await chat(model,[{role:'user',content:[{type:'text',text:prompt},{type:'image_url',image_url:{url:variant.dataUrl}}]}],4000,90000);
    const parsed=parseSeekerResponse(output);row.guess=parsed.message;row.method=parsed.method;row.similarity=simMessage(row.guess,round.secret);row.ok=row.similarity>=.9;
   }catch(error){row.error=error.message}
   row.tokens=tok-before;row.durationMs=performance.now()-started;rows.push(row);
   const event={type:'robustness',outcome:row.ok?'success':'failure',category:row.error?'image_variant_request_error':row.ok?'image_variant_recovered':'image_variant_mismatch',hiderModel:diagnostics?.hider?.model||null,seekerModel:model,expectedMessage:round.secret,decodedMessage:row.guess||null,exactMatch:row.similarity==null?null:normalizeMessage(row.guess)===normalizeMessage(round.secret),similarity:row.similarity,durationMs:Math.round(row.durationMs),tokens:row.tokens,variant:'lab-'+variant.id,imageKB:row.imageKB,error:row.error||null};
   recordEvidence(event);
   root.innerHTML=degradationReport([...rows,...variants.slice(i+1).map(v=>({...v,guess:'Waiting…',similarity:null,ok:false,tokens:0,durationMs:null,imageKB:Math.round(v.bytes/102.4)/10}))]);
   $('#degradationStatus').textContent='Test '+rows.length+' of '+variants.length+': '+variant.label;busy(true,'Test '+rows.length+' of '+variants.length+': '+variant.label);
  }
  if(R===round){
   const completed=rows.filter(r=>r.similarity!=null),wins=completed.filter(r=>r.ok).length;
   round.degradationLab={model,rows:rows.map(({dataUrl,...r})=>r),timestamp:new Date().toISOString()};
   save();score();$('#degradationStatus').textContent='Completed · '+wins+'/'+completed.length+' variants recovered.';say('Image Degradation Lab complete: '+wins+'/'+completed.length+' variants recovered'+(rows.some(r=>r.error)?'; some requests failed.':'.'),wins===5?'ok':'');
  }
 }catch(error){$('#degradationStatus').textContent='Stopped · '+error.message;say('Image Degradation Lab stopped: '+error.message,'bad');root.innerHTML='<p class="bad">'+esc(error.message)+'</p>'}
 finally{degradationInFlight=false;busy(false);refreshDegradationLab()}
};
/* ---------- fixed Pollinations model allowlist ---------- */
function fill(sel,ids,pref){
  $(sel).innerHTML=ids.map(id=>`<option value="${esc(id)}">${esc(id)}</option>`).join('');
  const preferred=ids.find(id=>pref.test(id));
  if(preferred)$(sel).value=preferred;
}
const supportsVisionInput=m=>typeof m==='object'&&m!==null&&(
  (Array.isArray(m.input_modalities)&&m.input_modalities.includes('image'))||
  Number(m.max_reference_images)>0
);
// One source of truth: add future approved model IDs to js/models.js.
fill('#hider',POLLINATIONS_MODELS,/^openai\/gpt-6\.1-sol$/i);
fill('#seeker',POLLINATIONS_MODELS,/^openai\/gpt-6\.1-terra$/i);
fill('#seeker2',POLLINATIONS_MODELS,/^openai\/gpt-6\.1-terra$/i);
fill('#seekerAudit',POLLINATIONS_MODELS,/^openai\/gpt-6-luna$/i);
fill('#judgeModel',POLLINATIONS_MODELS,/openai\/gpt-6\.1-sol/i);
fill('#roundSeeker',POLLINATIONS_MODELS,/^openai\/gpt-6\.1-terra$/i);
['#hider','#seeker','#seeker2','#seekerAudit','#judgeModel','#roundSeeker'].forEach(sel=>{$(sel).disabled=false});
const MODEL_META_TARGETS=[['#hider','#hiderMeta',false],['#seeker','#seekerMeta',true],['#seeker2','#seeker2Meta',true],['#seekerAudit','#seekerAuditMeta',true],['#judgeModel','#judgeModelMeta',true],['#roundSeeker','#roundSeekerMeta',true]];
function updateModelMeta(selectSelector,metaSelector,requiresVision=false){const model=getModelMetadata(modelCatalog,$(selectSelector)?.value);const target=$(metaSelector);if(target)target.textContent=describeModel(model,{requiresVision})}
function refreshModelMeta(){for(const [selectSelector,metaSelector,requiresVision] of MODEL_META_TARGETS)updateModelMeta(selectSelector,metaSelector,requiresVision)}
MODEL_META_TARGETS.forEach(([selectSelector,metaSelector,requiresVision])=>$(selectSelector)?.addEventListener('change',()=>updateModelMeta(selectSelector,metaSelector,requiresVision)));
refreshModelMeta();
loadModelCatalog().then(catalog=>{modelCatalog=catalog;refreshModelMeta()}).catch(()=>refreshModelMeta());
if(APP_KEY.includes('REPLACE'))$('#setup').hidden=false;score();mountLsbLab($('#lsbLab'));mountCipherWalkthrough($('#cipherWalkthrough'));mountStructuralSandbox($('#structuralSandbox'));refreshDegradationLab();$('#evidenceType').addEventListener('change',renderEvidence);$('#evidenceOutcome').addEventListener('change',renderEvidence);$('#evidenceModel').addEventListener('change',renderEvidence);$('#evidenceSearch').addEventListener('input',renderEvidence);$('#evidenceJson').onclick=()=>downloadEvidence('json');$('#evidenceCsv').onclick=()=>downloadEvidence('csv');$('#evidenceClear').onclick=()=>{if(!T.evidence?.length)return;if(!confirm('Clear the locally saved Failure Analysis evidence log?'))return;T.evidence=[];save();renderEvidence()};allTabs[0].click();
/* ---------- first-visit "How to play" ---------- */
const howto=$('#howto'),HOWTO_KEY='nc-howto-seen';
const openHowto=()=>{if(!howto.open){howto.showModal();howto.scrollTop=0}};
$('#howtoBtn').onclick=openHowto;
$('#howtoClose').onclick=()=>howto.close();
howto.addEventListener('close',()=>{try{localStorage.setItem(HOWTO_KEY,'1')}catch{/* storage unavailable */}});
try{if(!localStorage.getItem(HOWTO_KEY)&&!/selftest/.test(location.search))openHowto()}catch{/* storage unavailable */}

if(/selftest/.test(location.search))runSelfTest({getState:()=>T,setState:v=>{T=v},getRound:()=>R,setRound:v=>{R=v},getTokens:()=>tok,setTokens:v=>{tok=v},conn,$,esc,TRAIN,toPng,toRaster,dailyIndex,dailyWord,hash32,sim,supportsVisionInput,clean,hasSecretLeak,utf8Base64,annotate,chat,score,syncButtons});
