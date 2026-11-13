import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve('public/game-watchlist');
const OUTPUT = path.join(ROOT, 'intelligence.json');
const today = () => new Date().toISOString().slice(0, 10);
export const normalizeTitle = value => String(value || '').toLowerCase()
  .replace(/[™®]/g, '')
  .replace(/\s*[–—-]\s*(?:nintendo )?switch\s*2\s*edition(?:\s*\+.*)?$/i,'')
  .replace(/\s*[–—-]\s*(?:nintendo )?switch\s*2$/i,'')
  .replace(/[^a-z0-9]+/g, ' ').trim();

export function readCurated(html) {
  const section = html.match(/const raw=\`\n([\s\S]*?)\`;/);
  if (!section) throw new Error('Ultimate collection data block not found');
  const rows = section[1].trim().split('\n').map(line => line.split('|'));
  if (rows.some(x => x.length !== 7)) throw new Error('Malformed curated catalog entry');
  return rows.map(([title, platform, tier, lane, genre, edition, media]) => ({
    id: platform + '|' + title, title, platform, tier, lane, genre,
    edition, media, matchKey: normalizeTitle(title)
  }));
}

export function buildIntelligence({ curated, listings, prior, date, feedDate }) {
  if (!Array.isArray(listings) || !Array.isArray(curated)) throw new Error('Expected catalog arrays');
  const platformMap = {sw: 'Switch', s2: 'Switch 2', ps: 'PS5', ps4: 'PS4'};
  const index = new Set(curated.map(x => x.platform + '|' + x.matchKey));
  const priorById = new Map((prior?.candidates || []).map(x => [x.id, x]));
  const initialized = Boolean(prior?.version === 1 && Array.isArray(prior.candidates));
  const unique = new Set();
  const candidates = [];
  for (const x of listings) {
    if (!x || !x.id || !x.title || !platformMap[x.platformKey] || !/^https:\/\//.test(x.url || '')) continue;
    const id = String(x.id);
    if (unique.has(id)) continue;
    unique.add(id);
    const platform = platformMap[x.platformKey];
    const media = String(x.media || 'Physical media · verify');
    const mediaStatus = /game.key|download code|code.in.box/i.test(media)
      ? 'download-required' : /full on media/i.test(media)
      ? 'retailer-full-card-claim' : 'format-unverified';
    const old = priorById.get(id);
    const inCatalog = index.has(platform + '|' + normalizeTitle(x.title));
    candidates.push({
      id, title: String(x.title), platform, platformKey: x.platformKey,
      edition: String(x.edition || 'Standard'), region: String(x.region || 'Unverified'),
      language: String(x.language || 'Unverified'), release: String(x.release || 'TBD'),
      media, mediaStatus, availability: String(x.availability || 'Check source'),
      seller: String(x.seller || 'Retailer'), url: String(x.url),
      cover: String(x.cover || ''),
      checkedAt: String(x.verified || feedDate || ''),
      firstSeen: old?.firstSeen || (initialized ? date : (feedDate || date)),
      lastSeen: date,
      newSinceBaseline: initialized ? (old?.newSinceBaseline ?? !old) : false,
      inCuratedCatalog: inCatalog,
      discoveryStatus: inCatalog ? 'cataloged' : 'research-candidate'
    });
  }
  candidates.sort((a,b)=>a.platform.localeCompare(b.platform)||a.title.localeCompare(b.title)||a.edition.localeCompare(b.edition));
  return {
    version: 1, builtAt: date, sourceFeedDate: feedDate || null,
    purpose: 'Physical release research; no automatic verified availability or full-on-cartridge claims',
    methodology: {
      catalog: 'Existing Game Vault curated records',
      candidates: 'Published retailer/preorder feed (not independent format or stock testing)',
      freshness: 'firstSeen is preserved across daily builds; initial imports are baseline, not new releases',
      format: 'retailer-full-card-claim means listing text only, not verified ESRB cartridge contents'
    },
    counts: {
      curatedEntries: curated.length,
      physicalListings: candidates.length,
      titlesNotCurated: candidates.filter(x=>!x.inCuratedCatalog).length,
      newlySeenListings: candidates.filter(x=>x.newSinceBaseline && x.firstSeen===date).length,
      fullMediaClaims: candidates.filter(x=>x.mediaStatus==='retailer-full-card-claim').length,
      formatUnverified: candidates.filter(x=>x.mediaStatus==='format-unverified').length
    },
    curated,
    candidates
  };
}

async function main() {
  const [html, feedText] = await Promise.all([
    fs.readFile(path.join(ROOT, 'ultimate.html'), 'utf8'),
    fs.readFile(path.join(ROOT, 'preorders.json'), 'utf8')
  ]);
  const feed = JSON.parse(feedText);
  if (!feed.updated || !Array.isArray(feed.items)) throw new Error('Preorder feed incomplete');
  let prior=null;
  try { prior=JSON.parse(await fs.readFile(OUTPUT,'utf8')); } catch(e) { if(e.code!=='ENOENT') throw e; }
  const record=buildIntelligence({
    curated:readCurated(html),listings:feed.items,prior,
    date:today(),feedDate:feed.updated
  });
  await fs.writeFile(OUTPUT, JSON.stringify(record,null,2)+'\n');
  console.log('Game intelligence built:',record.counts);
}
if (process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) await main();
