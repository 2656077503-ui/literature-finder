"use client";

import {useEffect, useState} from 'react';

type Item = {title:string;doi:string;year:string;authors:string;journal:string;pmc:string;pdf:string;abstract?:string};
type Mode = 'exact' | 'topic';
type Record = {id:string;query:string;mode:Mode;items:Item[]};
const STORAGE_KEY = 'literature-search-records-v1';

export default function Home(){
 const [q,Q]=useState(''),[contact,C]=useState(''),[mode,SetMode]=useState<Mode>('exact');
 const [records,SetRecords]=useState<Record[]>([]),[ready,SetReady]=useState(false);
 const [msg,M]=useState(''),[busy,B]=useState(false),[sent,T]=useState(false);

 useEffect(()=>{try{const raw=sessionStorage.getItem(STORAGE_KEY);if(raw){const parsed:unknown=JSON.parse(raw);if(Array.isArray(parsed))SetRecords(parsed.filter((x):x is Record=>Boolean(x&&typeof x==='object'&&typeof x.query==='string'&&Array.isArray(x.items)&&['exact','topic'].includes(x.mode))));}}catch{}SetReady(true)},[]);
 useEffect(()=>{if(ready)try{sessionStorage.setItem(STORAGE_KEY,JSON.stringify(records))}catch{}},[records,ready]);

 async function search(e:React.FormEvent){
  e.preventDefault();const query=q.trim();if(!query)return;B(true);M('');T(false);
  try{
   const endpoint=mode==='topic'?'/api/topic':'/api/search';
   const response=await fetch(endpoint+'?q='+encodeURIComponent(query));
   const data=await response.json() as {error?:string;items?:Item[]};if(!response.ok)throw Error(data.error);
   SetRecords(previous=>[{id:crypto.randomUUID(),query,mode,items:Array.isArray(data.items)?data.items:[]},...previous]);
  }catch(error){M(error instanceof Error?error.message:'查询失败')}
  finally{B(false)}
 }
 async function send(e:React.FormEvent){
  e.preventDefault();B(true);M('');
  try{const response=await fetch('/api/requests',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:q,contact})});const data=await response.json() as {error?:string};if(!response.ok)throw Error(data.error);T(true);M('需求已提交，请在小红书聊天中等待回复。')}
  catch(error){M(error instanceof Error?error.message:'提交失败')}
  finally{B(false)}
 }

 return <main>
  <header><span className="mark">文</span><strong>文献查询服务</strong><a href="/admin">商家后台 →</a></header>
  <section className="hero">
   <span className="eyebrow">LITERATURE FINDER</span><h1>把文献交给我们找</h1>
   <p>输入 DOI 或文献完整题目查找指定文章；只有自己的论文题目，也可以查找相关文献。</p>
   <div className="mode-switch" role="group" aria-label="选择查询方式">
    <button type="button" className={mode==='exact'?'active':''} aria-pressed={mode==='exact'} onClick={()=>SetMode('exact')}>查指定文献</button>
    <button type="button" className={mode==='topic'?'active':''} aria-pressed={mode==='topic'} onClick={()=>SetMode('topic')}>按研究题目找文献</button>
   </div>
   <form onSubmit={search} className="search"><input value={q} onChange={e=>{Q(e.target.value);T(false)}} placeholder={mode==='exact'?'输入 DOI 或文献完整题目':'输入你的论文题目或研究主题'} maxLength={500} required/><button disabled={busy}>{busy?'查询中…':'查找文献'}</button></form>
   <p className="hint">{mode==='exact'?'示例：10.1038/nature12373　或　文章英文标题':'输入研究题目即可检索；英文题目或关键词通常能找到更多结果。候选文献请自行核对相关性。'}</p>
  </section>
  {msg&&<p className="notice" role="status">{msg}</p>}
  {records.length>0&&<section>
   <div className="section-head"><h2>查询结果 <small>({records.length} 次查询)</small></h2><button type="button" className="clear-history" onClick={()=>{SetRecords([]);M('查询记录已清空。')}}>清空记录</button></div>
   {records.map(record=><div className="search-record" key={record.id}>
    <div className="record-head"><span className="tag">{record.mode==='topic'?'研究题目':'指定文献'}</span><strong>{record.query}</strong><span>{record.items.length} 条结果</span></div>
    {record.items.length===0?<div className="empty">暂未找到匹配的文献，可以提交人工查询。</div>:record.items.map((x,i)=><article className="result" key={x.doi||record.id+'-'+i}>
     <span className="tag">文献 {String(i+1).padStart(2,'0')}</span><h3>{x.title}</h3>
     <p>{[x.authors,x.journal,x.year].filter(Boolean).join(' · ')||'出版信息未提供'}</p>
     {record.mode==='topic'&&x.abstract&&<p className="abstract">{x.abstract}</p>}
     <div className="links">{x.doi&&<a href={'https://doi.org/'+encodeURIComponent(x.doi)} target="_blank" rel="noreferrer">出版页面 ↗</a>}{x.pmc?<a className="primary-link" href={x.pmc} target="_blank" rel="noreferrer">免费全文 ↗</a>:!x.pdf&&<span>暂无已确认的免费全文</span>}{x.pdf&&<a className="primary-link" href={x.pdf} target="_blank" rel="noreferrer">PDF 下载 ↗</a>}</div>
    </article>)}
   </div>)}
  </section>}
  <section className="request"><div><span className="eyebrow">NEED HELP?</span><h2>需要人工帮忙？</h2><p>找不到全文，或查询结果不符合要求时，把需求留给我们。请填写订单号或小红书昵称，方便我们在小红书回复你。</p></div><form onSubmit={send}><label>文献 DOI、完整题目或研究主题<textarea value={q} onChange={e=>{Q(e.target.value);T(false);M('')}} maxLength={500} required placeholder="粘贴文献题目、DOI 或研究主题"/></label><label>小红书订单号或昵称<input value={contact} onChange={e=>{C(e.target.value);T(false);M('')}} maxLength={100} required placeholder="填写订单号或昵称"/></label><button disabled={busy||sent}>{sent?'已提交':'提交人工查询'}</button><small>请勿填写密码或其他无关信息。</small></form></section>
  <footer>文献查询服务 · 以实际可获取的全文为准</footer>
 </main>
}
