// Smoke test de ponta a ponta: sobe o servidor de dev, dirige o app real
// num Chromium headless (via Playwright) e confere "Passo" e "Completo"
// (animação até o fim) em BFS e DFS.
// Roda com: npm run smoke
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = 5173;
const URL = `http://localhost:${PORT}`;

function waitForServer(url, timeoutMs = 30_000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (async function poll() {
      try {
        const res = await fetch(url);
        if (res.ok) return resolve();
      } catch {
        // servidor ainda não respondeu
      }
      if (Date.now() - start > timeoutMs) return reject(new Error('servidor não subiu a tempo'));
      setTimeout(poll, 300);
    })();
  });
}

const server = spawn('npx', ['vite', '--port', String(PORT)], {
  stdio: 'ignore',
});

let exitCode = 0;
try {
  await waitForServer(URL);

  const errors = [];
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(String(err)));

  await page.goto(URL);
  await page.waitForSelector('text=Simulador de BFS e DFS');

  // Ciclo de 6 vértices (v0..v5), origem v0, destino v3 (opostos, 3 arestas
  // no caminho mínimo em qualquer sentido).
  await page.click('button[data-template="cycle"]');
  await page.click('input[name="mode"][value="setStart"]');
  await page.click('.node[data-id="0"]');
  await page.click('input[name="mode"][value="setEnd"]');
  await page.click('.node[data-id="3"]');
  await page.click('input[name="mode"][value="addVertex"]');

  // "Passo": avança 1 por clique.
  await page.click('#stepBtn');
  const statusAfterStep1 = await page.textContent('#status');
  assert(
    statusAfterStep1.startsWith('Passo 1/'),
    `1º clique em "Passo" deveria mostrar "Passo 1/...", veio: "${statusAfterStep1}"`
  );
  await page.click('#stepBtn');
  const statusAfterStep2 = await page.textContent('#status');
  assert(
    statusAfterStep2.startsWith('Passo 2/'),
    `2º clique em "Passo" deveria mostrar "Passo 2/...", veio: "${statusAfterStep2}"`
  );

  // "Completo" (BFS): anima até o fim sozinho, desabilitando os outros
  // botões enquanto roda, achando o caminho mínimo v0→v1→v2→v3.
  await page.click('#resetBtn');
  await page.click('#completeBtn');
  assert(
    (await page.getAttribute('#stepBtn', 'disabled')) !== null,
    '"Passo" deveria desabilitar durante o "Completo"'
  );
  await page.waitForFunction(
    () => !(document.getElementById('stepBtn')).disabled,
    { timeout: 5000 }
  );
  const statusBfsComplete = await page.textContent('#status');
  assert(
    statusBfsComplete.includes('Caminho: v0 → v1 → v2 → v3'),
    `"Completo" (BFS) deveria terminar no caminho mínimo, veio: "${statusBfsComplete}"`
  );
  assert(
    (await page.getAttribute('#completeBtn', 'disabled')) === null,
    '"Completo" deveria reabilitar ao terminar'
  );

  // "Completo" (DFS): funciona direto, sem precisar de "Passo" antes.
  await page.click('input[name="algo"][value="dfs"]');
  await page.click('#completeBtn');
  await page.waitForFunction(
    () => !(document.getElementById('stepBtn')).disabled,
    { timeout: 5000 }
  );
  const statusDfsComplete = await page.textContent('#status');
  assert(
    statusDfsComplete.includes('Caminho: v0 → v1 → v2 → v3'),
    `"Completo" (DFS) deveria terminar num caminho encontrado, veio: "${statusDfsComplete}"`
  );

  // DFS em K5 (origem v0, destino v4): o caminho deve ser o realmente
  // percorrido (v0→v1→v2→v3→v4), não o atalho v0→v4 da primeira descoberta.
  await page.click('button[data-template="complete"]');
  await page.click('input[name="mode"][value="setStart"]');
  await page.click('.node[data-id="0"]');
  await page.click('input[name="mode"][value="setEnd"]');
  await page.click('.node[data-id="4"]');
  await page.click('#completeBtn');
  await page.waitForFunction(
    () => !(document.getElementById('stepBtn')).disabled,
    { timeout: 5000 }
  );
  const statusDfsK5 = await page.textContent('#status');
  assert(
    statusDfsK5.includes('Caminho: v0 → v1 → v2 → v3 → v4'),
    `DFS em K5 deveria seguir o caminho percorrido, veio: "${statusDfsK5}"`
  );

  // Sem destino (recarregar o template zera origem/destino): a busca percorre
  // o componente inteiro e o status não fala em "Caminho" nem "Destino".
  await page.click('button[data-template="complete"]');
  await page.click('input[name="mode"][value="setStart"]');
  await page.click('.node[data-id="0"]');
  for (const algo of ['dfs', 'bfs']) {
    await page.click(`input[name="algo"][value="${algo}"]`);
    await page.click('#completeBtn');
    await page.waitForFunction(
      () => !(document.getElementById('stepBtn')).disabled,
      { timeout: 5000 }
    );
    const statusNoEnd = await page.textContent('#status');
    assert(
      statusNoEnd.includes('Componente percorrido: 5 vértices'),
      `${algo.toUpperCase()} sem destino deveria percorrer o componente, veio: "${statusNoEnd}"`
    );
  }

  await browser.close();

  assert(errors.length === 0, `erros no console do navegador: ${errors.join(' | ')}`);

  console.log('SMOKE TEST OK');
} catch (err) {
  console.error('SMOKE TEST FALHOU:', err.message);
  exitCode = 1;
} finally {
  server.kill();
}
process.exit(exitCode);

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
