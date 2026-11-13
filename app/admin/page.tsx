"use client";
import {useEffect,useState} from 'react';
type Row={id:number;query:string;contact:string;status:string;createdAt:string};
export default function Admin(){const [rows,R]=useState<Row[]>([]),[error,E]=useState(''),[loading,L]=useState(true);
 async function load(){try{const r=await fetch('/api/requests',{cache:'no-store'});const x:any=await r.json();if(!r.ok)throw Error(x.error);R(x.rows);E('')}catch(e){E(e instanceof Error?e.message:'加载失败')}finally{L(false)}}
 useEffect(()=>{load()},[]);
 async function toggle(row:Row){const r=await fetch('/api/requests',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({id:row.id,status:row.status==='待处理'?'已处理':'待处理'})});if(r.ok)load();else E('更新失败，请重试。')}
 return <main><header><strong>文献查询 · 商家后台</strong><a href="/">返回查询</a></header><section className="admin"><span className="eyebrow">REQUESTS</span><h1>人工查询需求</h1><p>在小红书联系客户并回复结果。时间为 UTC。</p>{loading&&<p>加载中…</p>}{error&&<div className="notice">{error} <a href="/signin-with-chatgpt?return_to=%2Fadmin">使用店主账号登录</a></div>}{!loading&&!error&&rows.length===0&&<div className="empty">暂无查询需求。</div>}{rows.map(row=><article className="result" key={row.id}><div className="section-head"><span className="tag">{row.status} · #{row.id}</span><small>{row.createdAt}</small></div><h3>{row.query}</h3><p>订单号 / 昵称：{row.contact}</p><button className="secondary" onClick={()=>toggle(row)}>{row.status==='待处理'?'标记已处理':'恢复待处理'}</button></article>)}</section></main>}
