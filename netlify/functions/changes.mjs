// GET /api/changes: venue pages that changed at the last monthly check, waiting for review.
import { getStore } from '@netlify/blobs';

export default async () => {
  const d = await getStore('aisleandacre').get('changes', { type: 'json' }).catch(() => null);
  return new Response(JSON.stringify(d || { checkedAt: null, changed: [], failed: [] }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
};

export const config = { path: '/api/changes' };
