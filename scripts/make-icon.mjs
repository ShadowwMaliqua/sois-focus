// Génère build/icon.png (512x512) : un œil/cible vert, sans dépendance externe.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const N = 512;
const raw = Buffer.alloc((N * 4 + 1) * N);

for (let y = 0; y < N; y++) {
  raw[y * (N * 4 + 1)] = 0;
  for (let x = 0; x < N; x++) {
    const dx = x - N / 2 + 0.5, dy = y - N / 2 + 0.5;
    const r = Math.hypot(dx, dy);
    let c = [0, 0, 0, 0];
    if (r < 240) c = [24, 28, 38, 255];                // fond sombre
    if (r < 240 && r > 205) c = [52, 211, 153, 255];   // anneau vert
    if (r < 150 && r > 118) c = [52, 211, 153, 255];   // second anneau
    if (r < 62) c = [52, 211, 153, 255];               // pupille
    if (r < 62 && Math.hypot(dx + 20, dy + 20) < 18) c = [236, 253, 245, 255]; // reflet
    const o = y * (N * 4 + 1) + 1 + x * 4;
    raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2]; raw[o + 3] = c[3];
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4);
ihdr[8] = 8; ihdr[9] = 6; // 8 bits, RGBA

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);
mkdirSync(join(root, 'build'), { recursive: true });
writeFileSync(join(root, 'build', 'icon.png'), png);
console.log('build/icon.png créé');
