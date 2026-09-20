import { mkdir, writeFile, access, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve('public/game-watchlist');
const COVER_ROOT = path.join(ROOT, 'covers', 'preorders');
const TODAY = new Date().toISOString().slice(0, 10);
const collections = [
  { key: 'ps4', platform: 'PlayStation 4', handle: 'ps4-pre-orders', match: /playstation 4|ps4/i },
  { key: 'ps', platform: 'PlayStation 5', handle: 'ps5-pre-orders', match: /playstation 5|ps5/i },
  { key: 'sw', platform: 'Nintendo Switch', handle: 'nintendo-switch-pre-orders', match: /nintendo switch|switch/i },
  { key: 's2', platform: 'Nintendo Switch 2', handle: 'nintendo-switch-2-pre-orders', match: /nintendo switch 2|switch 2/i },
];

const clean = (value = '') => value
  .replace(/\s*\((?:PRE-?ORDER)\)/gi, '')
  .replace(/\s*\[(?:PRE-?ORDER|FREE SHIPPING)\]/gi, '')
  .replace(/\s*\((?:FREE SHIPPING|VGP Exclusive|Exclusive Canadian Retailer)\)/gi, '')
  .replace(/\s*[-–]\s*(?:PlayStation 4|Playstation 4|PS4|PlayStation 5|Playstation 5|PS5|Nintendo Switch 2|Nintendo Switch|SWITCH)\s*$/i, '')
  .replace(/\s+/g, ' ').trim();

const stripHtml = (html = '') => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const releaseDate = (html = '') => {
  const text = stripHtml(html);
  const hit = text.match(/(?:RELEASE DATE|EXPECTED RELEASE|AVAILABLE)\s*:?\s*([A-Z]+\s+\d{1,2},\s+20\d{2}|\d{1,2}[/-]\d{1,2}[/-]20\d{2}|Q[1-4]\s+20\d{2}|20\d{2}|TBD)/i);
  return hit ? hit[1].replace(/\b\w/g, c => c.toUpperCase()) : 'TBD';
};

const edition = title => {
  if (/collector|collection box|dagdan collection/i.test(title)) return 'Collector';
  if (/limited|special|premium|master|retro edition/i.test(title)) return 'Limited';
  if (/steelbook/i.test(title)) return 'Steelbook';
  if (/deluxe|ultimate|complete|definitive|anthology/i.test(title)) return 'Complete / Deluxe';
  if (/reprint/i.test(title)) return 'Reprint';
  return 'Standard';
};

const region = title => {
  if (/jpn|japan/i.test(title)) return 'Japan import';
  if (/asian|asia import/i.test(title)) return 'Asia import';
  if (/pegi|eu import/i.test(title)) return 'Europe import';
  return 'North America';
};

const media = (title, body = '') => {
  const text = `${title} ${stripHtml(body)}`;
  if (/\bGKC\b|game[- ]key card/i.test(text)) return 'Game-Key Card';
  if (/code in (?:the )?box|download code|voucher code/i.test(text)) return 'Download code';
  if (/full(?:y)? (?:on|game) (?:the )?(?:cart|cartridge|disc)|complete on (?:cart|cartridge|disc)/i.test(text)) return 'Full on media';
  return 'Physical media · verify';
};

const slug = value => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120);

async function fetchProducts(handle) {
  const all = [];
  for (let page = 1; page <= 5; page += 1) {
    const url = `https://videogamesplus.ca/collections/${handle}/products.json?limit=250&page=${page}`;
    const response = await fetch(url, { headers: { 'user-agent': 'Game Vault preorder index' } });
    if (!response.ok) throw new Error(`${response.status} ${url}`);
    const products = (await response.json()).products || [];
    all.push(...products);
    if (products.length < 250) break;
  }
  return all;
}

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

async function downloadCover(item, url) {
  if (!url) return null;
  const dir = path.join(COVER_ROOT, item.platformKey);
  const file = path.join(dir, `${slug(item.id)}.jpg`);
  const relative = `./covers/preorders/${item.platformKey}/${path.basename(file)}`;
  if (await exists(file)) return relative;
  await mkdir(dir, { recursive: true });
  const sized = new URL(url);
  sized.searchParams.set('width', '560');
  sized.searchParams.set('format', 'jpg');
  const response = await fetch(sized, { headers: { 'user-agent': 'Game Vault preorder index' } });
  if (!response.ok) return null;
  await writeFile(file, Buffer.from(await response.arrayBuffer()));
  return relative;
}

const rows = [];
for (const source of collections) {
  const products = await fetchProducts(source.handle);
  for (const product of products) {
    if (!/pre-?order/i.test(product.title) || !source.match.test(product.title)) continue;
    if (source.key === 'sw' && /switch 2/i.test(product.title)) continue;
    if (/\bULT PRO\b/i.test(product.title)) continue;
    const available = product.variants?.some(v => v.available) ?? false;
    const item = {
      id: `${source.key}-${product.handle}`,
      platformKey: source.key,
      platform: source.platform,
      title: clean(product.title),
      rawTitle: product.title,
      edition: edition(product.title),
      region: region(product.title),
      language: 'Verify',
      media: media(product.title, product.body_html),
      release: releaseDate(product.body_html),
      availability: available ? 'Preorder open' : 'Sold out / restock watch',
      seller: 'Video Games Plus',
      url: `https://videogamesplus.ca/products/${product.handle}`,
      cover: null,
      coverSource: product.images?.[0]?.src || null,
      verified: TODAY,
    };
    rows.push(item);
  }
}

// The PS4 lane is curated: retain a PS4 retailer edition only when a matching
// PS5 edition is in the live catalog. Exceptional PS4-only picks can be added
// individually to supplemental-preorders.json after editorial review.
const comparableTitle = title => title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const ps5ByTitle = new Map(rows.filter(item => item.platformKey === 'ps').map(item => [comparableTitle(item.title), item]));
rows.splice(0, rows.length, ...rows.filter(item => {
  if (item.platformKey !== 'ps4') return true;
  const ps5Edition = ps5ByTitle.get(comparableTitle(item.title));
  if (!ps5Edition) return false;
  item.ps5Url = ps5Edition.url;
  return true;
}));

const workers = Array.from({ length: 18 }, async () => {
  while (true) {
    const item = rows.find(row => row.cover === null && row.coverSource !== undefined);
    if (!item) return;
    const source = item.coverSource;
    delete item.coverSource;
    item.cover = await downloadCover(item, source);
  }
});
await Promise.all(workers);
// Direct publisher and retailer listings cover editions missing from the collection feed.
// Keep these editorial entries separate so subsequent refreshes preserve their provenance.
const supplemental = JSON.parse(await readFile(path.join(ROOT, 'supplemental-preorders.json'), 'utf8'));
const byId = new Map(rows.map(item => [item.id, item]));
for (const item of supplemental.items) {
  if (byId.has(item.id)) continue;
  rows.push({ ...item, verified: TODAY });
}
for (const [id, alternatives] of Object.entries(supplemental.alternatives)) {
  const item = byId.get(id);
  if (item) item.alternatives = alternatives;
}
rows.sort((a, b) => a.platform.localeCompare(b.platform) || a.title.localeCompare(b.title) || a.edition.localeCompare(b.edition));
await writeFile(path.join(ROOT, 'preorders.json'), JSON.stringify({ updated: TODAY, source: 'Video Games Plus collections and verified direct listings', count: rows.length, items: rows }, null, 2) + '\n');
console.log(`Wrote ${rows.length} preorder editions (${rows.filter(x => x.availability === 'Preorder open').length} open).`);
