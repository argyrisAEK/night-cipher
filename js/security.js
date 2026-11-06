const norm=s=>String(s).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]/gu,'');

const uri=s=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(s);
const toRaster=(svg,type='image/png',quality)=>new Promise((ok,no)=>{const i=new Image();i.onload=()=>{try{const c=document.createElement('canvas');c.width=1024;c.height=Math.round(1024*(i.naturalHeight||500)/(i.naturalWidth||800));const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(i,0,0,c.width,c.height);const data=c.toDataURL(type,quality);if(!data.startsWith('data:'+type))throw Error('This browser could not encode '+type+'.');ok(data)}catch(e){no(e)}};i.onerror=()=>no(Error('Could not render the SVG'));i.src=uri(svg)});
const toPng=svg=>toRaster(svg,'image/png');
const clean=raw=>{
  if(typeof raw!=='string'||raw.length>500000)throw Error('SVG is too large or invalid.');
  let d=new DOMParser().parseFromString(raw,'image/svg+xml');
  if(d.querySelector('parsererror'))throw Error('The hider returned malformed SVG/XML. Try again or pick another model.');
  let s=d.documentElement,NS='http://www.w3.org/2000/svg';
  if(!s||s.localName.toLowerCase()!=='svg')throw Error('The response must have an SVG root element.');
  if(!s.namespaceURI){
    raw=raw.replace(/<svg\b/i,'<svg xmlns="http://www.w3.org/2000/svg"');
    d=new DOMParser().parseFromString(raw,'image/svg+xml');
    if(d.querySelector('parsererror'))throw Error('The hider returned malformed SVG/XML. Try again or pick another model.');
    s=d.documentElement;
  }
  if(s.namespaceURI!==NS)throw Error('The SVG root must use the SVG namespace.');
  s.querySelectorAll('script,foreignObject,image,metadata,title,desc').forEach(e=>e.remove());
  const allowed=new Set(['svg','g','defs','rect','circle','ellipse','line','polyline','polygon','path','text','tspan','linearGradient','radialGradient','stop','filter','feGaussianBlur','feMerge','feMergeNode','feColorMatrix','feOffset','feBlend','feComposite','clipPath','mask','use']);
  const attrs=new Set(('xmlns viewBox width height x y x1 y1 x2 y2 cx cy r rx ry d points fill fill-opacity fill-rule stroke stroke-width stroke-opacity stroke-linecap stroke-linejoin stroke-dasharray stroke-dashoffset opacity transform id class offset stop-color stop-opacity gradientUnits gradientTransform spreadMethod fx fy fr filterUnits primitiveUnits stdDeviation result in in2 type values operator k1 k2 k3 k4 dx dy mode color-interpolation-filters clip-path clip-rule mask maskUnits maskContentUnits preserveAspectRatio text-anchor dominant-baseline font-family font-size font-weight font-style letter-spacing word-spacing href style').split(' '));
  const styleProps=new Set(['fill','fill-opacity','fill-rule','stroke','stroke-width','stroke-opacity','stroke-linecap','stroke-linejoin','stroke-dasharray','stroke-dashoffset','opacity','color','font-family','font-size','font-weight','font-style','letter-spacing','word-spacing','text-anchor','dominant-baseline','stop-color','stop-opacity','clip-path','clip-rule','mask','filter']);
  const safeStyle=value=>value.split(';').map(part=>{
    const at=part.indexOf(':');if(at<1)return '';
    const prop=part.slice(0,at).trim().toLowerCase(),v=part.slice(at+1).trim();
    if(!styleProps.has(prop)||!v||v.length>1000||/[\\{}<>@]/.test(v)||/(?:javascript:|data:|https?:|expression\s*\(|var\s*\(|@import)/i.test(v))return '';
    if(/url\s*\(/i.test(v)&&!/^url\(\s*#[\w.-]+\s*\)$/i.test(v))return '';
    return prop+':'+v;
  }).filter(Boolean).join(';');
  const elements=[...d.getElementsByTagName('*')];
  if(elements.length>2500)throw Error('SVG contains too many elements.');
  const useRefs=[];
  for(const el of elements){
    if(el.namespaceURI!==NS)throw Error('SVG contains a foreign namespace element.');
    if(!allowed.has(el.localName))throw Error(`Unsupported SVG element: ${el.localName}`);
    for(const a of [...el.attributes]){
      const name=a.name,value=a.value.trim();
      if(!attrs.has(name)){el.removeAttribute(name);continue}
      if(value.length>10000)throw Error('SVG attribute is too large.');
      if(name==='style'){const v=safeStyle(value);if(v)el.setAttribute('style',v);else el.removeAttribute('style');continue}
      if(name==='href'){
        if(el.localName!=='use'||!/^#[\w.-]{1,80}$/.test(value)){el.removeAttribute(name);continue}
        useRefs.push({el,id:value.slice(1)});continue;
      }
      if(/\b(?:nan|infinity)\b/i.test(value)){el.removeAttribute(name);continue}
      if(/url\s*\(/i.test(value)&&!/^url\(\s*#[\w.-]+\s*\)$/i.test(value)){el.removeAttribute(name);continue}
      if(name!=='xmlns'&&/(?:javascript:|data:|https?:|\/\/|@import|expression\s*\()/i.test(value)){el.removeAttribute(name);continue}
      if(name==='id'&&!/^[\w.-]{1,80}$/.test(value))el.removeAttribute(name);
    }
  }
  const ids=new Set([...s.querySelectorAll('[id]')].map(el=>el.getAttribute('id')));
  useRefs.forEach(({el,id})=>{if(!ids.has(id))el.remove()});
  const walker=d.createTreeWalker(s,NodeFilter.SHOW_COMMENT),comments=[];
  while(walker.nextNode())comments.push(walker.currentNode);
  comments.forEach(n=>n.remove());
  const vb=(s.getAttribute('viewBox')||'').trim().split(/[\s,]+/).map(Number);
  if(vb.length!==4||vb.some(n=>!Number.isFinite(n))||vb[2]<=0||vb[3]<=0||vb.some(n=>Math.abs(n)>100000))throw Error('SVG has an invalid viewBox.');
  if(vb[2]>10000||vb[3]>10000)throw Error('SVG dimensions exceed the allowed limit.');
  s.setAttribute('viewBox',vb.join(' '));s.setAttribute('width',String(vb[2]));s.setAttribute('height',String(vb[3]));
  const tw=d.createTreeWalker(s,NodeFilter.SHOW_TEXT),remove=[];
  while(tw.nextNode())if(tw.currentNode.nodeValue.trim()&&!['text','tspan'].includes(tw.currentNode.parentElement?.localName))remove.push(tw.currentNode);
  remove.forEach(n=>n.remove());
  return new XMLSerializer().serializeToString(s);
};
const utf8Base64=s=>{
  const bytes=new TextEncoder().encode(s);let binary='';
  for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
  return btoa(binary);
};
const hasSecretLeak=(svg,secret)=>{
  const d=new DOMParser().parseFromString(svg,'image/svg+xml');if(d.querySelector('parsererror'))return true;
  const values=[d.documentElement.textContent||'',...([...d.querySelectorAll('*')].flatMap(e=>[...e.attributes].filter(a=>a.name!=='xmlns'&&!a.name.startsWith('xmlns:')).map(a=>a.value)))];
  const walker=d.createTreeWalker(d.documentElement,NodeFilter.SHOW_COMMENT),comments=[];
  while(walker.nextNode())comments.push(walker.currentNode.nodeValue||'');
  const raw=[...values,...comments].join(' '),hay=norm(raw);
  const stopwords=new Set(['THE','AND','FOR','ARE','BUT','NOT','YOU','ALL','CAN','HER','WAS','ONE','OUR','OUT','DAY','GET','HAS','HIM','HIS','HOW','ITS','NEW','NOW','OLD','SEE','TWO','WAY','WHO','BOY','DID','SHE','USE','THIS','THAT','WITH','FROM','HAVE','WILL','YOUR','THEM','THEN','THAN','WHEN','WHAT','HERE','BEEN','WERE','SOME','MORE','JUST','LIKE','OVER','ONLY','INTO','BACK','DOWN','EACH']);
  const candidates=[secret,...secret.split(/\s+/).filter(w=>{const n=norm(w);return n.length>=4&&!stopwords.has(n)})];
  for(const c of candidates){
    const n=norm(c);if(n.length>=3&&hay.includes(n))return true;
    try{
      const encoded=encodeURIComponent(c),base64=utf8Base64(c),hex=[...new TextEncoder().encode(c)].map(x=>x.toString(16).padStart(2,'0')).join('');
      if((encoded.length>=6&&raw.includes(encoded))||(base64.length>=6&&raw.includes(base64))||(hex.length>=6&&raw.toLowerCase().includes(hex)))return true;
    }catch{}
  }
  return false;
};

export { uri, toRaster, toPng, clean, utf8Base64, hasSecretLeak };