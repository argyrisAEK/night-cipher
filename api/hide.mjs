import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { pickPlan, decodePlan } from '../server/encoding.mjs';

const API='https://gen.pollinations.ai/v1/chat/completions';
const SVG_TAGS=new Set(['svg','g','defs','rect','circle','ellipse','line','polyline','polygon','path','linearGradient','radialGradient','stop','filter','feGaussianBlur','feMerge','feMergeNode','feColorMatrix','feOffset','feBlend','feComposite','clipPath','mask']);
const SVG_ATTRS=new Set(('xmlns viewBox width height x y x1 y1 x2 y2 cx cy r rx ry d points fill fill-opacity fill-rule stroke stroke-width stroke-opacity stroke-linecap stroke-linejoin stroke-dasharray stroke-dashoffset opacity transform id class offset stop-color stop-opacity gradientUnits gradientTransform spreadMethod fx fy fr filterUnits primitiveUnits stdDeviation result in in2 type values operator k1 k2 k3 k4 dx dy mode color-interpolation-filters clip-path clip-rule mask maskUnits maskContentUnits preserveAspectRatio').split(' '));
const send=(res,data,status=200)=>{res.statusCode=status;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.end(JSON.stringify(data))};
const readBody=async req=>{if(req.body&&typeof req.body==='object')return req.body;if(typeof req.body==='string')return JSON.parse(req.body);let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1000000)throw Error('Request body is too large.')}return JSON.parse(raw||'{}')};
const normalize=s=>String(s).toUpperCase().replace(/[^A-Z ]/g,' ').trim().replace(/ +/g,' ');
const secretKey=()=>{const raw=process.env.NIGHT_CIPHER_ROUND_SECRET;if(!raw||raw.length<32)throw Error('Vercel environment variable NIGHT_CIPHER_ROUND_SECRET must contain at least 32 characters.');return createHash('sha256').update(raw).digest()};
const seal=value=>{const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',secretKey(),iv),data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64url')};
const openToken=token=>{const bytes=Buffer.from(String(token||''),'base64url');if(bytes.length<29||bytes.length>12000)throw Error('Previous round token is invalid.');const decipher=createDecipheriv('aes-256-gcm',secretKey(),bytes.subarray(0,12));decipher.setAuthTag(bytes.subarray(12,28));return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8'))};
const safeSvg=raw=>{
 if(typeof raw!=='string'||raw.length>500000)throw Error('Hider artwork is missing or exceeds the 500 KB limit.');
 const match=raw.match(/<svg\b[\s\S]*?<\/svg>/i);if(!match)throw Error('Hider returned no complete SVG.');
 let source=match[0].replace(/<!--[\s\S]*?-->/g,'').replace(/<\?xml[^>]*\?>/gi,'');
 if(/<(?:script|foreignObject|image|text|style|iframe|audio|video)\b/i.test(source))throw Error('Hider artwork contains an unsupported or unsafe SVG element.');
 const tokens=source.match(/<[^>]+>|[^<]+/g)||[],stack=[];let output='',rootSeen=false,rootClosed=false;
 for(const token of tokens){
  if(!token.startsWith('<')){if(token.trim())throw Error('Text nodes are not allowed in Hider artwork.');continue}
  if(/^<\s*!|^<\?/.test(token))throw Error('SVG declarations and entities are not allowed.');
  const close=/^<\s*\//.test(token),name=(token.match(/^<\s*\/?\s*([\w:-]+)/)||[])[1];
  if(!name||!SVG_TAGS.has(name))throw Error('Hider artwork contains an unsupported SVG tag.');
  if(close){if(stack.pop()!==name)throw Error('Hider artwork has malformed SVG/XML nesting.');output+=`</${name}>`;if(!stack.length)rootClosed=true;continue}
  if(!rootSeen){if(name!=='svg')throw Error('SVG root element is required.');rootSeen=true}
  else if(rootClosed)throw Error('SVG contains content after its root element.');
  const attrText=token.slice(token.indexOf(name)+name.length,token.length-(token.endsWith('/>')?2:1));
  const attrs=[];const re=/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;let a;
  while((a=re.exec(attrText))){const key=a[1],value=a[3]??a[4]??'';if(!SVG_ATTRS.has(key)||key==='xmlns'&&name!=='svg')continue;
   if(value.length>10000||/(?:javascript:|data:|https?:|\/\/|@import|expression\s*\()/i.test(value))continue;
   if(/url\s*\(/i.test(value)&&!/^url\(\s*#[\w.-]+\s*\)$/i.test(value))continue;
   if(key==='id'&&!/^[\w.-]{1,80}$/.test(value))continue;
   attrs.push(`${key}="${value.replace(/&(?!(?:amp|lt|gt|quot|apos);)/g,'&amp;').replace(/"/g,'&quot;')}"`);
  }
  if(name==='svg'){
   const existing=attrs.filter(x=>!/^viewBox=|^width=|^height=|^xmlns=/.test(x));
   output='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="800" height="500" '+existing.join(' ')+'>'; 
  }else output=`<${name}${attrs.length?' '+attrs.join(' '):''}${/\/\s*>$/.test(token)?'/>':'>'}`;
  if(!/\/\s*>$/.test(token))stack.push(name);
 }
 if(!rootSeen||stack.length||!rootClosed)throw Error('Hider artwork is incomplete or malformed.');
 return output;
};
const rng=seed=>{let x=seed>>>0;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296}};
const renderOverlay=(plan,nonce)=>{
 const letters=plan.groups.reduce((n,w)=>n+w.length,0),slots=letters+Math.max(0,plan.groups.length-1);
 const cols=Math.min(6,Math.max(3,Math.ceil(Math.sqrt(slots*1.25)))),rows=Math.ceil(slots/cols),cw=620/cols,ch=260/rows,random=rng(parseInt(nonce.slice(0,8),16)||1);
 let slot=0,markup='',layout=[];
 for(let wi=0;wi<plan.groups.length;wi++){
  if(wi)slot++;
  for(const symbol of plan.groups[wi]){
   const col=slot%cols,row=Math.floor(slot/cols),cx=90+(col+.5)*cw+(random()-.5)*cw*.18,cy=75+(row+.5)*ch+(random()-.5)*ch*.16;
   const box={x:cx-cw*.34,y:cy-ch*.34,w:cw*.68,h:ch*.68,letter:String.fromCharCode(65+(plan.method==='counts'?Number(symbol)-1:plan.method==='binary'?parseInt(symbol,2)-1:0)),word:wi};
   layout.push(box);
   let points=[];
   if(plan.method==='counts'){
    const count=Number(symbol),grid=Array.from({length:30},(_,i)=>i).sort(()=>random()-.5).slice(0,count);
    for(const i of grid){const px=cx+((i%6)-2.5)*6.2+(random()-.5)*1.8,py=cy+(Math.floor(i/6)-2)*6.2+(random()-.5)*1.8;points.push([px,py]);}
   }else if(plan.method==='binary'){
    [...symbol].forEach((bit,i)=>points.push([cx+(i-2)*10,cy,bit]));
   }else{
    [...symbol].forEach((mark,i)=>points.push([cx+(i-(symbol.length-1)/2)*10,cy,mark]));
   }
   if(points.length>1)markup+=`<path d="${points.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ')}" fill="none" stroke="#d8b77f" stroke-opacity=".18" stroke-width=".8"/>`;
   for(const p of points){
    if(plan.method==='counts')markup+=`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${(1.5+random()*.7).toFixed(1)}" fill="#f1c987" fill-opacity=".92"/>`;
    else if(plan.method==='binary')markup+=p[2]==='1'? `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="#f1c987"/>`:`<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="#171a2b" stroke="#a78e75" stroke-opacity=".85" stroke-width="1"/>`;
    else markup+=p[2]==='.'?`<circle cx="${p[0]}" cy="${p[1]}" r="2.5" fill="#f1c987"/>`:`<rect x="${(p[0]-4).toFixed(1)}" y="${(p[1]-1.6).toFixed(1)}" width="8" height="3.2" rx="1.6" fill="#f1c987"/>`;
   }
   slot++;
  }
 }
 return {markup,layout};
};
const makePrompt=scene=>`Create a premium, atmospheric SVG illustration for NIGHT CIPHER. Scene: ${scene}. It must look like an ordinary cinematic night landscape or place, not a puzzle worksheet, infographic, chart, or diagram. Deep midnight navy, indigo and muted plum, restrained antique-gold lighting, layered depth, subtle gradients and fine natural detail. Use viewBox="0 0 800 500". Keep the central upper/middle sky visually calm and relatively uncluttered so a few tiny distant lights can naturally belong there. Do not draw constellations, repeated groups, rows, dots, bars, symbols, letters, numbers, labels, text, legends or any encoded pattern; those will be added separately. Return only one self-contained SVG using vector shapes and gradients; no external images, fonts, links, scripts, foreignObject, text, metadata or comments.`;
export default async function handler(req,res){
 if(req.method!=='POST')return send(res,{error:'Method not allowed.'},405);
 try{
  const body=await readBody(req),secret=normalize(body.secret),model=String(body.model||'').trim(),apiKey=String(body.pollinationsKey||'');
  if(!/^[A-Z ]{3,24}$/.test(secret)||secret.replace(/ /g,'').length<3)return send(res,{error:'Secret must contain 3–24 A–Z characters.'},400);
  if(!model||model.length>160||!apiKey||apiKey.length>4096)return json({error:'A Hider model and Pollinations connection are required.'},400);
  const previous=body.previousRoundToken?openToken(body.previousRoundToken):null;
  const plan=pickPlan(secret,{lastMethod:previous?.plan?.method||'',lastScene:previous?.plan?.scene||'',round:Date.now()});
  if(decodePlan(plan)!==secret)return json({error:'Internal encoding round-trip validation failed.'},500);
  const prompt=makePrompt(plan.scene),started=Date.now();
  const response=await fetch(API,{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify({model,messages:[{role:'system',content:'You are a skilled SVG illustrator. Create the artwork only; do not encode or infer any secret.'},{role:'user',content:prompt}],max_tokens:12000})});
  if(!response.ok){const detail=await response.text().catch(()=> '');return json({error:`Pollinations Hider request failed (${response.status}): ${detail.slice(0,300)}`},502)}
  const result=await response.json(),choice=result.choices?.[0],raw=choice?.message?.content;
  if(typeof raw!=='string')return json({error:'Pollinations returned no Hider artwork.'},502);
  const background=safeSvg(raw),{markup,layout}=renderOverlay(plan,randomBytes(8).toString('hex'));
  const svg=background.replace(/<\/svg>\s*$/i,markup+'</svg>');
  if(svg.length>500000)return json({error:'Rendered SVG exceeds the size limit.'},502);
  const tokenPayload={secret,plan,layout,createdAt:Date.now()};
  const revealToken=seal(tokenPayload);
  return json({svg,revealToken,usage:result.usage||null,model:result.model||model,finishReason:choice.finish_reason||null,completionTokens:result.usage?.completion_tokens??null,durationMs:Date.now()-started,validation:{svgValid:true,encodingValid:decodePlan(plan)===secret,secretLeak:false},prompt,rawResponse:raw});
 }catch(error){return json({error:error?.message||'Hider generation failed.'},500)}
}
