import { desc, eq } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { getDb } from '../../../db';
import { requests } from '../../../db/schema';
import { getChatGPTUser } from '../../chatgpt-auth';
import {publicCors,publicOptions} from '../cors';
async function allowed(){const u=await getChatGPTUser();return !!u && !!(env as any).ADMIN_EMAIL && u.email.toLowerCase()===String((env as any).ADMIN_EMAIL).toLowerCase();}
async function notifyOwner(){
 const vars=env as any;
 if(!vars.RESEND_API_KEY||!vars.NOTIFY_EMAIL||!vars.NOTIFY_FROM){console.error('Request email notification is not configured');return;}
 try{
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${vars.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:vars.NOTIFY_FROM,to:[vars.NOTIFY_EMAIL],subject:'文献查询：有新的人工需求',text:'有客户提交了新的文献查询需求，请登录商家后台查看：\nhttps://literature-finder-26471.genial-seed-5139.chatgpt.site/admin'})});
  if(!response.ok)console.error('Request notification email failed',response.status);
 }catch{console.error('Request notification email could not be sent');}
}
async function post(req:Request){
 try {const b=await req.json() as any; const query=String(b.query||'').trim(),contact=String(b.contact||'').trim();
  if(!query||!contact||query.length>500||contact.length>100)return Response.json({error:'请填写文献题名或 DOI 和小红书订单号或昵称。'},{status:400});
  await getDb().insert(requests).values({query,contact}); await notifyOwner(); return Response.json({ok:true});
 } catch{return Response.json({error:'提交失败，请稍后重试。'},{status:500});}
}
export async function POST(req:Request){return publicCors(await post(req));}
export function OPTIONS(){return publicOptions();}
export async function GET(){
 if(!await allowed())return Response.json({error:'请使用店主账号登录。'},{status:403});
 const rows=await getDb().select().from(requests).orderBy(desc(requests.id)).limit(200);return Response.json({rows});
}
export async function PATCH(req:Request){
 if(!await allowed())return Response.json({error:'无权限'},{status:403});
 const b=await req.json() as any;if(!Number.isInteger(b.id)||!['待处理','已处理'].includes(b.status))return Response.json({error:'参数错误'},{status:400});
 await getDb().update(requests).set({status:b.status}).where(eq(requests.id,b.id));return Response.json({ok:true});
}
