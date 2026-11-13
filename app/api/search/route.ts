import {publicCors} from '../cors';

async function search(req: Request) {
 const q = new URL(req.url).searchParams.get('q')?.trim() || '';
 if (!q || q.length > 500) return Response.json({error:'请输入文献题目或 DOI'}, {status:400});
 const doi = q.replace(/^https?:\/\/(dx\.)?doi\.org\//i,'').replace(/^doi:\s*/i,'');
 try {
  const url = /^10\.\d{4,9}\//i.test(doi) ? 'https://api.crossref.org/works/' + encodeURIComponent(doi) : 'https://api.crossref.org/works?rows=5&query.bibliographic=' + encodeURIComponent(q);
  const cr = await fetch(url, {headers:{'User-Agent':'LiteratureFinder/1.0'}, signal:AbortSignal.timeout(12000)});
  if (cr.status === 404) return Response.json({items:[]});
  if (!cr.ok) throw new Error('查询失败');
  const data = await cr.json() as any;
  const items = Array.isArray(data.message.items) ? data.message.items : [data.message];
  const out = await Promise.all(items.map(async (item:any) => {
   const d = item.DOI || ''; let pmc = '', pdf = '';
   if (d) try {
    const ep = await fetch('https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&resultType=core&pageSize=1&query='+encodeURIComponent('DOI:"'+d+'"'), {signal:AbortSignal.timeout(7000)});
    const j:any = await ep.json(); const hit = j?.resultList?.result?.[0];
    if (hit?.doi?.toLowerCase()===d.toLowerCase()) {
     const urls:any[]=hit?.fullTextUrlList?.fullTextUrl || [];
     const safe=(x:any)=>['F','OA'].includes(x?.availabilityCode)&&x?.url?.startsWith('https://europepmc.org/articles/');
     pmc=urls.find((x:any)=>safe(x)&&x.documentStyle==='html')?.url || '';
     pdf=urls.find((x:any)=>safe(x)&&x.documentStyle==='pdf')?.url || '';
    }
   } catch {}
   return {title:item.title?.[0] || '题名未提供', doi:d, year:item.published?.['date-parts']?.[0]?.[0] || '', authors:(item.author || []).slice(0,4).map((a:any)=>[a.given,a.family].filter(Boolean).join(' ')).join(', '), journal:item['container-title']?.[0] || '', pmc, pdf};
  }));
  return Response.json({items:out});
 } catch {return Response.json({error:'查询服务暂时不可用，请稍后重试或提交人工查询。'}, {status:502});}
}

export async function GET(req: Request) {return publicCors(await search(req));}
