// Guard: todo <DndContext> do Engine tem id fixo. Sem ele o @dnd-kit gera
// "DndDescribedBy-N" por contador global, que diverge entre o HTML do servidor
// e o cliente (hydration mismatch) e deixa o aria-describedby apontando para
// um id inexistente.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..', 'apps', 'crm', 'src');

function arquivos(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return arquivos(p);
    return /\.tsx$/.test(e.name) ? [p] : [];
  });
}

test('todo <DndContext> tem a prop id', () => {
  const semId = [];
  for (const arq of arquivos(RAIZ)) {
    const src = fs.readFileSync(arq, 'utf8');
    for (const m of src.matchAll(/<DndContext\b([^>]*)>/g)) {
      if (!/\bid=/.test(m[1])) semId.push(path.relative(RAIZ, arq));
    }
  }
  assert.deepEqual(semId, [], `DndContext sem id: ${semId.join(', ')}`);
});
