// Pure helpers for measuring blind Seeker recovery.
const normalize = value => String(value ?? '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]/gu,'');

export function parseSeekerResponse(output){
  const text=String(output||'');
  const message=(text.match(/^MESSAGE:\s*(.*)$/im)||[])[1];
  if(message==null)throw new Error('The model returned no valid MESSAGE line.');
  const method=(text.match(/^METHOD:\s*(.*)$/im)||[])[1]||'(none given)';
  return {message:message.trim(),method:method.trim()};
}

// Audits the locally constructed request immediately before dispatch.
// It does not prove what a remote provider may do internally.
export function auditBlindRequest({prompt,secret,scheme,imageAttached}){
  const p=normalize(prompt),s=normalize(secret),sc=normalize(scheme);
  const secretExcluded=!s||!p.includes(s);
  const schemeExcluded=!sc||!p.includes(sc);
  const hasImage=imageAttached===true;
  return {verified:hasImage&&secretExcluded&&schemeExcluded,imageAttached:hasImage,secretExcluded,schemeExcluded};
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
