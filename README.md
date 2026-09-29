# Simulador de BFS e DFS

Simulador interativo de busca em largura (BFS) e busca em profundidade (DFS)
em grafos. Desenhe vértices e arestas em um canvas SVG, escolha origem e
destino, e acompanhe a busca passo a passo.

## Visão geral

- Crie vértices e arestas clicando no canvas, ou carregue um dos templates
  prontos (caminho, ciclo, estrela, grade, árvore binária, grafo completo,
  grafo de Petersen, dois componentes, aleatório).
- Escolha BFS ou DFS e, opcionalmente, se o grafo é direcionado ou
  não-direcionado.
- Defina um vértice de origem (e, opcionalmente, um destino) e execute a
  busca com "Passo" (um vértice por clique) ou "Completo" (anima até o fim),
  vendo a fronteira (fila/pilha), a árvore de busca e o caminho final
  destacados no canvas. "Resetar" volta ao início da execução atual;
  "Limpar" apaga o grafo inteiro.

## Instalação

Requer [Node.js](https://nodejs.org/) e npm.

```bash
npm install
```

## Uso

```bash
npm run dev
```

Abre o simulador em `http://localhost:5173` (o navegador é aberto
automaticamente). Edite os arquivos em `src/` e a página recarrega sozinha.

Para gerar um build de produção:

```bash
npm run build     # checa tipos e gera os arquivos em dist/
npm run preview   # serve o build gerado, para conferir localmente
```

### Smoke test

```bash
npx playwright install chromium   # só na primeira vez
npm run smoke
```

Sobe o servidor de dev sozinho, roda "Passo" e "Completo" em BFS e DFS num
Chromium headless (via Playwright) e confere o resultado no `#status` real da
página.

## Organização do projeto

```
.
├── index.html          # shell HTML: controles da UI (modos, algoritmo, ações, templates)
├── public/
│   └── favicon.svg
├── scripts/
│   └── smoke.mjs        # smoke test end-to-end (ver seção acima)
├── src/
│   ├── main.ts           # estado global da UI, listeners de DOM, laço de render
│   ├── graph.ts           # classe Graph: lista de adjacência, com bfs()/dfs() como métodos
│   ├── algorithms.ts     # auxiliares das buscas (snapshots passo a passo, reconstrução do caminho)
│   ├── renderer.ts        # desenho do SVG a partir do Graph + passo atual
│   ├── templates.ts       # grafos pré-definidos (caminho, ciclo, grade, Petersen, ...)
│   ├── types.ts            # tipos compartilhados (Vertex, Edge, Step, RunResult, ...)
│   └── style.css
├── tsconfig.json
└── vite.config.ts
```

## Principais ferramentas e stack

- [Vite](https://vitejs.dev/) — dev server e build.
- TypeScript em modo estrito (sem framework de UI; DOM/SVG manipulados diretamente).
- [Playwright](https://playwright.dev/) (Chromium) — smoke test end-to-end.

## Convenção de documentação

Comentários TSDoc em `src/*.ts` seguem a convenção descrita em
[CONTRIBUTING.md](CONTRIBUTING.md).

## Configuração

O único ponto configurável é `vite.config.ts`, que define a porta do
servidor de desenvolvimento (padrão `5173`, com abertura automática do
navegador) e o alvo de compilação do build (`es2020`).
