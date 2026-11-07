import { createDecipheriv, createHash } from 'node:crypto';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const secretKey=()=>{const raw=process.env.NIGHT_CIPHER_ROUND_SECRET;if(!raw||raw.length<32)throw Error('Vercel environment variable NIGHT_CIPHER_ROUND_SECRET must contain at least 32 characters.');return createHash('sha256').update(raw).digest()};
const openToken=token=>{
 const bytes=Buffer.from(String(token||''),'base64url');if(bytes.length<29||bytes.length>12000)throw Error('Invalid or expired round token.');
 const iv=bytes.subarray(0,12),tag=bytes.subarray(12,28),data=bytes.subarray(28),decipher=createDecipheriv('aes-256-gcm',secretKey(),iv);decipher.setAuthTag(tag);
 return JSON.parse(Buffer.concat([decipher.update(data),decipher.final()]).toString('utf8'));
};
export default async function handler(req){
 if(req.method!=='POST')return json({error:'Method not allowed.'},405);
 try{
  const {revealToken}=await req.json(),payload=openToken(revealToken);
  if(!payload.plan||!Array.isArray(payload.layout)||typeof payload.secret!=='string')return json({error:'Round data is incomplete.'},400);
  const letters=payload.secret.replace(/ /g,'').split(''),annotations=payload.layout.map((box,i)=>({...box,letter:letters[i]||'?'}));
  return json({message:payload.secret,method:payload.plan.label,rule:payload.plan.rule,scene:payload.plan.scene,annotations});
 }catch(error){return json({error:error?.message||'Could not reveal this round.'},400)}
}
