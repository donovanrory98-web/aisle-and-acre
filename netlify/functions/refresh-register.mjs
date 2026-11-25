// Every Monday: re-read the government's approved premises list and cross-check our venues.
import { getStore } from '@netlify/blobs';
import { fetchRegister } from '../lib/register.mjs';

export default async () => {
  const data = await fetchRegister();
  await getStore('aisleandacre').setJSON('register', data);
  console.log(`Register: ${data.sussexCount} Sussex entries, ${Object.keys(data.matched).length} of our venues matched`);
};

export const config = { schedule: '10 5 * * 1' };
