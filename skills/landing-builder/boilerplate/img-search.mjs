#!/usr/bin/env node
// img-search.mjs — find REAL images for slides/landings. SEARCH first (cheap/free).
//   node img-search.mjs "<query>" [count] [--source openverse|unsplash]
// openverse (default): FREE, no key — world libraries (Smithsonian/Europeana/
//   Wikimedia/museums), with attribution. unsplash: modern photos (UNSPLASH_ACCESS_KEY).
const q = process.argv[2];
if (!q) { console.error('usage: node img-search.mjs "<query>" [count] [--source openverse|unsplash]'); process.exit(2); }
const count = Math.min(Number(process.argv[3]) || 6, 20);
const src = (process.argv[process.argv.indexOf('--source')+1]) || 'openverse';
async function openverse(){
  const u=`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=${count}&license_type=all-cc,commercial&mature=false`;
  const r=await fetch(u,{headers:{'User-Agent':'AgentFlow/1.0 (agentflow.website)'}}); if(!r.ok)throw new Error('openverse '+r.status);
  return ((await r.json()).results||[]).map(x=>({url:x.url,thumbnail:x.thumbnail,title:x.title,creator:x.creator,license:`${x.license} ${x.license_version||''}`.trim(),attribution:x.attribution,source:x.source,sourceUrl:x.foreign_landing_url}));
}
async function unsplash(){
  const key=process.env.UNSPLASH_ACCESS_KEY; if(!key)throw new Error('UNSPLASH_ACCESS_KEY not set');
  const u=`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=${count}`;
  const r=await fetch(u,{headers:{Authorization:`Client-ID ${key}`}}); if(!r.ok)throw new Error('unsplash '+r.status);
  return ((await r.json()).results||[]).map(x=>({url:x.urls?.regular,thumbnail:x.urls?.small,title:x.description||x.alt_description,creator:x.user?.name,attribution:`Photo by ${x.user?.name} on Unsplash`,source:'unsplash'}));
}
try{ console.log(JSON.stringify(src==='unsplash'?await unsplash():await openverse(),null,2)); }
catch(e){ console.error('search failed:',e.message); process.exit(1); }
