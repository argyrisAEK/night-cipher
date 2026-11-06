const API='https://gen.pollinations.ai/v1';

export function createChat({getConnection,getTokenCount,setTokenCount,onUsage}){
  return async function chat(model,messages,max,timeoutMs=90000){
    const connection=getConnection();
    const key=connection&&connection.apiKey;
    if(!key)throw Error('Connect your Pollinations account first (button, top right).');
    const ac=new AbortController();
    const t=setTimeout(()=>ac.abort(),Math.max(10000,Math.min(timeoutMs,180000)));
    try{
      const r=await fetch(API+'/chat/completions',{
        method:'POST',
        headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
        body:JSON.stringify({model,messages,max_tokens:max}),
        signal:ac.signal
      });
      if(!r.ok){
        let m='';
        try{m=(await r.json()).error?.message||''}catch{}
        throw Error(r.status==402
          ?'Not enough Pollen for this request. Top up from the Connect menu or pick a cheaper model.'
          :r.status==401||r.status==403
            ?'Your key was rejected, expired, or lacks permission for this model. Reconnect and authorize the required model categories.'
            :`API error ${r.status} ${m}`);
      }
      const j=await r.json();
      setTokenCount(getTokenCount()+(j.usage?.total_tokens||0));
      onUsage();
      const choice=j.choices?.[0],content=choice?.message?.content;
      const text=content==null?'':Array.isArray(content)
        ?content.map(part=>part.text||'').join('')
        :String(content);
      const isHideRequest=messages.some(m=>
        typeof m.content==='string'&&m.content.includes('as ONE SVG (viewBox 0 0 800 500)')
      );
      if(isHideRequest&&!/<svg[\s\S]*?<\/svg>/i.test(text)){
        console.warn('[Night Cipher] Hider API response (may contain your secret):',j);
        const finishReason=choice?.finish_reason||'not provided';
        const completionTokens=j.usage?.completion_tokens??'not provided';
        const responseModel=j.model||model;
        throw Error(`No complete SVG came back (model: ${responseModel}; finish_reason: ${finishReason}; completion_tokens: ${completionTokens}). Inspect DevTools → Console for diagnostics.`);
      }
      if(content==null)throw Error('The API returned no message content.');
      return text;
    }catch(e){
      throw e.name=='AbortError'
        ?Error('Request timed out. Try a faster model or a shorter prompt.')
        :e;
    }finally{clearTimeout(t)}
  }
}

const HIDE=(msg,easy)=>`Draw an ordinary-looking, attractive scene as ONE SVG (viewBox 0 0 800 500) that secretly encodes this message, so that another model that sees only the rendered picture can recover it:

${msg}

Rules: the message, or any of its words or letters, must NOT appear as text, labels, ids, comments or metadata. Pick your own encoding (shapes, heights, counts, colours, angles, patterns...). ${easy?'Include a subtle visual key (a ruler, legend or reference marks) so a careful viewer can work out how to read it.':'Do not include any legend; the scheme must be inferable from the picture alone.'}

Reply with the raw <svg>...</svg> first, then one final line starting with SCHEME: that honestly says how you hid it.`;

const SEEK='This picture may hide a secret message encoded in its visual structure. Inspect repeated objects, counts, geometry, colours, positions, and grouping. You cannot run code, so reason from visible evidence. Divide the image into repeated groups and inspect them systematically. Do not answer NONE merely because the first pattern is unclear. Prefer a complete, internally consistent decoding; use NONE only if no defensible rule explains the entire image. Reply in exactly two lines:\nMESSAGE: <recovered text, or NONE>\nMETHOD: <one sentence explaining the visual evidence and mapping>';

const buildSeekPrompt=(round,{retry=false}={})=>{
  // Training, Daily, and user-authored cipher challenges already know their rule.
  // Only the AI-vs-AI duel remains a blind cryptanalysis task.
  if(round.mode!=='duel'&&round.scheme){
    return `You are decoding a visual cipher. The exact decoding rule is known. Apply it; do not invent a different cipher and do not guess from the scene theme.

DECODING RULE:
${round.scheme}

Read every encoded symbol in visual reading order (left to right, then top to bottom). Count or measure the visual elements carefully, convert each value using the stated alphabet convention, and concatenate the letters. Re-check the number of symbols and each value before answering. Never infer the original word from outside information.

${retry?'Second attempt: re-examine each symbol independently, verify its count/value, and check the full sequence before answering.':'Be methodical. If one symbol is slightly ambiguous, use the repeated geometry and neighboring symbols to resolve it.'}

Reply in exactly two lines:
MESSAGE: <recovered text, letters only>
METHOD: <one concise sentence naming the rule and how you applied it>`;
  }
  if(retry){
    return 'Second-pass visual cryptanalysis. Do not repeat the first guess without checking it. Divide the image into repeated groups in reading order. For each group, identify the observable count, shape, colour, orientation or spacing; test consistent mappings such as A=1 through Z=26, binary, or Morse. Reject any mapping that does not explain every group. Prefer a complete, internally consistent decoding; use NONE only if no rule explains the entire image. Reply in exactly two lines:\nMESSAGE: <recovered text, or NONE>\nMETHOD: <one sentence with the evidence and mapping>';
  }
  return SEEK;
};

export { HIDE, SEEK, buildSeekPrompt };
