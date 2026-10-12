
'use strict';
const intel=window.GameVaultDiscovery,grid=document.getElementById('deals-grid'),count=document.getElementById('deal-count'),sort=document.getElementById('deal-sort'),evidence=document.getElementById('deal-evidence');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeURL=value=>{try{const u=new URL(value,location.href);return ['https:','http:'].includes(u.protocol)?esc(u.href):'#'}catch{return '#'}};
const money=n=>'$'+Number(n).toFixed(2);
let deals=[],format='all',platform=new URLSearchParams(location.search).get('platform')||'all';
platform=({sw:'switch',s2:'switch2',ps:'ps5'})[platform]||platform;
if(!['all','switch','switch2','ps5','ps4'].includes(platform))platform='all';
function fresh(d){const age=Date.now()-Date.parse(d.checkedAt||'');return d.liveConfirmed===true&&!d.checkError&&Number.isFinite(age)&&age>=0&&age<=90*60000}
function ended(d){return Boolean(d.expires&&d.expires<intel.day())}
function opportunity(d){return fresh(d)&&!ended(d)&&d.dealOpportunity!==false&&(d.format==='physical'||d.discount>=70||d.price<10)}
const total=d=>Number(d.price)+Number(d.shipping||0)+Number(d.fee||0);
function card(d){
 const live=opportunity(d),expired=ended(d),badge=live?(d.format==='digital'?'DIGITAL STRIKE':'PHYSICAL LEAD'):expired?'OFFER ENDED':'RECHECK / WAIT';
 const timestamp=d.checkedAt?new Date(d.checkedAt).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' ET':'Not recently verified';
 return '<article class="deal-card '+(live?d.signal:'watch')+(expired?' expired':'')+'"><div class="deal-cover"><img src="./covers/'+esc(d.cover)+'" alt="'+esc(d.title)+' cover" loading="lazy"><span class="deal-alert">'+badge+'</span><span class="deal-format">'+esc(d.format)+'</span></div><div class="deal-info"><span class="deal-platform">'+esc(d.platformLabel)+'</span><h2>'+esc(d.title)+'</h2><div class="deal-price"><strong>'+money(d.price)+'</strong>'+(d.discount&&d.was?'<s>'+money(d.was)+'</s><b>−'+d.discount+'%</b>':'<b>Compare value</b>')+'</div>'+(d.shipping||d.fee?'<p>Estimated total before tax: '+money(total(d))+' · shipping '+money(d.shipping||0)+' · buyer fee '+money(d.fee||0)+'</p>':'')+'<p>'+esc(d.note)+'</p><p>Checked '+timestamp+(d.expires?' · Listed sale end '+esc(d.expires)+' (confirm cutoff)':'')+(d.checkError?' · Online check failed; open source':'')+'</p><div class="deal-bottom"><a href="'+safeURL(d.source||d.url)+'" target="_blank" rel="noopener noreferrer">Price evidence ↗</a><a href="'+safeURL(d.url)+'" target="_blank" rel="noopener noreferrer">'+(live?'Inspect offer':'Check live price')+' ↗</a></div></div></article>';
}
function draw(){
 let shown=deals.filter(d=>(format==='all'||d.format===format)&&(platform==='all'||d.platform===platform||(platform==='ps4'&&d.platformLabel.includes('PS4')))&&(evidence.value==='all'||(evidence.value==='live'?opportunity(d):!opportunity(d))));
 shown.sort((a,b)=>sort.value==='discount'?b.discount-a.discount:sort.value==='price'?total(a)-total(b):sort.value==='expiry'?(a.expires||'9999').localeCompare(b.expires||'9999'):Number(opportunity(b))-Number(opportunity(a))||b.discount-a.discount);
 grid.innerHTML=shown.length?shown.map(card).join(''):'<p class="review-note">No recently confirmed opportunities match. Use Needs recheck / ended to inspect older leads, or the live console searches below.</p>';
 count.textContent=shown.length+' opportunities / leads shown';
 document.getElementById('deals-live').textContent=deals.filter(opportunity).length;
 document.getElementById('deals-under10').textContent=deals.filter(d=>opportunity(d)&&d.price<10).length;
 document.getElementById('deals-leads').textContent=deals.filter(d=>!opportunity(d)).length;
 document.querySelectorAll('button[data-platform]').forEach(b=>{b.classList.toggle('a',b.dataset.platform===platform);b.setAttribute('aria-pressed',String(b.dataset.platform===platform))});
}
let loading=false;
async function refresh(){
 if(loading)return;loading=true;
 try{
  const response=await fetch('./deals.json?t='+Date.now(),{cache:'no-store'});if(!response.ok)throw Error('Feed unavailable');
  const data=await response.json();if(data.version!==1||!Array.isArray(data.items))throw Error('Invalid feed');
  deals=data.items;draw();
  const t=data.generatedAt?new Date(data.generatedAt).toLocaleString('en-US',{timeZone:'America/New_York'}):'unknown';
  document.getElementById('deal-feed-time').textContent='Feed updated '+t+' ET · source check times shown per offer';
 }catch{document.getElementById('deal-feed-time').textContent='Feed unavailable. Open the live store and price-history links below.';deals=deals.map(d=>({...d,liveConfirmed:false,checkError:true}));draw()}
 finally{loading=false}
}
document.querySelectorAll('button[data-format]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('button[data-format]').forEach(x=>x.classList.remove('a'));b.classList.add('a');format=b.dataset.format;draw()}));
document.querySelectorAll('button[data-platform]').forEach(b=>b.addEventListener('click',()=>{platform=b.dataset.platform;draw()}));
sort.addEventListener('change',draw);evidence.addEventListener('change',draw);
document.getElementById('refresh-deals').addEventListener('click',refresh);
grid.addEventListener('error',event=>{if(event.target.tagName==='IMG'){const image=event.target,ph=document.createElement('div');ph.className='guide-placeholder';ph.textContent=image.alt.replace(/ cover$/,'');image.replaceWith(ph)}},true);
setInterval(()=>{if(!document.hidden)refresh()},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
refresh();
