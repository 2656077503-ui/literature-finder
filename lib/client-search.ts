type SearchItem = {
  title: string;
  doi: string;
  year: string;
  authors: string;
  journal: string;
  pmc: string;
  pdf: string;
  abstract?: string;
};

function cleanDoi(value: string) {
  return value.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "");
}

function httpsUrl(value: unknown) {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

async function getJson(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {signal: controller.signal});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json() as any;
  } finally {
    clearTimeout(timeout);
  }
}

async function addOpenFullText(item: SearchItem) {
  if (!item.doi) return item;
  try {
    const url = "https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&resultType=core&pageSize=1&query=" + encodeURIComponent(`DOI:"${item.doi}"`);
    const data = await getJson(url);
    const hit = data?.resultList?.result?.[0];
    if (hit?.doi?.toLowerCase() !== item.doi.toLowerCase()) return item;
    const locations: any[] = hit?.fullTextUrlList?.fullTextUrl || [];
    const allowed = (location: any) =>
      ["F", "OA"].includes(location?.availabilityCode) &&
      typeof location?.url === "string" &&
      location.url.startsWith("https://europepmc.org/articles/");
    item.pmc = locations.find(location => allowed(location) && location.documentStyle === "html")?.url || "";
    item.pdf = locations.find(location => allowed(location) && location.documentStyle === "pdf")?.url || "";
  } catch {
    // Metadata is still useful when Europe PMC is unavailable.
  }
  return item;
}

function crossrefItem(work: any): SearchItem {
  return {
    title: work.title?.[0] || "题名未提供",
    doi: work.DOI || "",
    year: String(work.published?.["date-parts"]?.[0]?.[0] || ""),
    authors: (work.author || []).slice(0, 4).map((author: any) => [author.given, author.family].filter(Boolean).join(" ")).join(", "),
    journal: work["container-title"]?.[0] || "",
    pmc: "",
    pdf: "",
  };
}

async function crossrefSearch(query: string, exact: boolean): Promise<SearchItem[]> {
  const doi = cleanDoi(query);
  const isDoi = /^10\.\d{4,9}\//i.test(doi);
  const url = isDoi
    ? "https://api.crossref.org/works/" + encodeURIComponent(doi)
    : "https://api.crossref.org/works?rows=" + (exact ? 5 : 15) + "&query.bibliographic=" + encodeURIComponent(query);
  let data: any;
  try {
    data = await getJson(url);
  } catch (error) {
    if (isDoi && error instanceof Error && error.message === "HTTP 404") return [];
    throw error;
  }
  const works = Array.isArray(data?.message?.items) ? data.message.items : [data?.message];
  return Promise.all(works.filter(Boolean).map(crossrefItem).map(addOpenFullText));
}

function abstractText(index: unknown) {
  if (!index || typeof index !== "object") return "";
  const positions: [number, string][] = [];
  for (const [word, places] of Object.entries(index)) {
    if (Array.isArray(places)) for (const place of places) {
      if (Number.isInteger(place) && place >= 0 && place < 400) positions.push([place, word]);
    }
  }
  return positions.sort((a, b) => a[0] - b[0]).slice(0, 55).map(([, word]) => word).join(" ").slice(0, 450);
}

async function openAlexSearch(query: string): Promise<SearchItem[]> {
  const data = await getJson("https://api.openalex.org/works?per_page=15&search=" + encodeURIComponent(query));
  const seen = new Set<string>();
  return (data.results || []).filter((work: any) => {
    if (!work?.title) return false;
    const key = work.title.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((work: any) => ({
    title: work.title,
    doi: typeof work.doi === "string" ? cleanDoi(work.doi) : "",
    year: String(work.publication_year || ""),
    authors: (work.authorships || []).slice(0, 4).map((author: any) => author.author?.display_name).filter(Boolean).join(", "),
    journal: work.primary_location?.source?.display_name || "",
    pmc: work.best_oa_location?.is_oa ? httpsUrl(work.best_oa_location.landing_page_url) : "",
    pdf: work.best_oa_location?.is_oa ? httpsUrl(work.best_oa_location.pdf_url) : "",
    abstract: abstractText(work.abstract_inverted_index),
  })).sort((a: SearchItem, b: SearchItem) => Number(Boolean(b.pdf)) - Number(Boolean(a.pdf))).slice(0, 15);
}

export async function searchDirectly(query: string, mode: "exact" | "topic"): Promise<SearchItem[]> {
  try {
    if (mode === "exact") return await crossrefSearch(query, true);
    return /[\u3400-\u9fff]/.test(query) ? await crossrefSearch(query, false) : await openAlexSearch(query);
  } catch {
    throw new Error("当前网络无法连接文献数据库。请切换网络重试，或在小红书聊天中发送 DOI／题名。");
  }
}
