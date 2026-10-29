// 페이지가 참조하는 파일이 실제로 있는지, 서비스 워커 캐시 목록이 맞는지 확인
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const PUB = path.join(__dirname, '..', 'public');

function resolve(from, ref) {
  if (/^https?:/.test(ref)) return null;
  return ref.startsWith('/') ? path.join(PUB, ref) : path.join(path.dirname(from), ref);
}

for (const page of ['index.html', 'energy-city/index.html', 'century/index.html']) {
  test(`${page}: 참조 파일이 모두 있다`, () => {
    const file = path.join(PUB, page), html = fs.readFileSync(file, 'utf8');
    const refs = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map((m) => m[1]).filter((r) => !r.startsWith('mailto:'));
    for (const r of refs) {
      const p = resolve(file, r); if (!p) continue;
      const target = r.endsWith('/') ? path.join(p, 'index.html') : p;
      assert.ok(fs.existsSync(target), `${page} → ${r} 없음`);
    }
  });
}

test('서비스 워커 캐시 목록의 파일이 모두 있다', () => {
  const sw = fs.readFileSync(path.join(PUB, 'sw.js'), 'utf8');
  const list = JSON.parse(sw.match(/const CORE = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));
  for (const r of list) {
    const p = path.join(PUB, r.endsWith('/') ? r + 'index.html' : r);
    assert.ok(fs.existsSync(p), r);
  }
});
