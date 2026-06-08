// Generates solid-color placeholder PWA icons (Bulldog red #D62828).
// Temporary — replace static/icon-{192,512}.png with real artwork later.
// Run: node scripts/gen-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const crcTable = (() => {
	const t = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		t[n] = c >>> 0;
	}
	return t;
})();

function crc32(buf) {
	let c = 0xffffffff;
	for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length, 0);
	const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body), 0);
	return Buffer.concat([len, body, crc]);
}

function png(size, [r, g, b]) {
	const rowLen = size * 3 + 1;
	const raw = Buffer.alloc(rowLen * size);
	for (let y = 0; y < size; y++) {
		const off = y * rowLen;
		raw[off] = 0; // filter: none
		for (let x = 0; x < size; x++) {
			const p = off + 1 + x * 3;
			raw[p] = r;
			raw[p + 1] = g;
			raw[p + 2] = b;
		}
	}
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(size, 0);
	ihdr.writeUInt32BE(size, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 2; // color type: RGB
	const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	return Buffer.concat([
		sig,
		chunk('IHDR', ihdr),
		chunk('IDAT', deflateSync(raw)),
		chunk('IEND', Buffer.alloc(0))
	]);
}

const red = [0xd6, 0x28, 0x28];
writeFileSync('static/icon-192.png', png(192, red));
writeFileSync('static/icon-512.png', png(512, red));
console.log('Wrote static/icon-192.png and static/icon-512.png');
