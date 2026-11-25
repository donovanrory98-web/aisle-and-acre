// The government's approved premises list (civil marriages and partnerships), published on GOV.UK.
import { odsRows } from './ods.mjs';
import venues from '../data/venues.json';

export const PAGE = 'https://www.gov.uk/government/publications/civil-marriages-and-partnerships-approved-premises-list';
const API = 'https://www.gov.uk/api/content/government/publications/civil-marriages-and-partnerships-approved-premises-list';
const UA = { 'User-Agent': 'AisleAndAcre/1.0 (+https://www.aisleandacre.co.uk/about.html)' };

const STOP = new Set(['the', 'and', 'of', 'at', 'in', 'on', 'a', 'ltd', 'limited', 'hotel', 'house', 'barn', 'barns', 'estate', 'wine', 'vineyard',
  'park', 'place', 'castle', 'farm', 'manor', 'hall', 'court', 'gardens', 'garden', 'club', 'country', 'spa', 'golf', 'racecourse', 'priory',
  'lodge', 'national', 'centre', 'center', 'venue', 'weddings', 'rooms', 'room', 'sussex', 'east', 'west']);
export const norm = (s) => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/['’]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const COMMON = new Set(['south', 'north', 'old', 'new', 'grand', 'little', 'great', 'royal', 'high', 'upper', 'lower', 'long', 'white', 'green', 'red', 'black', 'st']);
// Distinctive words only; a name made of general words (e.g. South Lodge) must match in full.
const keyTokens = (name) => norm(name).split(' ').filter((w) => w && !STOP.has(w) && !COMMON.has(w));
const pc = (s) => norm(s).replace(/ /g, '');
const POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/i;
const SUSSEX = /east sussex|west sussex|brighton (and|&) hove/i;

export function parseRegister(rows) {
  let hi = rows.findIndex((r) => r.some((c) => /premises|venue|name/i.test(c)) && r.some((c) => /post ?code|address|authority|district|council/i.test(c)));
  const head = hi >= 0 ? rows[hi] : [];
  const col = (re) => head.findIndex((c) => re.test(c));
  const nameI = [/premises name|venue name|name of (the )?premises/i, /name/i].map(col).find((i) => i >= 0) ?? 0;
  const pcI = col(/post ?code/i), authI = col(/authority|council|district|registration/i);
  const entries = [];
  for (const r of rows.slice(hi + 1)) {
    const all = r.join(' | ');
    if (!SUSSEX.test(all)) continue;
    const pm = (pcI >= 0 && r[pcI]) ? r[pcI] : ((POSTCODE.exec(all) || [])[0] || '');
    entries.push({ name: r[nameI] || '', postcode: pm.toUpperCase(), authority: authI >= 0 ? r[authI] || '' : '', address: r.filter((c, i) => i !== nameI && i !== authI).join(', ') });
  }
  return { header: head, entries };
}

export function matchVenues(entries) {
  const matched = {}, used = new Set();
  for (const v of venues) {
    const toks = keyTokens(v.name), vpc = pc(v.postcode), full = norm(v.name);
    const hit = entries.findIndex((e) => {
      const hay = norm(e.name + ' ' + e.address), words = hay.split(' ');
      const byName = toks.length ? toks.every((t) => words.includes(t)) : (' ' + hay + ' ').includes(' ' + full + ' ');
      const byPc = vpc && pc(e.postcode) === vpc && (toks.length ? toks.some((t) => words.includes(t)) : hay.includes(full));
      return byName || byPc;
    });
    if (hit >= 0) { matched[v.slug] = entries[hit].name; used.add(hit); }
  }
  return { matched, unlisted: entries.filter((e, i) => !used.has(i)).map((e) => ({ name: e.name, postcode: e.postcode, authority: e.authority })) };
}

export async function fetchRegister() {
  const meta = await (await fetch(API, { headers: UA })).json();
  const blob = JSON.stringify(meta);
  const ods = (blob.match(/https:\/\/assets\.publishing\.service\.gov\.uk\/[^"\\]+?\.ods/) || [])[0];
  if (!ods) throw new Error('No spreadsheet link found on the GOV.UK page');
  const r = await fetch(ods, { headers: UA });
  if (!r.ok) throw new Error('Spreadsheet download failed: ' + r.status);
  const { header, entries } = parseRegister(odsRows(Buffer.from(await r.arrayBuffer())));
  const { matched, unlisted } = matchVenues(entries);
  return { checkedAt: new Date().toISOString(), publishedAt: meta.public_updated_at || null, source: PAGE, file: ods,
    header, sussexCount: entries.length, matched, unlisted };
}
