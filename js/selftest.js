import { BR, INV, P, L, CH } from './ciphers.js';

const DEC=[
d=>L(d,'rect[height]').filter(r=>r.getAttribute('fill')==='url(#bldgG)'||r.getAttribute('fill')==='#10142b').map(r=>CH(64+(r.getAttribute('height')-10)/12)).join(''),
d=>{let o='',c='',nx=0,py=-1;L(d,'circle[fill="#ffd166"],rect[fill="#ffd166"]').forEach(e=>{const dot=e.tagName=='circle',x=dot?e.getAttribute('cx')-6:+e.getAttribute('x'),y=dot?+e.getAttribute('cy'):+e.getAttribute('y')+4;if(c&&(y!=py||x-nx>10)){o+=INV[c]||'?';c=''}c+=dot?'.':'-';nx=x+(dot?22:44);py=y});return o+(INV[c]||'?')},
d=>L(d,'line[stroke="#ffd166"]').map(l=>{const a=Math.atan2(l.getAttribute('x2')-l.getAttribute('x1'),l.getAttribute('y1')-l.getAttribute('y2'));return CH(65+Math.round((a<0?a+2*Math.PI:a)/(2*Math.PI)*26)%26)}).join(''),
d=>{const W=L(d,'rect[width="20"],rect[width="18"]');let o='';for(let i=0;i<W.length;i+=5)o+=CH(64+parseInt(W.slice(i,i+5).map(w=>w.getAttribute('fill')=='#ffd166'?1:0).join(''),2));return o},
d=>{const C=L(d,'circle[r="10"]');let o='';for(let i=0;i<C.length;i+=6)o+=CH(65+BR.indexOf(C.slice(i,i+6).map((c,k)=>c.getAttribute('fill')=='#ffd166'?k+1:'').join('')));return o},
d=>L(d,'circle[r="34"]').map(c=>CH(65+Math.round(+c.getAttribute('data-hue')*26/360))).join(''),
d=>L(d,'g[data-cipher="count-tile"]').map(g=>CH(64+L(g,'circle[data-cipher="count-dot"]').filter(c=>c.getAttribute('fill')==='#ffd166').length)).join(''),
d=>L(d,'polygon[data-cipher="poly"]').map(p=>CH(62+p.getAttribute('points').trim().split(/\s+/).length)).join(''),
d=>L(d,'g[data-cipher="petals"]').map(g=>CH(64+L(g,'ellipse').length)).join(''),
d=>{const W=L(d,'rect[data-cipher="rhythm-bit"]');let o='';for(let i=0;i<W.length;i+=5)o+=CH(64+parseInt(W.slice(i,i+5).map(w=>w.getAttribute('fill')==='#ffd166'?1:0).join(''),2));return o}];
/*ENDDEC*/
export { DEC };

