// GET /api/register: which of our venues appear on the latest official list.
import { getStore } from '@netlify/blobs';

const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });

export default async () => {
  const d = await getStore('aisleandacre').get('register', { type: 'json' }).catch(() => null);
  if (!d) return json({ pending: true, venues: {} });
  const venues = Object.fromEntries(Object.keys(d.matched).map((k) => [k, true]));
  return json({ checkedAt: d.checkedAt, publishedAt: d.publishedAt, source: d.source, sussexCount: d.sussexCount, venues, unlistedCount: d.unlisted.length, unlisted: d.unlisted });
};

export const config = { path: '/api/register' };
