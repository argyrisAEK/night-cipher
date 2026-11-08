const API='https://gen.pollinations.ai/v1';


export function createChat({getConnection,getTokenCount,setTokenCount,onUsage}){
  return async function chat(model,messages,max,timeoutMs=90000,{requestType='chat',onRawResponse}={}){
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
      onRawResponse?.({text,model:j.model||model,finishReason:choice?.finish_reason||null,completionTokens:j.usage?.completion_tokens??null});
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
- Before answering, internally decode your own design from the scene and check that it reproduces the exact message, including word boundaries.

PRIVATE EXPLANATION
After the SVG, output exactly one final line beginning with SCHEME: followed by a concise explanation of the visual rule, reading order, character mapping and word-boundary convention. This explanation is private game metadata and must never be included in the image or sent to the Seeker.
Return the raw SVG first, then the SCHEME line. Do not include Markdown fences or any other prose.

DIFFICULTY
${easy?'Friendly: include one subtle, in-world visual clue that helps infer the rule without explicitly stating it.':'Paper mode: no legend, written hint, or conspicuous reference pattern.'}`;
const HIDE=(msg,easy)=>HIDE_BASE(msg,easy);

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