export async function runSelfTest(ctx){
 const {getState,setState,getRound,setRound,getTokens,setTokens,conn,$,esc,TRAIN,toPng,toRaster,dailyIndex,dailyWord,hash32,sim,supportsVisionInput,clean,hasSecretLeak,utf8Base64,annotate,chat,score,syncButtons}=ctx;
  const out=[],originalFetch=window.fetch,originalTok=getTokens(),originalT=JSON.parse(JSON.stringify(getState())),originalR=getRound(),originalStorage=(()=>{try{return localStorage.getItem('nc')}catch{return null}})();
  const keyDesc=conn?Object.getOwnPropertyDescriptor(conn,'apiKey'):null;
  const uiSelectors=['#status','#score','#report','#profile','#bestTime','#achievementCount','#achievements','#codexPreview','#imgbox','#res','#hints','#game','#msg','#hide','#ai','#hint','#go','#giveup','#next','#robustness','#robustnessReport'];
  const uiBackup=uiSelectors.map(sel=>{const e=$(sel);return e?{sel,html:e.innerHTML,text:e.textContent,value:e.value,hidden:e.hidden,disabled:e.disabled,className:e.className}:null}).filter(Boolean);
  document.body.insertAdjacentHTML('afterbegin','<div class="wrap"><div class="card"><h3>Self-test</h3><pre id="st" style="white-space:pre-wrap">Running…</pre></div></div>');
  const t=(n,ok,d='')=>out.push(`${ok?'✅':'❌'} ${n}${d?' — '+esc(d):''}`);
  try{
    for(let i=0;i<TRAIN.length;i++){
      const q=TRAIN[i],svg=q.g(q.m),got=DEC[i](P(svg));t(`Level ${q.n}: decoder round-trip`,got===q.m,got);
      try{const u=await toPng(svg),im=new Image();await new Promise((resolve,reject)=>{im.onload=resolve;im.onerror=reject;im.src=u});t(`Level ${q.n}: PNG render`,im.width===1024&&im.height>0,`${im.width}×${im.height}`)}catch(e){t(`Level ${q.n}: PNG render`,false,e.message)}
      try{const jpg85=await toRaster(svg,'image/jpeg',.85),jpg55=await toRaster(svg,'image/jpeg',.55);t(`Level ${q.n}: JPEG degradation encoders`,jpg85.startsWith('data:image/jpeg')&&jpg55.startsWith('data:image/jpeg'))}catch(e){t(`Level ${q.n}: JPEG degradation encoders`,false,e.message)}
    }
    let bad=[];for(let n=0;n<60;n++){const i=dailyIndex(n),q=TRAIN[i],w=dailyWord(n);if(DEC[i](P(q.g(w,hash32('night-cipher-art-'+n))))!==w)bad.push(n+':'+w);if(n&&i===dailyIndex(n-1))bad.push('repeat-scheme:'+n)}
    t('Daily puzzles: 60 seeded round-trips with no consecutive scheme repeats',!bad.length,bad.join(' '));
    t('Daily selection is deterministic',Array.from({length:30},(_,n)=>dailyIndex(n)).join(',')===Array.from({length:30},(_,n)=>dailyIndex(n)).join(','));
    t('Similarity normalization',sim('BEE','B E E')===1&&sim('HONEY','HONAY')<.9&&sim('μέλι','ΜΕΛΙ')===1);
    t('Vision detection accepts image input_modalities',supportsVisionInput({input_modalities:['text','image']}));
    t('Vision detection accepts max_reference_images metadata',supportsVisionInput({max_reference_images:1}));
    t('Vision detection rejects text-only models',!supportsVisionInput({input_modalities:['text']}));
    const safe=clean('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="x()"><title>ignored</title><script>x()<\/script><rect width="5" height="5" fill="#123"/></svg>');
    t('SVG sanitizer strips unsafe attributes/elements',!/script|onload|ignored/.test(safe)&&/viewBox/.test(safe),safe.slice(0,100));
    let rejected=false;try{clean('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><animate attributeName="x"/></svg>')}catch{rejected=true}
    t('SVG sanitizer rejects unsupported active content',rejected);
    const referenced=clean('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><rect id="shape" width="5" height="5" fill="#123"/></defs><use href="#shape" style="fill:#456;stroke-width:2;position:fixed;"/></svg>');
    t('SVG sanitizer preserves safe local use references and allowlisted CSS',/<use[^>]*href="#shape"/.test(referenced)&&/fill:#456/.test(referenced)&&!/position/.test(referenced));
    const external=clean('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><use href="https://example.com/a.svg#x"/></svg>');
    t('SVG sanitizer strips external use references',!/<use[^>]*href=/.test(external));
    let malformed=false;try{clean('<svg viewBox="0 0 10 10"><g></svg>')}catch(e){malformed=/malformed SVG\/XML/.test(e.message)}
    t('SVG sanitizer reports malformed XML before namespace repair',malformed);
    const leaked='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><text>SECRET WORD</text></svg>';
    t('Leakage detector catches visible text',hasSecretLeak(leaked,'SECRET WORD'));
    t('Leakage detector catches split text nodes',hasSecretLeak('<svg xmlns="http://www.w3.org/2000/svg"><text>SEC</text><text>RET</text></svg>','SECRET'));
    t('Leakage detector allows visual-only SVG',!hasSecretLeak('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#123"/></svg>','SECRET'));
    t('Leakage detector ignores common short words in attributes',!hasSecretLeak('<svg xmlns="http://www.w3.org/2000/svg"><g id="the-path" class="this-route"/></svg>','THE WAY'));
    t('Leakage detector catches UTF-8 Base64 text',hasSecretLeak(`<svg xmlns="http://www.w3.org/2000/svg"><g data-code="${utf8Base64('ΜΕΛΙ')}"/></svg>`,'ΜΕΛΙ'));
    t('Leakage detector ignores SVG tag-name false positives',!hasSecretLeak('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#123"/></svg>','SVG'));
    t('Leakage detector accepts plain-text SCHEME explanations',!hasSecretLeak('One flower per letter; petals encode A=1 through Z=26.','THE BEES KNOW THE WAY',{strictWords:false}));
    t('SCHEME detector allows an incidental single-word overlap',!hasSecretLeak('The stars are arranged in four visual groups.','TRUST THE QUIET STARS',{strictWords:false}));
    t('SCHEME detector still catches the complete secret phrase',hasSecretLeak('The decoded message is THE BEES KNOW THE WAY.','THE BEES KNOW THE WAY',{strictWords:false}));
    t('SCHEME detector catches an encoded complete secret phrase',hasSecretLeak('Encoded payload: '+utf8Base64('TRUST THE QUIET STARS'),'TRUST THE QUIET STARS',{strictWords:false}));
    t('SVG detector remains strict about complete secret words in attributes',hasSecretLeak('<svg xmlns="http://www.w3.org/2000/svg"><g id="stars"/></svg>','TRUST THE QUIET STARS'));
    t('Leakage detector avoids substring false positives in prose',!hasSecretLeak('Use a honeycomb-like arrangement of petals.','HONEY'));
    for(let i=0;i<TRAIN.length;i++){const q=TRAIN[i],a=annotate(q.g(q.m),i);t(`Reveal ${q.n}: highlights the encoded letters`,DEC[i](P(a))===q.m&&[...q.m].every(c=>a.includes('>'+c+'<')))}
    if(conn){
      Object.defineProperty(conn,'apiKey',{value:'sk_test_only',configurable:true});
      window.fetch=async()=>new Response(JSON.stringify({choices:[{message:{content:'mock response'}}],usage:{total_tokens:7}}),{status:200});
      const before=getTokens(),result=await chat('mock-model',[{role:'user',content:'test'}],20,10000);
      t('Chat transport uses mocked fetch and parses response',result==='mock response'&&getTokens()===before+7);
    }else t('Chat transport mock',false,'Pollinations connector element unavailable');
  }catch(e){t('Self-test execution',false,e.message)}
  finally{
    window.fetch=originalFetch;setTokens(originalTok);setState(originalT);setRound(originalR);
    if(conn){try{if(keyDesc)Object.defineProperty(conn,'apiKey',keyDesc);else delete conn.apiKey}catch{}}
    try{originalStorage===null?localStorage.removeItem('nc'):localStorage.setItem('nc',originalStorage)}catch{}
    score();syncButtons();
    for(const x of uiBackup){const e=$(x.sel);if(!e)continue;e.innerHTML=x.html;e.value=x.value;e.hidden=x.hidden;e.disabled=x.disabled;e.className=x.className}
    $('#st').innerHTML=out.join('\n')+`\n\n${out.filter(l=>l.startsWith('✅')).length}/${out.length} passed. The API test used a local mock; no live API call was made. App data and connector key were restored.`;
  }
}
