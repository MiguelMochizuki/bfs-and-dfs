// Smoke test de ponta a ponta: sobe o servidor de dev, dirige o app real
// num Firefox headless (via Playwright) e confere o fluxo DFS + "Continuar".
// Roda com: npm run smoke
import { spawn } from 'node:child_process';
import { firefox } from 'playwright';

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
  const browser = await firefox.launch();
  const page = await browser.newPage();
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(String(err)));

  await page.goto(URL);
  await page.waitForSelector('text=Simulador de BFS e DFS');

  // Ciclo de 6 vértices (v0..v5): entre opostos há exatamente 2 caminhos
  // simples (sentido horário e anti-horário) — bom caso pra testar DFS +
  // "Continuar" e a mensagem de "todos os caminhos explorados".
  await page.click('button[data-template="cycle"]');
  await page.click('input[name="algo"][value="dfs"]');
  await page.click('input[name="mode"][value="setStart"]');
  await page.click('.node[data-id="0"]');
  await page.click('input[name="mode"][value="setEnd"]');
  await page.click('.node[data-id="3"]');
  await page.click('input[name="mode"][value="addVertex"]');

  await page.click('#runBtn');
  const statusAfterRun = await page.textContent('#status');
  assert(
    statusAfterRun.includes('Caminho: v0 → v1 → v2 → v3'),
    `Executar deveria achar o caminho v0→v1→v2→v3, veio: "${statusAfterRun}"`
  );
  assert(
    (await page.getAttribute('#continueBtn', 'disabled')) === null,
    '"Continuar" deveria estar habilitado após achar o 1º caminho'
  );

  await page.click('#continueBtn');
  const statusAfterContinue = await page.textContent('#status');
  assert(
    statusAfterContinue.includes('Caminho 2/2') &&
      statusAfterContinue.includes('v0 → v5 → v4 → v3') &&
      statusAfterContinue.includes('todos os caminhos simples explorados'),
    `"Continuar" deveria mostrar o 2º caminho e esgotar, veio: "${statusAfterContinue}"`
  );
  assert(
    (await page.getAttribute('#continueBtn', 'disabled')) !== null,
    '"Continuar" deveria desabilitar após esgotar os caminhos'
  );

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
