import { createDecipheriv, createHash } from 'node:crypto';
const send=(res,data,status=200)=>{res.statusCode=status;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.end(JSON.stringify(data))};
const readBody=async req=>{if(req.body&&typeof req.body==='object')return req.body;if(typeof req.body==='string')return JSON.parse(req.body);let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1000000)throw Error('Request body is too large.')}return JSON.parse(raw||'{}')};
const secretKey=()=>{const raw=process.env.NIGHT_CIPHER_ROUND_SECRET;if(!raw||raw.length<32)throw Error('Vercel environment variable NIGHT_CIPHER_ROUND_SECRET must contain at least 32 characters.');return createHash('sha256').update(raw).digest()};
const openToken=token=>{
 const bytes=Buffer.from(String(token||''),'base64url');if(bytes.length<29||bytes.length>12000)throw Error('Invalid or expired round token.');
 const iv=bytes.subarray(0,12),tag=bytes.subarray(12,28),data=bytes.subarray(28),decipher=createDecipheriv('aes-256-gcm',secretKey(),iv);decipher.setAuthTag(tag);
 return JSON.parse(Buffer.concat([decipher.update(data),decipher.final()]).toString('utf8'));
};
export default async function handler(req,res){
 if(req.method!=='POST')return send(res,{error:'Method not allowed.'},405);
 try{
  const {revealToken}=await readBody(req),payload=openToken(revealToken);
  if(!payload.plan||!Array.isArray(payload.layout)||typeof payload.secret!=='string')return send(res,{error:'Round data is incomplete.'},400);
  const letters=payload.secret.replace(/ /g,'').split(''),annotations=payload.layout.map((box,i)=>({...box,letter:letters[i]||'?'}));
  return json({message:payload.secret,method:payload.plan.label,rule:payload.plan.rule,scene:payload.plan.scene,annotations});
 }catch(error){return json({error:error?.message||'Could not reveal this round.'},400)}
}
