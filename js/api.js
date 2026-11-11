const API='https://gen.pollinations.ai/v1';


export function createChat({getConnection,getTokenCount,setTokenCount,onUsage}){
  return async function chat(model,messages,max,timeoutMs=90000,{requestType='chat',onRawResponse}={}){
    const connection=getConnection();
    const key=connection&&connection.apiKey;
    if(!key)throw Error('Connect your Pollinations account first (button, top right).');
    let r;
    for(let attempt=0;attempt<3;attempt++){
      const ac=new AbortController();
      const t=setTimeout(()=>ac.abort(),Math.max(10000,Math.min(timeoutMs,180000)));
      try{
        r=await fetch(API+'/chat/completions',{
          method:'POST',
          headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
          body:JSON.stringify({model,messages,max_tokens:max}),
          signal:ac.signal
        });
      }catch(e){
        throw e.name==='AbortError'
          ?Error('Request timed out. Try a faster model or a shorter prompt.')
          :e;
      }finally{clearTimeout(t)}
      if(r.ok)break;
      const retryable=r.status===429||(r.status>=500&&r.status<=599);
      if(retryable&&attempt<2){
        const header=r.headers.get('Retry-After');
        let retryAfterMs=0;
        if(header){
          const seconds=Number(header);
          if(Number.isFinite(seconds)&&seconds>=0)retryAfterMs=seconds*1000;
          else{
            const date=Date.parse(header);
            if(Number.isFinite(date))retryAfterMs=Math.max(0,date-Date.now());
          }
        }
        const delayMs=Math.min(5000,Math.max(500*(2**attempt),retryAfterMs));
        await new Promise(resolve=>setTimeout(resolve,delayMs));
        continue;
      }
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
    onRawResponse?.({text,model:j.model||model,finishReason:choice?.finish_reason||null,usage:j.usage||null,promptTokens:j.usage?.prompt_tokens??null,completionTokens:j.usage?.completion_tokens??null,totalTokens:j.usage?.total_tokens??null});
    if(requestType==='hider'&&!/<svg[\\s\\S]*?<\\/svg>/i.test(text)){
      const finishReason=choice?.finish_reason||'not provided';
      const completionTokens=j.usage?.completion_tokens??'not provided';
      const responseModel=j.model||model;
      throw Error(`Hider returned no complete SVG (model: ${responseModel}; finish_reason: ${finishReason}; completion_tokens: ${completionTokens}). Try a faster model or a shorter message.`);
    }
    if(content==null)throw Error('The API returned no message content.');
    return text;
  }
}

const HIDE_BASE=(msg,easy)=>`You are the AI HIDER in NIGHT CIPHER, a visual steganography challenge inspired by the idea of hiding a message inside an ordinary image.

YOUR PRIVATE TASK
Hide this exact message in the visual content of one convincing, natural-looking scene:
${msg}
Never print the message, any complete word from it, or readable letter/number labels in the artwork.

THE IMAGE MUST LOOK LIKE A REAL ILLUSTRATION, NOT A CIPHER WORKSHEET
- Create a coherent, beautiful, believable scene that could stand alone as editorial illustration or cinematic concept art: a quiet night street, an old observatory, a greenhouse, a harbour, a library, a garden, a train station, a café, a village, or another suitable everyday scene.
- The hidden structure must be part of the scene itself: for example, naturally distributed lit windows, flowers and petals, objects on shelves, lanterns, stars, boats, birds, architectural details, repeated ornaments, or meaningful spatial relationships.
- Avoid obvious rows of identical tokens, grids, panels, letter slots, isolated groups, labels, diagrams, legends, charts, symbols floating on empty backgrounds, or anything that announces “this is a puzzle”.
- Do not add a visible key or clue unless Friendly mode is enabled. In Friendly mode, include only a subtle in-world clue, never written instructions.
- Make the encoding subtle enough to pass as part of the scene, but consistent and visually recoverable by a careful observer.
- Prefer one simple, consistent visual rule that can be explained precisely. Choose a representation that can carry every character and preserve word boundaries. Do not silently omit, reorder, or substitute characters.
- Use natural reading order and natural group boundaries where possible. Word spaces should be represented by clear but plausible gaps or scene divisions.
- Do not rely on tiny details, ambiguous overlaps, perspective tricks, colour differences that vanish in grayscale, or elements that are too numerous to count reliably.
- Choose the scene and encoding together so that the message fits organically. Vary the scene between rounds; do not default to constellations or houses.

VISUAL QUALITY
- Night Cipher's palette may use midnight navy, indigo, muted plum, restrained teal and warm amber, but the scene should feel naturally lit rather than decorated with a repeated “cipher” motif.
- Use layered depth, thoughtful composition, subtle lighting and coherent object design. The artwork should look finished and intentional.
- The hidden message should not dominate the image. A casual viewer should see an attractive ordinary scene; a careful observer should be able to infer that some repeated visual feature is meaningful.

SVG REQUIREMENTS
- Return one self-contained SVG with viewBox="0 0 800 500".
- Use valid XML and ordinary SVG vector elements. No external images, fonts, links, scripts, foreignObject, embedded raster data or network resources.
- No visible text, alphabet characters, digits, labels, captions, title, description, comments or metadata in the image. Use neutral IDs unrelated to the secret.
- Keep all meaningful visual details large enough to survive rasterization to a 1024px PNG.
- Keep the markup compact (see OUTPUT BUDGET below) without making the scene poor.
- Before answering, internally decode your own design from the scene and check that it reproduces the exact message, including word boundaries.

OUTPUT BUDGET
- Aim for roughly 60–150 SVG elements and under ~8 KB of markup. Build richness from a few well-chosen shapes, not from many.
- Use at most 3 depth layers (background, midground, foreground), flat fills, at most one gradient, and no filters or blur unless they carry meaning.
- Prefer rect, circle, ellipse, polygon and short paths (under ~12 points). Round every coordinate to a whole number.
- Define a repeated shape once in <defs> and repeat it with <use href="#id" x=".." y=".."> (write href, never xlink:href). Place groups with transform on <g>. Keep elements separate when their size, colour or orientation carries the encoding.
- No default attributes, no comments, short ids (a1, b2). Style only with inline attributes.
- Allowed elements ONLY: svg, g, defs, symbol, use, rect, circle, ellipse, line, polyline, polygon, path, linearGradient, radialGradient, stop, clipPath, mask, filter. Anything else (style, pattern, marker, animate, image, text, title, desc) causes the picture to be rejected or stripped.
- If the budget and decoding accuracy conflict, accuracy wins. If the budget and decoration conflict, the budget wins.
- Output the SVG immediately, then the SCHEME line (maximum 40 words). No planning text before the SVG.

PRIVATE EXPLANATION
After the SVG, output exactly one final line beginning with SCHEME: followed by a concise explanation of the visual rule, reading order, character mapping and word-boundary convention. This explanation is private game metadata and must never be included in the image or sent to the Seeker.
Return the raw SVG first, then the SCHEME line. Do not include Markdown fences or any other prose.

DIFFICULTY
${easy?'Friendly: include one subtle, in-world visual clue that helps infer the rule without explicitly stating it.':'Paper mode: no legend, written hint, or conspicuous reference pattern.'}`;
const HIDE=(msg,easy)=>HIDE_BASE(msg,easy);

const SEEK='You are the blind AI SEEKER in a visual steganography challenge. The image may contain a hidden message, but the encoding method is unknown. You receive no secret, no legend, no explanation and no hints.\n\nStudy the entire image as a coherent scene first. Look for visual details that may carry information while still belonging naturally in the scene: repeated objects, counts, arrangements, relative positions, spacing, colours, shapes, orientations, architectural details, natural patterns and meaningful absences. Consider whether the scene itself suggests a reading order or grouping.\n\nDevelop and compare plausible encoding hypotheses. Do not assume the answer uses A=1, binary, Morse, flowers, stars, windows or any other familiar scheme. Do not force an interpretation onto decorative details. A valid decoding should explain the relevant evidence consistently, preserve word boundaries, and account for the whole message rather than just a few letters. Re-check the interpretation against the image before answering. If the evidence is genuinely insufficient, say NONE rather than inventing a message.\n\nReply in exactly two lines:\nMESSAGE: <recovered message, or NONE>\nMETHOD: <one concise sentence describing the visual evidence and inferred mapping>';

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
    return 'Second-pass blind visual analysis. Re-examine the whole scene without relying on the previous guess. Identify the specific visual evidence that could carry information, compare alternative explanations, and test whether one consistent rule accounts for the complete sequence and its word boundaries. Do not assume a familiar cipher or invent details that are not visible. Keep only a decoding supported by the image. Reply in exactly two lines:\nMESSAGE: <recovered message, or NONE>\nMETHOD: <one concise sentence describing the evidence and inferred mapping>';
  }
  return SEEK;
};

export { HIDE, SEEK, buildSeekPrompt };
