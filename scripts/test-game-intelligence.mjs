import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { readCurated, buildIntelligence, normalizeTitle } from './build-game-intelligence.mjs';

test('Curated entries retain edition and platform identity', () => {
 const html='const raw=\`\nHades II|Switch 2|Crown|Masterpiece|Action|ESRB card|Check region\n\`;';
 const rows=readCurated(html);
 assert.equal(rows.length,1);
 assert.equal(rows[0].title,'Hades II');
 assert.equal(rows[0].id,'Switch 2|Hades II');
 assert.equal(normalizeTitle('Hades II - Switch 2 Edition'),normalizeTitle('Hades II'));
});
test('Initial feed never calls existing products newly discovered', () => {
 const curated=[{title:'Hades II',platform:'Switch 2',matchKey:normalizeTitle('Hades II')}];
 const listings=[{id:'one',title:'Hades II',platformKey:'s2',url:'https://example.com/one',media:'Game-Key Card'}, {id:'two',title:'Unknown indie game',platformKey:'s2',url:'https://example.com/two',media:'Physical media · verify'}];
 const baseline=buildIntelligence({curated,listings,prior:null,date:'2026-11-13',feedDate:'2026-11-12'});
 assert.equal(baseline.counts.physicalListings,2);
 assert.equal(baseline.counts.newlySeenListings,0);
 assert.equal(baseline.candidates[0].mediaStatus,'download-required');
 assert.equal(baseline.candidates[1].discoveryStatus,'research-candidate');
 const later=buildIntelligence({curated,listings:[...listings,{id:'three',title:'Another adventure',platformKey:'s2',url:'https://example.com/three',media:'Full on media'}],prior:baseline,date:'2026-11-14',feedDate:'2026-11-14'});
 assert.equal(later.counts.newlySeenListings,1);
 assert.equal(later.candidates.find(x=>x.id==='one').firstSeen,'2026-11-12');
 assert.equal(later.candidates.find(x=>x.id==='three').mediaStatus,'retailer-full-card-claim');
});
test('Published intelligence data aligns with curated catalog',()=>{
 const db=JSON.parse(fs.readFileSync('public/game-watchlist/intelligence.json','utf8'));
 assert.equal(db.version,1);
 assert.ok(Array.isArray(db.curated));
 assert.ok(Array.isArray(db.candidates));
 assert.equal(db.counts.curatedEntries,db.curated.length);
 assert.equal(db.counts.physicalListings,db.candidates.length);
 assert.ok(db.candidates.every(x=>/^https:\/\//.test(x.url)));
});
