import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import vm from 'node:vm';
const root = new URL('../dist/', import.meta.url);
test('Pages root resolves every HTML, manifest and image reference on the new origin', async () => {
  const base = new URL('https://posse-pop.github.io/');
  const html = await readFile(new URL('index.html', root), 'utf8');
  assert.doesNotMatch(html, /cohaq|match3-test|https?:\/\//);
  const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]);
  for (const ref of references) {
    const url = new URL(ref, base);
    assert.equal(url.origin, base.origin);
    await readFile(new URL('.' + url.pathname, root));
  }
  const manifestURL = new URL('./v1.2.0/manifest.webmanifest', base);
  const manifest = JSON.parse(await readFile(new URL('v1.2.0/manifest.webmanifest', root)));
  for (const key of ['id','start_url','scope']) assert.equal(new URL(manifest[key], manifestURL).href, base.href);
  for (const icon of manifest.icons) await readFile(new URL('.' + new URL(icon.src, manifestURL).pathname, root));
  assert.equal(new URL('../', new URL('v1.2.0/app.js', base)).href, base.href);
});
test('distribution contains exactly the current release and every cached resource is same-origin', async () => {
  assert.deepEqual((await readdir(root)).sort(), ['.nojekyll','index.html','sw.js','v1.2.0']);
  const context = vm.createContext({self:{}});
  vm.runInContext(await readFile(new URL('v1.2.0/asset-list.js',root),'utf8'),context);
  const base = new URL('https://posse-pop.github.io/');
  for (const ref of context.self.PRECACHE_FILES) {
    assert.equal(new URL(ref,base).origin, base.origin);
    assert.ok(ref === './' || ref === './index.html' || ref.startsWith('./v1.2.0/'));
  }
});
