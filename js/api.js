const API='https://gen.pollinations.ai/v1';


export function createChat({getConnection,getTokenCount,setTokenCount,onUsage}){
  return async function chat(model,messages,max,timeoutMs=90000,{requestType='chat'}={}){
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
      if(requestType==='hider'&&!/<svg[\s\S]*?<\/svg>/i.test(text)){
        const finishReason=choice?.finish_reason||'not provided';
        const completionTokens=j.usage?.completion_tokens??'not provided';
        const responseModel=j.model||model;
        throw Error(`Hider returned no complete SVG (model: ${responseModel}; finish_reason: ${finishReason}; completion_tokens: ${completionTokens}). Try a faster model or a shorter message.`);
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

const HIDE=(msg,easy)=>`Create a polished, atmospheric visual-cryptography puzzle for NIGHT CIPHER. You are an expert SVG illustrator and puzzle designer, not a chart or worksheet generator.

SECRET MESSAGE (encode visually; never print it):
${msg}

ART DIRECTION — essential:
- Match Night Cipher's signature nocturnal identity: deep midnight navy, indigo and muted plum; restrained teal is allowed; use luminous antique gold/amber for the encoded elements.
- Create a cinematic, mysterious, premium illustration with layered depth, elegant composition, subtle gradients, soft glow and fine decorative detail. Use a cohesive scene such as a moonlit observatory, enigmatic night city, ancient astronomical mechanism, bioluminescent garden, celestial archive or mysterious machine. Choose a scene that naturally suits the encoding.
- The result must look like finished atmospheric key art from a polished puzzle game — never like a school worksheet, infographic, spreadsheet, generic data visualization or plain instructional diagram.
- Avoid bright daytime skies, pastel cartoon houses, childish clip-art, flat empty backgrounds and crude rows of identical boxes. Do not default to houses/windows; vary the scene and visual metaphor.
- Keep the encoded symbols visually prominent and countable. Atmosphere is secondary: decorative detail must never obscure, imitate or be confused with encoded elements.

ENCODING AND COMPOSITION:
- Choose ONE reliable visual encoding that a vision model can decode from the rendered image alone: preferably A=1…Z=26 counts, five-bit binary, Morse, geometric orientation or another unambiguous visual mapping.
- Use exactly one clearly separated symbol/group per letter, in left-to-right reading order. Do not create a group for spaces; use a noticeably larger gap between words.
- Keep all groups large, evenly spaced, non-overlapping and fully visible. If counting objects, every counted object must be individually distinguishable; never hide, overlap or crop them. Avoid perspective that changes apparent counts or shapes.
- Integrate the encoding naturally into the chosen scene (for example, lit observatory apertures, petals on luminous night flowers, stars, facets in an ancient mechanism), while preserving consistent geometry and spacing.
- If using binary, show the same fixed number of positions for every letter and make the two states unmistakable. If using counts, make the count easy to verify. Do not mix encoding systems.
- ${easy?'Include a small, elegant visual key that can be inferred without words (for example, a subtle sequence of reference marks or a clearly ordered set of states), integrated into the scene and visually distinct from the message groups.':'Do not include a legend, key, alphabet, numbers or labels; the rule must be inferable from the visual pattern alone.'}
- Use viewBox="0 0 800 500". Compose for the full canvas with comfortable margins and strong visual hierarchy.

SVG AND OUTPUT RULES:
- Return one self-contained SVG using only vector shapes and gradients. No external images, fonts, links, scripts or foreignObject.
- Do not put the secret, any complete secret word, or its letters as readable text anywhere in the SVG — including text nodes, labels, ids, comments, titles, descriptions or metadata. Use neutral ids only.
- No visible words, alphabet characters, numbers or explanatory labels in the artwork.
- Keep the SVG valid XML, with a single <svg> root, and use standard SVG elements and attributes.
- Before responding, verify that every group encodes exactly one character, the sequence decodes to the supplied message, word gaps are clear, and every symbol is visible and countable.

Output the raw <svg>...</svg> first, followed by one final line beginning exactly with SCHEME: that explains the visual encoding without revealing the secret message.`;

const SEEK='This picture may hide a secret message encoded in its visual structure. Inspect repeated objects, counts, geometry, colours, positions, and grouping. You cannot run code, so reason from visible evidence. First divide the scene into repeated groups in reading order, usually one group per letter. Systematically test counts from 1 to 26 as A=1 through Z=26. If you see flowers, count each visible petal individually and do not count the flower centre; check whether each flower is one letter. Also inspect polygon sides, dots, windows, bars, orientations, colour sequences, and Morse-like marks. Ignore decorative background details that are not repeated consistently. Verify that one rule explains every group before answering. Do not answer NONE merely because the first pattern is unclear. Prefer a complete, internally consistent decoding; use NONE only if no defensible rule explains the entire image. Reply in exactly two lines:\nMESSAGE: <recovered text, or NONE>\nMETHOD: <one sentence explaining the visual evidence and mapping>';

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
