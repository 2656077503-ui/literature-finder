import {publicCors} from '../cors';

type Item = {title:string;doi:string;year:string;authors:string;journal:string;pmc:string;pdf:string;abstract?:string};

function httpsUrl(value:unknown){
 if(typeof value!=='string')return '';
 try{const url=new URL(value);return url.protocol==='https:'?url.href:''}catch{return ''}
}
function doiValue(value:unknown){
 return typeof value==='string'?value.replace(/^https?:\/\/(dx\.)?doi\.org\//i,'').trim():'';
}
function abstractText(index:unknown){
 if(!index||typeof index!=='object')return '';
 const positions:[number,string][]=[];
 for(const [word,places] of Object.entries(index))if(Array.isArray(places))for(const place of places)if(Number.isInteger(place)&&place>=0&&place<400)positions.push([place,word]);
 return positions.sort((a,b)=>a[0]-b[0]).slice(0,55).map(([,word])=>word).join(' ').slice(0,450);
}
async function openAlexSearch(query:string,language:string):Promise<Item[]>{
 const url='https://api.openalex.org/works?per_page=15&search='+encodeURIComponent(query)+'&filter=language:'+ (language==='all'?'zh%7Cen':language);
 const response=await fetch(url,{signal:AbortSignal.timeout(14000)});
 if(!response.ok)throw Error('topic search failed');
 const data=await response.json() as any;
 const titles=new Set<string>();
 return (data.results||[]).filter((work:any)=>{
  if(!work?.title)return false;
  const key=work.title.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
  if(titles.has(key))return false;
  titles.add(key);return true;
 }).slice(0,15).map((work:any)=>{
  const location=work.best_oa_location;
  const pdf=location?.is_oa?httpsUrl(location.pdf_url):'';
  const pmc=location?.is_oa?httpsUrl(location.landing_page_url):'';
  return {
   title:work.title,doi:doiValue(work.doi),year:String(work.publication_year||''),
   authors:(work.authorships||[]).slice(0,4).map((a:any)=>a.author?.display_name).filter(Boolean).join(', '),
   journal:work.primary_location?.source?.display_name||'',pmc,pdf,
   abstract:abstractText(work.abstract_inverted_index)
  };
 });
}
async function crossrefSearch(query:string):Promise<Item[]>{
 const url='https://api.crossref.org/works?rows=15&query.bibliographic='+encodeURIComponent(query);
 const response=await fetch(url,{headers:{'User-Agent':'LiteratureFinder/1.0'},signal:AbortSignal.timeout(14000)});
 if(!response.ok)throw Error('topic search failed');
 const data=await response.json() as any;
 const items:Item[]=(data.message?.items||[]).filter((work:any)=>work?.title?.[0]).map((work:any)=>({
  title:work.title[0],doi:work.DOI||'',year:String(work.published?.['date-parts']?.[0]?.[0]||''),
  authors:(work.author||[]).slice(0,4).map((a:any)=>[a.given,a.family].filter(Boolean).join(' ')).join(', '),
  journal:work['container-title']?.[0]||'',pmc:'',pdf:''
 }));
 return Promise.all(items.map(async item=>{
  if(!item.doi)return item;
  try{
   const url='https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&resultType=core&pageSize=1&query='+encodeURIComponent('DOI:"'+item.doi+'"');
   const response=await fetch(url,{signal:AbortSignal.timeout(5000)});
   if(!response.ok)return item;
   const data=await response.json() as any;
   const hit=data?.resultList?.result?.[0];
   if(hit?.doi?.toLowerCase()!==item.doi.toLowerCase())return item;
   const locations:any[]=hit?.fullTextUrlList?.fullTextUrl||[];
   const safe=(location:any)=>['F','OA'].includes(location?.availabilityCode)&&typeof location?.url==='string'&&location.url.startsWith('https://europepmc.org/articles/');
   item.pmc=locations.find(location=>safe(location)&&location.documentStyle==='html')?.url||'';
   item.pdf=locations.find(location=>safe(location)&&location.documentStyle==='pdf')?.url||'';
  }catch{}
  return item;
 }));
}

async function topic(request:Request){
 const query=new URL(request.url).searchParams.get('q')?.trim()||'';
 if(query.length<4||query.length>500)return Response.json({error:'请输入至少 4 个字的研究题目或关键词'}, {status:400});
 try{
  const requested=new URL(request.url).searchParams.get('language')||'all';
  if(!['all','zh','en'].includes(requested))return Response.json({error:'文献语言选项无效。'}, {status:400});
  const items=await openAlexSearch(query,requested);
  return Response.json({items});
 }catch{return Response.json({error:'相关文献检索暂时不可用，请稍后重试或提交人工查询。'}, {status:502})}
}

export async function GET(request:Request){return publicCors(await topic(request));}
