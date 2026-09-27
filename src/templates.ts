import { Graph } from './graph';

/** Posição em pixels dentro do canvas SVG. */
interface Point { x: number; y: number }

/** @returns Coordenadas do centro do canvas SVG atual (`#canvas`). */
function center(): Point {
  const svg = document.getElementById('canvas') as unknown as SVGSVGElement;
  const r = svg.getBoundingClientRect();
  return { x: r.width / 2, y: r.height / 2 };
}

/**
 * Gera `n` posições distribuídas uniformemente em um círculo ao redor do
 * centro do canvas, começando no topo (ângulo `-90°`) e seguindo no sentido horário.
 *
 * @param n - Quantidade de posições a gerar.
 * @param radius - Raio do círculo em pixels.
 * @returns Lista com `n` posições.
 */
function circleLayout(n: number, radius: number): Point[] {
  const c = center();
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n - Math.PI / 2;
    out.push({ x: c.x + radius * Math.cos(a), y: c.y + radius * Math.sin(a) });
  }
  return out;
}

/**
 * Gera posições em grade `rows`×`cols`, centralizada no canvas, varrendo
 * linha por linha (esquerda→direita, cima→baixo).
 *
 * @param rows - Número de linhas.
 * @param cols - Número de colunas.
 * @param gap - Espaçamento em pixels entre posições adjacentes.
 * @returns Lista com `rows * cols` posições.
 */
function gridLayout(rows: number, cols: number, gap = 110): Point[] {
  const c = center();
  const w = (cols - 1) * gap;
  const h = (rows - 1) * gap;
  const out: Point[] = [];
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      out.push({ x: c.x - w / 2 + col * gap, y: c.y - h / 2 + r * gap });
    }
  }
  return out;
}

/**
 * Substitui o grafo por vértices novos nas posições dadas (um por posição,
 * na ordem informada), preservando o valor atual de `graph.directed`.
 *
 * @param graph - Grafo a limpar e repopular.
 * @param positions - Posições dos novos vértices; seus ids seguem a ordem do array (0, 1, 2, ...).
 */
function reset(graph: Graph, positions: Point[]): void {
  const directed = graph.directed;
  graph.clear();
  graph.directed = directed;
  for (const p of positions) graph.addVertex(p.x, p.y);
}

/**
 * Aplica um template pré-definido ao grafo, substituindo todo o conteúdo
 * atual (equivalente a {@link Graph.clear} seguido de vértices/arestas novos).
 * Nomes desconhecidos são ignorados silenciosamente (grafo fica vazio).
 *
 * @param name - Nome do template: `'path'`, `'cycle'`, `'star'`, `'grid'`,
 *   `'tree'`, `'complete'`, `'petersen'`, `'twoComponents'` ou `'random'`
 *   (correspondem aos `data-template` dos botões em `index.html`).
 * @param graph - Grafo a ser substituído.
 */
export function loadTemplate(name: string, graph: Graph): void {
  switch (name) {
    case 'path': {
      const n = 6;
      const gap = 110;
      const c = center();
      const w = (n - 1) * gap;
      const pts: Point[] = [];
      for (let i = 0; i < n; i++) {
        pts.push({ x: c.x - w / 2 + i * gap, y: c.y });
      }
      reset(graph, pts);
      for (let i = 0; i < n - 1; i++) graph.addEdge(i, i + 1);
      break;
    }

    case 'cycle': {
      const n = 6;
      reset(graph, circleLayout(n, 160));
      for (let i = 0; i < n; i++) graph.addEdge(i, (i + 1) % n);
      break;
    }

    case 'star': {
      const n = 6;
      reset(graph, circleLayout(n, 160));
      for (let i = 1; i < n; i++) graph.addEdge(0, i);
      break;
    }

    case 'grid': {
      const R = 3, C = 3;
      reset(graph, gridLayout(R, C));
      const idx = (r: number, col: number) => r * C + col;
      for (let r = 0; r < R; r++) {
        for (let col = 0; col < C; col++) {
          if (col + 1 < C) graph.addEdge(idx(r, col), idx(r, col + 1));
          if (r + 1 < R) graph.addEdge(idx(r, col), idx(r + 1, col));
        }
      }
      break;
    }

    case 'tree': {
      const c = center();
      const layout: Point[] = [
        { x: c.x, y: c.y - 120 },
        { x: c.x - 130, y: c.y },
        { x: c.x + 130, y: c.y },
        { x: c.x - 220, y: c.y + 120 },
        { x: c.x - 60, y: c.y + 120 },
        { x: c.x + 60, y: c.y + 120 },
        { x: c.x + 220, y: c.y + 120 },
      ];
      reset(graph, layout);
      for (let i = 0; i < 3; i++) {
        graph.addEdge(i, 2 * i + 1);
        graph.addEdge(i, 2 * i + 2);
      }
      break;
    }

    case 'complete': {
      const n = 5;
      reset(graph, circleLayout(n, 150));
      for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++) graph.addEdge(i, j);
      break;
    }

    case 'petersen': {
      const outer = circleLayout(5, 190);
      const inner = circleLayout(5, 80);
      reset(graph, [...outer, ...inner]);
      for (let i = 0; i < 5; i++) graph.addEdge(i, (i + 1) % 5);
      for (let i = 0; i < 5; i++) graph.addEdge(5 + i, 5 + ((i + 2) % 5));
      for (let i = 0; i < 5; i++) graph.addEdge(i, 5 + i);
      break;
    }

    case 'twoComponents': {
      const a = circleLayout(4, 70).map(p => ({ x: p.x - 160, y: p.y }));
      const b = circleLayout(4, 70).map(p => ({ x: p.x + 160, y: p.y }));
      reset(graph, [...a, ...b]);
      for (let i = 0; i < 4; i++) graph.addEdge(i, (i + 1) % 4);
      for (let i = 0; i < 4; i++) graph.addEdge(4 + i, 4 + ((i + 1) % 4));
      break;
    }

    case 'random': {
      const n = 12;
      const svg = document.getElementById('canvas') as unknown as SVGSVGElement;
      const r = svg.getBoundingClientRect();
      const margin = 80;
      const pts: Point[] = [];
      for (let i = 0; i < n; i++) {
        pts.push({
          x: margin + Math.random() * Math.max(1, r.width - 2 * margin),
          y: margin + Math.random() * Math.max(1, r.height - 2 * margin),
        });
      }
      reset(graph, pts);
      for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++)
          if (Math.random() < 0.3) graph.addEdge(i, j);
      break;
    }
  }
}
