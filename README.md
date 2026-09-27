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
  busca de uma vez ou passo a passo, vendo a fronteira (fila/pilha), a
  árvore de busca e o caminho final destacados no canvas.

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

## Configuração

O único ponto configurável é `vite.config.ts`, que define a porta do
servidor de desenvolvimento (padrão `5173`, com abertura automática do
navegador) e o alvo de compilação do build (`es2020`).
