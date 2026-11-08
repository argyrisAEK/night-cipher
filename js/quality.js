// Pure helpers for measuring blind Seeker recovery.
export function parseSeekerResponse(output){
  const text=String(output||'');
  const message=(text.match(/^MESSAGE:\s*(.*)$/im)||[])[1];
  if(message==null)throw new Error('The model returned no valid MESSAGE line.');
  const method=(text.match(/^METHOD:\s*(.*)$/im)||[])[1]||'(none given)';
  return {message:message.trim(),method:method.trim()};
}
export function compareSeekers(primary,independent){
  if(!primary||!independent)return {complete:false,agreement:null,bothExact:false};
  const a=String(primary.normalized||''),b=String(independent.normalized||'');
  return {complete:true,agreement:a===b,bothExact:primary.exactMatch===true&&independent.exactMatch===true,primaryExact:primary.exactMatch===true,independentExact:independent.exactMatch===true};
}