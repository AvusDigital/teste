'use strict';
// "Store" = onde ficam pedidos, estoque e contadores. Interface mínima (todas async):
//   get(k) set(k,v,ttl) setNX(k,v,ttl) incr(k,ttl) incrBy(k,n) del(k)
const { cfg } = require('../../config');
let cache = null, chave = '';

function getStore() {
  const c = cfg(); const id = c.store + '|' + c.upstash.url;
  if (!cache || chave !== id) { cache = c.store === 'upstash' ? require('./upstash')(c.upstash) : require('./memoria')(); chave = id; }
  return cache;
}
module.exports = { getStore };
