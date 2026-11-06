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
            ?'Your key was rejected or has expired. Reconnect.'
            :`API error ${r.status} ${m}`);
      }
      const j=await r.json();
      setTokenCount(getTokenCount()+(j.usage?.total_tokens||0));
      onUsage();
      const choice=j.choices?.[0],content=choice?.message?.content;
      if(content==null)throw Error('The API returned no message content.');
      const text=Array.isArray(content)
        ?content.map(part=>part.text||'').join('')
        :String(content);

      // Give a useful, privacy-conscious diagnostic for the Hide-message call:
      // report completion metadata without echoing the secret or model output.
      const isHideRequest=messages.some(m=>
        typeof m.content==='string'&&m.content.includes('as ONE SVG (viewBox 0 0 800 500)')
      );
      if(isHideRequest&&!/<svg[\s\S]*?<\/svg>/i.test(text)){
        const finishReason=choice.finish_reason||'not provided';
        const completionTokens=j.usage?.completion_tokens??'not provided';
        throw Error(`No complete SVG came back (finish_reason: ${finishReason}; completion_tokens: ${completionTokens}). To inspect the exact model output, open browser DevTools → Network → chat/completions → Response. The response is not copied into the page because it may contain your secret.`);
      }
      return text;
    }catch(e){
      throw e.name=='AbortError'
        ?Error('Request timed out. Try a faster model or a shorter prompt.')
        :e;
    }finally{
      clearTimeout(t);
    }
  }
}

const HIDE=(msg,easy)=>`Draw an ordinary-looking, attractive scene as ONE SVG (viewBox 0 0 800 500) that secretly encodes this message, so that another model that sees only the rendered picture can recover it:\n\n${msg}\n\nRules: the message, or any of its words or letters, must NOT appear as text, labels, ids, comments or metadata. Pick your own encoding (shapes, heights, counts, colours, angles, patterns...). ${easy?'Include a subtle visual key (a ruler, legend or reference marks) so a careful viewer can work out how to read it.':'Do not include any legend; the scheme must be inferable from the picture alone.'}\n\nReply with the raw <svg>...</svg> first, then one final line starting with SCHEME: that honestly says how you hid it.`;
const SEEK='This picture may hide a secret message encoded in its visual structure (heights, counts, colours, angles, Morse-like patterns, hidden regularities). You cannot run code, so measure carefully by eye. Reply in exactly two lines:\nMESSAGE: <the recovered text, or NONE>\nMETHOD: <one sentence>';

export { HIDE, SEEK };
