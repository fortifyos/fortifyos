import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const root='public/game-watchlist/';
const profile=fs.readFileSync(root+'game.html','utf8');
const html=fs.readFileSync(root+'discover.html','utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
test('Discovery page has working JavaScript and core controls',()=>{
 assert.ok(script,'Inline discovery module is missing');
 new vm.Script(script,{filename:'discover.html'});
 for(const id of ['find','platform','kind','sort','editorial','radar','more','surprise','status']){
  assert.match(html,new RegExp('id="'+id+'"'));
 }
});
test('Discovery uses published data rather than fabricated live availability',()=>{
 assert.match(script,/fetch\('\.\/intelligence\.json'/);
 assert.match(script,/fetch\('\.\/deals\.json'/);
 assert.match(html,/retailer listing alone does not verify/i);
 assert.match(script,/Old listing · recheck/);
});
test('Per-game profile parses and links to source evidence',()=>{
 const script=profile.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script);
 new vm.Script(script,{filename:'game.html'});
 assert.match(script,/intelligence\.json/);
 assert.match(profile,/Before you buy/);
});
test('Published preorder feed is consistent',()=>{
 const feed=JSON.parse(fs.readFileSync(root+'preorders.json','utf8'));
 assert.ok(Array.isArray(feed.items));
 assert.ok(feed.items.length>0);
 assert.match(feed.updated,/^\d{4}-\d{2}-\d{2}$/);
 assert.ok(feed.items.every(x=>typeof x.title==='string'&&typeof x.url==='string'));
});
