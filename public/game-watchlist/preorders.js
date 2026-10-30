
const grid=document.getElementById('g'),search=document.getElementById('preorder-search'),edition=document.getElementById('edition-filter'),availability=document.getElementById('availability-filter'),countLabel=document.getElementById('result-count'),loadMore=document.getElementById('load-more');
const intel=window.GameVaultDiscovery;
const pageSize=48;
let platform=new URLSearchParams(location.search).get('platform')||'all',visible=pageSize,catalog=[];
if(!['all','sw','s2','ps','ps4'].includes(platform))platform='all';
const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const safeLink=value=>{try{const u=new URL(value,location.href);return ['https:','http:'].includes(u.protocol)?escapeHtml(u.href):'#'}catch{return '#'}};
function listingState(item){
 const release=intel.releaseDate(item.release);
 if(intel.stale(item.verified)||(release&&release<=intel.day()))return 'recheck';
 return item.availability==='Preorder open'?'open':item.availability==='Announced · preorder TBD'?'announced':item.availability==='Sold out / restock watch'?'restock':'recheck';
}
function filteredItems(){
 const query=search.value.trim().toLowerCase(),fit=document.getElementById('fit-filter').value,media=document.getElementById('media-filter').value;
 const items=catalog.filter(item=>{
  const relevance=intel.fit(item),state=listingState(item);
  if(platform!=='all'&&item.platformKey!==platform)return false;
  if(edition.value!=='all'&&item.edition!==edition.value)return false;
  if(availability.value!=='all'&&state!==availability.value)return false;
  if(fit==='curated'&&relevance==='Discovery candidate')return false;
  if(fit==='personal'&&relevance!=='Personal watch')return false;
  if(media==='card'&&item.media!=='Full on media')return false;
  if(media==='key'&&!/Game-Key Card|Download code/.test(item.media))return false;
  if(media==='verify'&&!/verify|Disc/i.test(item.media))return false;
  return !query||[item.title,item.edition,item.region,item.media].join(' ').toLowerCase().includes(query);
 });
 const sort=document.getElementById('preorder-sort').value;
 const rank=x=>intel.fit(x)==='Personal watch'?0:intel.fit(x)==='Collection fit'?1:2;
 items.sort((a,b)=>sort==='title'?a.title.localeCompare(b.title):sort==='release'?(intel.releaseDate(a.release)||'9999').localeCompare(intel.releaseDate(b.release)||'9999'):rank(a)-rank(b)||a.title.localeCompare(b.title));
 return items;
}
function card(item){
 const state=listingState(item),labels={open:'Recently checked open',announced:'Preorder TBD',restock:'Restock watch',recheck:'Recheck listing'};
 const media=/Game-Key Card|Download code/.test(item.media)?item.media:item.media==='Full on media'?'Listed full on media · test pending':item.media;
 const alternatives=(item.alternatives||[]).map(link=>'<a class="alternate" href="'+safeLink(link.url)+'" target="_blank" rel="noopener noreferrer">Also at '+escapeHtml(link.seller)+' ↗</a>').join('');
 return '<article class="c preorder-card" data-p="'+escapeHtml(item.platformKey)+'"><div class="v"><img src="'+safeLink(item.cover)+'" alt="'+escapeHtml(item.title)+' physical cover" loading="lazy" decoding="async"><span class="availability '+(state==='open'?'open':state==='announced'?'announced':'restock')+'">'+labels[state]+'</span></div><div class="i"><div class="p '+escapeHtml(item.platformKey)+'">'+escapeHtml(item.platform)+' · '+intel.fit(item)+'</div><h2>'+escapeHtml(item.title)+'</h2><div class="preorder-meta"><span>'+escapeHtml(item.edition)+'</span><span>'+escapeHtml(item.region)+'</span><span class="warning">'+escapeHtml(media)+'</span><span>Listed release '+escapeHtml(item.release)+'</span></div><div class="language">English: '+escapeHtml(item.language)+' · Listing checked '+escapeHtml(item.verified)+'<br>Snapshot: '+escapeHtml(item.availability)+(item.currency?'<br>Retailer currency: '+escapeHtml(item.currency):'')+'</div><a class="buy" href="'+safeLink(item.url)+'" target="_blank" rel="noopener noreferrer">'+(state==='open'?'View preorder':state==='restock'?'Check restock':'Check seller')+' <span>'+escapeHtml(item.seller)+' ↗</span></a>'+(item.ps5Url?'<a class="alternate" href="'+safeLink(item.ps5Url)+'" target="_blank" rel="noopener noreferrer">Compare PS5 edition ↗</a>':'')+alternatives+'</div></article>';
}
function render(reset=true){
 if(reset)visible=pageSize;
 const matches=filteredItems();
 grid.innerHTML=matches.length?matches.slice(0,visible).map(card).join(''):'<div class="catalog-error">No matches. Try All discovery leads or broaden the filters.</div>';
 countLabel.textContent=matches.length.toLocaleString()+' editions found';
 loadMore.hidden=visible>=matches.length;loadMore.textContent='Show more ('+Math.max(0,Math.min(pageSize,matches.length-visible))+')';
 document.querySelectorAll('[data-f]').forEach(b=>{const active=b.dataset.f===platform;b.classList.toggle('a',active);b.setAttribute('aria-pressed',String(active))});
}
grid.addEventListener('error',event=>{if(event.target.tagName==='IMG'){const image=event.target,ph=document.createElement('div');ph.className='ph';ph.textContent=image.alt.replace(/ physical cover$/,'');image.replaceWith(ph)}},true);
document.querySelectorAll('[data-f]').forEach(button=>button.addEventListener('click',()=>{platform=button.dataset.f;render()}));
search.addEventListener('input',()=>render());
[edition,availability,document.getElementById('fit-filter'),document.getElementById('media-filter'),document.getElementById('preorder-sort')].forEach(el=>el.addEventListener('change',()=>render()));
loadMore.addEventListener('click',()=>{visible+=pageSize;render(false)});
fetch('./preorders.json?v=20261030b').then(response=>{if(!response.ok)throw Error('Catalog unavailable');return response.json()}).then(data=>{
 if(!Array.isArray(data.items))throw Error('Invalid catalog');
 catalog=data.items;
 document.getElementById('tracked-total').textContent=catalog.length.toLocaleString();
 document.getElementById('open-total').textContent=catalog.filter(x=>listingState(x)==='open').length.toLocaleString();
 ['s2','ps','sw','ps4'].forEach(key=>{const items=catalog.filter(x=>x.platformKey===key),open=items.filter(x=>listingState(x)==='open').length;document.getElementById('coverage-'+key).textContent=items.length.toLocaleString()+' tracked · '+open.toLocaleString()+' open'});
 document.getElementById('catalog-date').textContent=data.updated+' snapshot; per-entry dates below';
 render();
}).catch(()=>{grid.innerHTML='<div class="catalog-error">The preorder catalog could not load. Refresh to try again, or use Sources to check publishers.</div>';countLabel.textContent='Catalog unavailable'});
