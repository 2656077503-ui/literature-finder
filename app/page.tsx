"use client";

import {useEffect, useState} from "react";
import {ArrowRight, ArrowUpRight, BookOpen, Check, Download, FileText, Headphones, Search, Trash2} from "lucide-react";
import {searchChineseOpenAccess,searchDirectly} from "../lib/client-search";

type Item = {title:string;doi:string;year:string;authors:string;journal:string;pmc:string;pdf:string;abstract?:string;source?:string;sourceUrl?:string};
type Mode = "exact" | "topic";
type Language = "all" | "zh" | "en";
type SearchRecord = {id:string;query:string;mode:Mode;items:Item[]};
const STORAGE_KEY = "literature-search-records-v1";
const apiBase = typeof window === "undefined" ? "" : (window as Window & {__LITERATURE_API_BASE__?:string}).__LITERATURE_API_BASE__ || "";

export default function Home(){
 const [q,Q]=useState(""),[contact,C]=useState(""),[mode,SetMode]=useState<Mode>("exact");
 const [language,SetLanguage]=useState<Language>("all");
 const [records,SetRecords]=useState<SearchRecord[]>([]),[ready,SetReady]=useState(false);
 const [msg,M]=useState(""),[busy,B]=useState(false),[sent,T]=useState(false);

 useEffect(()=>{try{const raw=localStorage.getItem(STORAGE_KEY)||sessionStorage.getItem(STORAGE_KEY);if(raw){const parsed:unknown=JSON.parse(raw);if(Array.isArray(parsed))SetRecords(parsed.filter((x):x is SearchRecord=>Boolean(x&&typeof x==="object"&&typeof x.query==="string"&&Array.isArray(x.items)&&["exact","topic"].includes(x.mode))));}}catch{}SetReady(true)},[]);
 useEffect(()=>{if(ready)try{localStorage.setItem(STORAGE_KEY,JSON.stringify(records));sessionStorage.removeItem(STORAGE_KEY)}catch{}},[records,ready]);

 async function search(e:React.FormEvent){
  e.preventDefault();const query=q.trim();if(!query)return;B(true);M("");T(false);
  try{
   let items:Item[];
   const chineseSource=mode==="topic"&&language!=="en"&&/[\u3400-\u9fff]/.test(query)?searchChineseOpenAccess(query).catch(()=>null):Promise.resolve(null);
   try{
    const response=await fetch(apiBase+(mode==="topic"?"/api/topic":"/api/search")+"?q="+encodeURIComponent(query)+(mode==="topic"?"&language="+language:""));
    const data=await response.json() as {error?:string;items?:Item[]};
    if(!response.ok)throw Error(data.error||"查询服务暂时不可用");
    items=Array.isArray(data.items)?data.items:[];
   }catch{
    try{items=await searchDirectly(query,mode,language);M("主查询接口未连接，已通过备用文献源查询。PDF 链接以实际可访问情况为准。");}
    catch(error){const fallback=await chineseSource;if(fallback===null)throw error;items=fallback;M("主查询接口未连接，已查询开放文献来源。");}
   }
   if(mode==="topic"){
    const extra=await chineseSource||[],combined=[...items.slice(0,10),...extra,...items.slice(10)],seen=new Set<string>();
    items=combined.filter(item=>{const key=(item.doi||item.title).toLowerCase().trim();if(seen.has(key))return false;seen.add(key);return true;}).sort((a,b)=>Number(Boolean(b.pdf))-Number(Boolean(a.pdf))).slice(0,15);
   }
   SetRecords(previous=>[{id:`${Date.now()}-${Math.random().toString(36).slice(2)}`,query,mode,items},...previous]);
  }catch(error){M(error instanceof Error?error.message:"查询失败")}
  finally{B(false)}
 }
 async function send(e:React.FormEvent){
  e.preventDefault();B(true);M("");
  try{
   const response=await fetch(apiBase+"/api/requests",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({query:q,contact})});
   const data=await response.json() as {error?:string};
   if(!response.ok)throw Error(data.error);
   T(true);M("需求已提交，请留意你的 QQ 邮箱。");
  }catch(error){M(error instanceof Error&&error.message!=="Load failed"?error.message:"无法连接人工查询服务，请在小红书聊天中发送 DOI／题名及 QQ 邮箱。")}
  finally{B(false)}
 }

 return <main className="site-shell">
  <header className="site-header">
   <a className="brand" href="./" aria-label="文献查询服务首页"><span className="brand-mark"><BookOpen size={21} strokeWidth={1.8}/></span><span><strong>文献查询</strong><small>LITERATURE FINDER</small></span></a>
   <nav className="header-nav"><a href="#manual-help">人工协助</a><a className="owner-link" href={apiBase+"/admin"}>商家后台 <ArrowUpRight size={15}/></a></nav>
  </header>

  <section className="hero">
   <div className="hero-copy">
    <span className="hero-eyebrow"><span className="eyebrow-dot"/> 简单、清楚地找到文献</span>
    <h1>找文献，<br/><em>从这里开始。</em></h1>
    <p>输入 DOI 或文献题名，核对出版信息和开放全文。只有自己的论文题目，也可以查找相关研究。</p>
   </div>
   <div className="hero-decoration" aria-hidden="true"><div className="decoration-orbit"/><div className="decoration-page"><span className="decoration-line short"/><span className="decoration-line"/><span className="decoration-line"/><span className="decoration-line medium"/><span className="decoration-stamp"><Search size={20}/></span></div><span className="decoration-spark spark-one">✦</span><span className="decoration-spark spark-two">✳</span></div>
  </section>

  <section className="search-panel" aria-label="文献查询">
   <div className="panel-intro"><div><span className="section-kicker">START HERE</span><h2>你想找什么文献？</h2></div><span className="panel-note">选择一种方式开始</span></div>
   <div className="mode-switch" role="group" aria-label="选择查询方式">
    <button type="button" className={mode==="exact"?"active":""} aria-pressed={mode==="exact"} onClick={()=>SetMode("exact")}><FileText size={18}/><span>查指定文献<small>已有 DOI 或完整题名</small></span></button>
    <button type="button" className={mode==="topic"?"active":""} aria-pressed={mode==="topic"} onClick={()=>SetMode("topic")}><Search size={18}/><span>按研究题目找文献<small>只有自己的论文题目</small></span></button>
   </div>
   <form onSubmit={search} className="search-form">
    {mode==="topic"&&<fieldset className="language-options"><legend>文献语言</legend>{([["zh","只找中文"],["en","只找英文"],["all","中英文都找"]] as const).map(([value,label])=><label key={value}><input type="radio" name="language" value={value} checked={language===value} onChange={()=>SetLanguage(value)}/>{label}</label>)}</fieldset>}
    <label htmlFor="literature-query">{mode==="exact"?"文献 DOI 或完整题名":"你的论文题目或研究主题"}</label>
    <div className="search-row"><div className="search-field"><Search size={20} aria-hidden="true"/><input id="literature-query" value={q} onChange={e=>{Q(e.target.value);T(false)}} placeholder={mode==="exact"?"例如：10.1038/nature12373":"例如：老年人睡眠与膳食多样性"} maxLength={500} required/></div><button className="search-submit" disabled={busy}>{busy?"查询中…":"开始查询"}<ArrowRight size={18}/></button></div>
   </form>
   <p className="search-hint">{mode==="exact"?"支持 DOI、DOI 链接及中英文文献题名。":"最多显示 15 篇，优先展示有 PDF 链接的文献。请核对题名和语言；查英文文献建议输入英文关键词。"}</p>
  </section>

  <div className="steps" aria-label="查询流程"><div><span>01</span><strong>输入文献信息</strong></div><i/><div><span>02</span><strong>核对查询结果</strong></div><i/><div><span>03</span><strong>获取全文或寻求协助</strong></div></div>
  {msg&&<p className="notice" role="status">{msg}</p>}

  {records.length>0&&<section className="results-section" aria-label="查询结果">
   <div className="section-heading"><div><span className="section-kicker">YOUR SEARCHES</span><h2>查询记录 <span className="count">{records.length}</span></h2><p>最近的查询排在前面，重新打开网页后仍可在当前浏览器查看。</p></div><button type="button" className="clear-history" onClick={()=>{SetRecords([]);M("查询记录已清空。")}}><Trash2 size={15}/> 清空记录</button></div>
   {records.map((record,recordIndex)=><div className="search-record" key={record.id}>
    <div className="record-head"><span className="record-number">{String(records.length-recordIndex).padStart(2,"0")}</span><div><span className="record-mode">{record.mode==="topic"?"研究题目检索":"指定文献查询"}</span><h3>{record.query}</h3></div><span className="record-count">{record.items.length} 条结果</span></div>
    {record.items.length===0?<div className="empty">暂未找到匹配的文献。你可以在下方提交人工查询。</div>:(record.mode==="topic"?[...record.items].sort((a,b)=>Number(Boolean(b.pdf))-Number(Boolean(a.pdf))):record.items).map((item,index)=><article className="result-card" key={item.doi||record.id+"-"+index}>
     <div className="result-top"><span className="result-index">文献 {String(index+1).padStart(2,"0")}</span>{item.pdf?<span className="availability available"><Check size={13}/> 找到 PDF 链接</span>:item.pmc?<span className="availability available"><Check size={13}/> 有开放全文</span>:<span className="availability">全文待核对</span>}</div>
     <h4>{item.title}</h4><p className="result-meta">{[item.authors,item.journal,item.year,item.source].filter(Boolean).join(" · ")||"出版信息未提供"}</p>
     {record.mode==="topic"&&item.abstract&&<p className="abstract">{item.abstract}</p>}
     <div className="result-actions">{item.doi&&<a href={"https://doi.org/"+encodeURIComponent(item.doi)} target="_blank" rel="noreferrer"><ArrowUpRight size={15}/> 出版页面</a>}{item.sourceUrl&&<a href={item.sourceUrl} target="_blank" rel="noreferrer"><ArrowUpRight size={15}/> DOAJ 页面</a>}{item.pmc&&<a href={item.pmc} target="_blank" rel="noreferrer"><BookOpen size={15}/> 免费全文</a>}{item.pdf&&<a className="pdf-link" href={item.pdf} target="_blank" rel="noreferrer"><Download size={15}/> 查看 / 下载 PDF</a>}{!item.pmc&&!item.pdf&&<span>暂无已确认的开放全文</span>}</div>
    </article>)}
   </div>)}
  </section>}

  <section className="help-section" id="manual-help">
   <div className="help-copy"><span className="help-icon"><Headphones size={24}/></span><span className="section-kicker">NEED A HAND?</span><h2>没找到？<br/>交给我们继续找。</h2><p>查询结果不符合要求，或暂时没有开放全文时，留下文献信息和你的 QQ 邮箱，方便我们联系你。</p><p>人工查找按成功交付的文献收费：1 元 / 篇，未能交付不收费。</p><div className="help-footnote"><Check size={15}/> 请先核对题名、作者和 DOI，再提交需求</div></div>
   <form className="help-form" onSubmit={send}><h3>提交人工查询</h3><label>文献 DOI、完整题目或研究主题<textarea value={q} onChange={e=>{Q(e.target.value);T(false);M("")}} maxLength={500} required placeholder="粘贴文献题目、DOI 或研究主题"/></label><label>你的 QQ 邮箱<input type="email" inputMode="email" pattern={"[^@\\s]+@qq\\.com"} title="请输入以 @qq.com 结尾的邮箱" value={contact} onChange={e=>{C(e.target.value);T(false);M("")}} maxLength={100} required placeholder="例如：123456@qq.com"/></label><button disabled={busy||sent}>{sent?"已提交":"提交需求"}<ArrowRight size={17}/></button><small>请勿填写密码或其他无关信息。</small></form>
  </section>
  <footer><span><BookOpen size={17}/> 文献查询服务</span><span>开放全文以实际可获取情况为准</span></footer>
 </main>
}
