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

  // "Continuar"/"Ver tudo rápido" não devem exigir ter rodado "Executar"
  // antes — clicando direto, o backtracking já começa sozinho e mostra o
  // 1º caminho (não pula pro 2º).
  assert(
    (await page.getAttribute('#continueBtn', 'disabled')) === null,
    '"Continuar" deveria estar habilitado sem precisar rodar "Executar" antes'
  );
  await page.click('#continueBtn');
  const statusFirstContinueDireto = await page.textContent('#status');
  assert(
    statusFirstContinueDireto.includes('Caminho 1/2') &&
      statusFirstContinueDireto.includes('v0 → v1 → v2 → v3'),
    `1º clique em "Continuar" sem "Executar" deveria mostrar o 1º caminho, veio: "${statusFirstContinueDireto}"`
  );

  await page.click('#resetBtn');
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

  // esgota num único clique (só há 2 caminhos): o último rastreado é
  // v0→v5→v4→v3, mas como empata em comprimento com v0→v1→v2→v3 (o
  // primeiro achado), o esgotamento deve voltar a mostrar ESTE — prova
  // que exibe o melhor, não o último rastreado.
  await page.click('#continueBtn');
  const statusAfterContinue = await page.textContent('#status');
  assert(
    statusAfterContinue.includes('2 caminhos simples explorados') &&
      statusAfterContinue.includes('melhor: v0 → v1 → v2 → v3') &&
      !statusAfterContinue.includes('v0 → v5 → v4 → v3'),
    `esgotar deveria mostrar o melhor caminho (v0→v1→v2→v3), veio: "${statusAfterContinue}"`
  );
  assert(
    (await page.getAttribute('#continueBtn', 'disabled')) !== null,
    '"Continuar" deveria desabilitar após esgotar os caminhos'
  );

  // "Ver tudo rápido": reseta só a execução (grafo/origem/destino continuam)
  // e confere que o autoplay chega sozinho no mesmo resultado final.
  await page.click('#resetBtn');
  await page.click('#runBtn');
  await page.click('#playAllBtn');
  assert(
    (await page.getAttribute('#runBtn', 'disabled')) !== null,
    '"Executar" deveria desabilitar durante o autoplay'
  );
  await page.waitForFunction(
    () => !(document.getElementById('runBtn')).disabled,
    { timeout: 5000 }
  );
  const statusAfterPlayAll = await page.textContent('#status');
  assert(
    statusAfterPlayAll.includes('2 caminhos simples explorados') &&
      statusAfterPlayAll.includes('melhor: v0 → v1 → v2 → v3'),
    `"Ver tudo rápido" deveria terminar no melhor caminho, veio: "${statusAfterPlayAll}"`
  );
  assert(
    (await page.getAttribute('#playAllBtn', 'disabled')) !== null,
    '"Ver tudo rápido" deveria desabilitar de novo ao esgotar'
  );

  // BFS já acha "o" caminho ótimo de cara: não existe "próximo caminho" a
  // explorar, então "Continuar" vira só um sinônimo de "Passo" (avança 1
  // passo por clique), e "Ver tudo rápido" nem se aplica.
  await page.click('input[name="algo"][value="bfs"]');
  assert(
    (await page.getAttribute('#continueBtn', 'disabled')) === null,
    '"Continuar" deveria estar habilitado em BFS mesmo sem destino (vira "Passo")'
  );
  assert(
    (await page.getAttribute('#playAllBtn', 'disabled')) !== null,
    '"Ver tudo rápido" não deveria existir em BFS'
  );
  await page.click('#continueBtn');
  const statusBfsContinue1 = await page.textContent('#status');
  assert(
    statusBfsContinue1.startsWith('Passo 1/'),
    `"Continuar" em BFS deveria avançar 1 passo, como "Passo", veio: "${statusBfsContinue1}"`
  );
  await page.click('#continueBtn');
  const statusBfsContinue2 = await page.textContent('#status');
  assert(
    statusBfsContinue2.startsWith('Passo 2/'),
    `2º clique em "Continuar" (BFS) deveria ir pro passo 2, veio: "${statusBfsContinue2}"`
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
