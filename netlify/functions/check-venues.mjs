// On the 1st of each month: look at every venue's own web page and flag any that changed, for a person to review.
import { createHash } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import venues from '../data/venues.json';

const UA = { 'User-Agent': 'AisleAndAcre/1.0 (+https://www.aisleandacre.co.uk/about.html)' };
const textOf = (html) => html.replace(/<(script|style|noscript|svg|iframe)[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

export default async () => {
  const store = getStore('aisleandacre');
  const prev = (await store.get('pages', { type: 'json' }).catch(() => null)) || { hashes: {} };
  const hashes = { ...prev.hashes }, changed = [], failed = [];
  const queue = [...venues];
  const work = async () => {
    while (queue.length) {
      const v = queue.shift();
      try {
        const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 9000);
        const r = await fetch(v.source, { headers: UA, signal: ctl.signal, redirect: 'follow' }); clearTimeout(t);
        if (!r.ok) { failed.push({ slug: v.slug, name: v.name, url: v.source, status: r.status }); continue; }
        const h = createHash('sha256').update(textOf(await r.text())).digest('hex');
        if (prev.hashes[v.slug] && prev.hashes[v.slug] !== h) changed.push({ slug: v.slug, name: v.name, url: v.source });
        hashes[v.slug] = h;
      } catch (e) { failed.push({ slug: v.slug, name: v.name, url: v.source, status: 'no response' }); }
    }
  };
  await Promise.all(Array.from({ length: 6 }, work));
  const checkedAt = new Date().toISOString();
  await store.setJSON('pages', { hashes, checkedAt });
  await store.setJSON('changes', { checkedAt, firstRun: !Object.keys(prev.hashes).length, changed, failed });
  console.log(`Checked ${venues.length} venue pages: ${changed.length} changed, ${failed.length} failed`);
};

export const config = { schedule: '20 4 1 * *' };
