// Pure helpers for measuring blind Seeker recovery.
const normalize = value => String(value ?? '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
const commonPromptWords = new Set(['A','AN','AND','ARE','AS','AT','BE','BUT','BY','CAN','DO','FOR','FROM','HAS','HAVE','HOW','IN','IS','IT','ITS','ME','MY','NOT','OF','ON','OR','OUR','OUT','THE','THEM','THEN','THERE','THIS','TO','TWO','UP','US','WAS','WE','WERE','WHAT','WHEN','WHERE','WHO','WILL','WITH','YOU','YOUR','ONE','WAY']);
export const normalizeMessage = value => normalize(value);

export function messageSimilarity(a,b){
  a=normalize(a);b=normalize(b);
  if(!a||!b||a.split(' ').length!==b.split(' ').length)return 0;
  const d=Array.from({length:a.length+1},(_,i)=>[i,...Array(b.length).fill(0)]);
  for(let j=1;j<=b.length;j++)d[0][j]=j;
  for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  return 1- d[a.length][b.length]/Math.max(a.length,b.length);
}

export function parseSeekerResponse(output){
  const text=String(output||'');
  const message=(text.match(/^MESSAGE:\s*(.*)$/im)||[])[1];
  if(message==null)throw new Error('The model returned no valid MESSAGE line.');
  const method=(text.match(/^METHOD:\s*(.*)$/im)||[])[1]||'(none given)';
  return {message:message.trim(),method:method.trim()};
}

// Audits the locally constructed request immediately before dispatch.
// It does not prove what a remote provider may do internally.
export function auditBlindRequest({prompt,secret,scheme,imageAttached,schemeExpected=false}){
  const p=normalize(prompt),s=normalize(secret),sc=normalize(scheme);
  const singleCommonWord=s.split(' ').length===1&&commonPromptWords.has(s);
  const secretExcluded=!s||singleCommonWord||!(` ${p} `).includes(` ${s} `);
  const schemeIncluded=!!sc&&(` ${p} `).includes(` ${sc} `);
  const schemeExcluded=!schemeIncluded;
  const schemeValid=schemeExpected?schemeIncluded:schemeExcluded;
  const hasImage=imageAttached===true;
  return {verified:hasImage&&secretExcluded&&schemeValid,imageAttached:hasImage,secretExcluded,schemeExcluded,schemeIncluded,schemeExpected,schemeValid};
}

export function compareSeekers(primary,independent){
  const hasPrimary=!!primary&&typeof primary.exactMatch==='boolean';
  const hasIndependent=!!independent&&typeof independent.exactMatch==='boolean';
  const comparable=hasPrimary&&hasIndependent&&!!primary.normalized&&!!independent.normalized;
  return {
    complete:hasPrimary&&hasIndependent,
    agreement:comparable?primary.normalized===independent.normalized:null,
    bothExact:hasPrimary&&hasIndependent?(primary.exactMatch===true&&independent.exactMatch===true):null,
    primaryExact:hasPrimary?primary.exactMatch:null,
    independentExact:hasIndependent?independent.exactMatch:null
  };
}
