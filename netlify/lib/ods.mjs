// Read rows from an OpenDocument spreadsheet (.ods) with no extra packages.
import { inflateRawSync } from 'node:zlib';

export function unzipEntry(buf, name) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Not a zip file');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Bad zip directory');
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), lho = buf.readUInt32LE(p + 42);
    if (buf.toString('utf8', p + 46, p + 46 + nlen) === name) {
      const start = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);
      const data = buf.subarray(start, start + csize);
      return method === 0 ? data : inflateRawSync(data);
    }
    p += 46 + nlen + xlen + clen;
  }
  throw new Error(`${name} not found`);
}

const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&');

export function odsRows(buf, maxCols = 40) {
  const xml = unzipEntry(buf, 'content.xml').toString('utf8');
  const rows = [];
  const rowRe = /<table:table-row\b[^>]*?(?:\/>|>([\s\S]*?)<\/table:table-row>)/g;
  let m;
  while ((m = rowRe.exec(xml))) {
    const cells = [];
    const cellRe = /<table:(?:covered-)?table-cell\b([^>]*?)(?:\/>|>([\s\S]*?)<\/table:(?:covered-)?table-cell>)/g;
    let c;
    while ((c = cellRe.exec(m[1] || ''))) {
      const rep = Math.min(Number((/table:number-columns-repeated="(\d+)"/.exec(c[1]) || [])[1] || 1), maxCols);
      const text = c[2] ? decode(c[2].replace(/<text:line-break\s*\/>/g, ' ').replace(/<text:s(?:\s[^>]*)?\/>/g, ' ')
        .replace(/<\/text:p>\s*<text:p[^>]*>/g, ', ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim() : '';
      for (let k = 0; k < rep && cells.length < maxCols; k++) cells.push(text);
    }
    while (cells.length && !cells[cells.length - 1]) cells.pop();
    if (cells.length) rows.push(cells);
  }
  return rows;
}
