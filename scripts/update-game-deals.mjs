
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const text=html=>html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
export function parseDeku(html,platform){
 const headings=[...html.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)];
 const start=headings.find(x=>text(x[1]).toLowerCase()==='current prices');
 if(!start)throw Error('Current-price section not found');
 const end=headings.find(x=>x.index>start.index&&/price history|description/i.test(text(x[1])));
 const section=html.slice(start.index+start[0].length,end?end.index:html.length);
 const rows=[...section.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(x=>x[1]);
 const offers=rows.filter(row=>text(row).includes(platform)).map(row=>{
  const clean=row.replace(/<(?:s|del)\b[^>]*>[\s\S]*?<\/(?:s|del)>/gi,'');
  const matches=[...text(clean).matchAll(/\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/g)];
  if(!matches.length||/Unavailable|Sold out/i.test(text(clean)))return null;
  const price=Number(matches[0][1].replaceAll(',',''));
  return Number.isFinite(price)&&price>0?{price,summary:text(clean)}:null;
 }).filter(Boolean).sort((a,b)=>a.price-b.price);
 if(!offers.length)throw Error('No current USD price for '+platform);
 return offers[0];
}
export function parseMercari(html){
 const heading=html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
 if(!heading||!/Mortal Kombat.*Legacy Kollection.*Switch 2/i.test(text(heading[1])))throw Error('Exact listing title not found');
 const scripts=[...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
 for(const script of scripts){
  let parsed;try{parsed=JSON.parse(script[1])}catch{continue}
  const nodes=Array.isArray(parsed)?parsed:parsed['@graph']||[parsed];
  for(const node of nodes){
   if(node['@type']!=='Product'||!/Mortal Kombat.*Legacy/i.test(node.name||''))continue;
   for(const offer of Array.isArray(node.offers)?node.offers:[node.offers]){
    if(offer?.priceCurrency==='USD'&&/InStock$/.test(offer.availability||'')&&Number(offer.price)>0)return {price:Number(offer.price)};
   }
  }
 }
 throw Error('Current listing availability and USD price not confirmed');
}
async function main(){
 const file='public/game-watchlist/deals.json',feed=JSON.parse(await fs.readFile(file,'utf8'));
 const now=new Date().toISOString(),cache=new Map();let successful=0;
 for(const item of feed.items){
  if(!['deku','mercari'].includes(item.monitor))continue;
  item.lastAttemptAt=now;
  try{
   const source=new URL(item.source);
   if(!['www.dekudeals.com','www.mercari.com'].includes(source.hostname))throw Error('Source host not allowed');
   if(!cache.has(source.href)){
    const response=await fetch(source,{headers:{'User-Agent':'GameVault price research (+https://fortifyos.github.io/fortifyos/game-watchlist/)','Accept-Language':'en-US,en;q=0.9'},signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw Error('Source HTTP '+response.status);
    cache.set(source.href,await response.text());
   }
   const offer=item.monitor==='deku'?parseDeku(cache.get(source.href),item.monitorPlatform):parseMercari(cache.get(source.href));
   item.price=offer.price;if(item.was)item.discount=Math.max(0,Math.round((1-item.price/item.was)*100));
   item.expires=null;item.verified=now.slice(0,10);item.checkedAt=now;item.liveConfirmed=true;item.checkError=null;
   item.dealOpportunity=item.format==='physical'||item.price<10||item.discount>=70;
   item.note=item.monitor==='deku'?'Current US '+item.monitorPlatform.toLowerCase()+' price observed by the online checker. Compare the exact edition and confirm checkout price; sale cutoff is not verified.':'Exact Mercari listing USD price and InStock data observed. Shipping and fees below are prior estimates; confirm them at checkout.';
   successful++;
  }catch(error){item.checkError=String(error.message).slice(0,160);item.liveConfirmed=false}
 }
 feed.generatedAt=now;feed.lastRun={attempted:feed.items.filter(x=>x.lastAttemptAt===now).length,successful};
 await fs.writeFile(file,JSON.stringify(feed,null,2)+'\n');
 console.log('Deal checks: '+successful+' succeeded; failed sources are marked for recheck.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
