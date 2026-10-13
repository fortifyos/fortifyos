
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDeku,parseMercari} from './update-game-deals.mjs';
test('Current platform price excludes historical low and other platforms',()=>{
 const html='<h4>Current prices</h4><table><tr><td>Switch 2 Digital</td><td>$19.99</td></tr><tr><td>Switch Digital</td><td><s>$39.99</s> $4.99</td></tr></table><h3>Price history</h3><p>All time low $0.99</p>';
 assert.equal(parseDeku(html,'Switch Digital').price,4.99);
 assert.equal(parseDeku(html,'Switch 2 Digital').price,19.99);
 assert.throws(()=>parseDeku(html,'PS5 Digital'));
});
test('Missing price section or unavailable row fails closed',()=>{
 assert.throws(()=>parseDeku('<h3>Price history</h3>$4.99','Switch Digital'));
 assert.throws(()=>parseDeku('<h4>Current prices</h4><table><tr><td>Switch Digital Unavailable $4.99</td></tr></table><h3>Price history</h3>','Switch Digital'));
});
test('Exact Mercari listing checks structured currency and stock',()=>{
 const prefix='<h1>Mortal Kombat Legacy Kollection Switch 2</h1><script type="application/ld+json">';
 const product={'@type':'Product',name:'Mortal Kombat Legacy Kollection',offers:{price:'35.00',priceCurrency:'USD',availability:'https://schema.org/InStock'}};
 assert.equal(parseMercari(prefix+JSON.stringify(product)+'</script>').price,35);
 product.offers.availability='https://schema.org/OutOfStock';
 assert.throws(()=>parseMercari(prefix+JSON.stringify(product)+'</script>'));
});

test('Cross-generation PlayStation rows stay distinct from Nintendo prices',()=>{
 const html='<h4>Current prices</h4><table><tr><td>Switch Digital</td><td>$4.99</td></tr><tr><td>PS5 / PS4 Digital</td><td>$19.99</td></tr></table><h3>Price history</h3>';
 assert.equal(parseDeku(html,'PS5 / PS4 Digital').price,19.99);
});
