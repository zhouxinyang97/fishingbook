const fs = require('fs');
const iconv = require('iconv-lite');

const filePath = process.argv[2];
if (!filePath) {
  process.exit(2);
}

const buffer = fs.readFileSync(filePath);
let nullCount = 0;
for (const b of buffer) if (b === 0x00) nullCount++;

const report = (enc) => {
  let text = '';
  try {
    text = iconv.decode(buffer, enc);
  } catch (e) {
    return { enc, error: String(e.message || e) };
  }
  const sampleLen = Math.min(text.length, 200_000);
  let rep = 0;
  let cjk = 0;
  let ctrl = 0;
  for (let i = 0; i < sampleLen; i++) {
    const code = text.charCodeAt(i);
    if (code === 0xfffd) rep++;
    else if (code >= 0x4e00 && code <= 0x9fff) cjk++;
    else if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) ctrl++;
  }
  const len = Math.max(sampleLen, 1);
  const score = (cjk / len) * 6 - (rep / len) * 20 - (ctrl / len) * 4;
  return { enc, len: text.length, rep, cjk, ctrl, score, sample: text.slice(0, 120).replace(/\r/g, '\\r').replace(/\n/g, '\\n') };
};

const encs = ['utf8', 'gb18030', 'gbk', 'big5', 'utf16le', 'utf16-be'];
console.log(JSON.stringify({
  bytes: buffer.length,
  bom: Array.from(buffer.slice(0, 4)),
  nullRatio: nullCount / Math.max(buffer.length, 1),
  results: encs.map(report)
}, null, 2));
