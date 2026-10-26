import {readFile, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base = new URL(process.argv[2] || 'https://posse-pop.github.io/');
if (base.protocol !== 'https:' && base.hostname !== '127.0.0.1') throw Error('HTTPS required');
const root = new URL('../dist/', import.meta.url), files = [];
async function walk(dir, prefix = '') {
  for (const e of await readdir(dir, {withFileTypes:true})) {
    const file = prefix + e.name;
    if (e.isDirectory()) await walk(new URL(e.name + '/', dir), file + '/');
    else files.push(file);
  }
}
await walk(root);
const hash = b => createHash('sha256').update(b).digest('hex');
for (const file of files) {
  const response = await fetch(new URL(file, base), {cache:'no-store'});
  if (!response.ok) throw Error(`${file}: HTTP ${response.status}`);
  const actual = Buffer.from(await response.arrayBuffer());
  if (hash(actual) !== hash(await readFile(new URL(file, root)))) throw Error(`${file}: content mismatch`);
}
const response = await fetch(base, {cache:'no-store'});
if (!response.ok || hash(Buffer.from(await response.arrayBuffer())) !== hash(await readFile(new URL('index.html', root)))) throw Error('Root entry mismatch');
console.log(JSON.stringify({url:base.href, checkedAt:new Date().toISOString(), files:files.length, root:true, sha256:'all matched'}, null, 2));
