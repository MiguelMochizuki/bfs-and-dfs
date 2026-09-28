import type { Graph } from './graph';
import type { Step } from './types';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Raio dos círculos dos vértices, em pixels; também usado para encurtar as arestas nas pontas. */
export const NODE_RADIUS = 22;

/** Estado necessário para redesenhar o grafo e refletir origem, destino e o passo atual da busca. */
export interface RenderContext {
  /** Grafo a desenhar. */
  graph: Graph;
  /** Id do vértice de origem selecionado, ou `null`. */
  startId: number | null;
  /** Id do vértice de destino selecionado, ou `null`. */
  endId: number | null;
  /** Passo atual da execução a exibir, ou `null` se nenhuma busca foi executada. */
  step: Step | null;
  /** Id do vértice já clicado ao criar uma aresta (aguardando o segundo clique), ou `null`. */
  pendingEdgeFrom: number | null;
}

/**
 * Renderiza o grafo inteiro no SVG dado: limpa todo o conteúdo anterior e
 * redesenha arestas e vértices a partir do zero (sem diffing).
 *
 * @param svg - Elemento SVG alvo; seu conteúdo é totalmente substituído.
 * @param ctx - Grafo a desenhar, mais estado de UI (origem, destino,
 *   passo atual, aresta pendente) usado para colorir/classificar os elementos.
 */
export function renderGraph(svg: SVGSVGElement, ctx: RenderContext): void {
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  for (const e of ctx.graph.edges) {
    const a = ctx.graph.vertices.get(e.from);
    const b = ctx.graph.vertices.get(e.to);
    if (!a || !b) continue;

    const isTree = ctx.step?.treeEdges.some(
      ([x, y]) =>
        (x === e.from && y === e.to) ||
        (!ctx.graph.directed && x === e.to && y === e.from)
    ) ?? false;

    const isPath = isEdgeInPath(
      e.from,
      e.to,
      ctx.step?.path ?? [],
      ctx.graph.directed
    );

    drawEdge(
      svg,
      a.x,
      a.y,
      b.x,
      b.y,
      e.from,
      e.to,
      isTree,
      isPath,
      ctx.graph.directed
    );
  }

  for (const v of ctx.graph.vertices.values()) {
    drawNode(svg, v.id, v.x, v.y, ctx);
  }
}

/**
 * Verifica se a aresta `a`-`b` faz parte do caminho final destacado.
 *
 * @param a - Id de uma das pontas da aresta.
 * @param b - Id da outra ponta da aresta.
 * @param path - Sequência de vértices do caminho final (pode ser vazia).
 * @param directed - Se `true`, só considera o par na ordem `a` → `b`.
 * @returns `true` se `a`-`b` for um segmento consecutivo de `path`.
 */
function isEdgeInPath(
  a: number,
  b: number,
  path: number[],
  directed: boolean
): boolean {
  for (let i = 0; i < path.length - 1; i++) {
    if (
      (path[i] === a && path[i + 1] === b) ||
      (!directed && path[i] === b && path[i + 1] === a)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Desenha uma aresta como uma linha entre os dois vértices, encurtada em
 * {@link NODE_RADIUS} em cada ponta para não sobrepor os círculos dos nós.
 * Se `directed`, também desenha uma seta (polígono) na ponta de destino.
 *
 * @param svg - Elemento SVG onde os elementos serão inseridos.
 * @param x1 - Posição x do vértice de origem.
 * @param y1 - Posição y do vértice de origem.
 * @param x2 - Posição x do vértice de destino.
 * @param y2 - Posição y do vértice de destino.
 * @param from - Id do vértice de origem (usado em `dataset.edge`).
 * @param to - Id do vértice de destino (usado em `dataset.edge`).
 * @param isTree - Se `true`, aplica a classe CSS `tree` (aresta da árvore de busca).
 * @param isPath - Se `true`, aplica a classe CSS `path` (aresta do caminho final); tem prioridade sobre `isTree`.
 * @param directed - Se `true`, desenha também a seta indicando o sentido.
 */
function drawEdge(
  svg: SVGSVGElement,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  from: number,
  to: number,
  isTree: boolean,
  isPath: boolean,
  directed: boolean
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;

  const sx = x1 + ux * NODE_RADIUS;
  const sy = y1 + uy * NODE_RADIUS;
  const ex = x2 - ux * NODE_RADIUS;
  const ey = y2 - uy * NODE_RADIUS;

  const line = document.createElementNS(SVG_NS, 'line');
  line.setAttribute('x1', String(sx));
  line.setAttribute('y1', String(sy));
  line.setAttribute('x2', String(ex));
  line.setAttribute('y2', String(ey));
  let cls = 'edge';
  if (isPath) cls += ' path';
  else if (isTree) cls += ' tree';
  line.setAttribute('class', cls);
  line.dataset.edge = `${from}-${to}`;
  svg.appendChild(line);

  if (directed) {
    const arrowLen = 12;
    const arrowWidth = 6;
    const tipX = ex;
    const tipY = ey;
    const baseX = tipX - ux * arrowLen;
    const baseY = tipY - uy * arrowLen;
    const px = -uy;
    const py = ux;

    const pts = [
      [tipX, tipY],
      [baseX + px * arrowWidth, baseY + py * arrowWidth],
      [baseX - px * arrowWidth, baseY - py * arrowWidth],
    ];

    const poly = document.createElementNS(SVG_NS, 'polygon');
    poly.setAttribute('points', pts.map(p => p.join(',')).join(' '));
    let cls2 = 'edge directed-marker';
    if (isPath) cls2 += ' path';
    else if (isTree) cls2 += ' tree';
    poly.setAttribute('class', cls2);
    poly.dataset.edge = `${from}-${to}`;
    svg.appendChild(poly);
  }
}

/**
 * Desenha um vértice como um grupo `<g>` contendo um círculo e seu id como rótulo.
 *
 * @param svg - Elemento SVG onde o grupo será inserido.
 * @param id - Id do vértice, usado como rótulo e em `dataset.id`.
 * @param x - Posição x do centro do vértice.
 * @param y - Posição y do centro do vértice.
 * @param ctx - Contexto de renderização usado para determinar as classes CSS (via {@link nodeClass}).
 */
function drawNode(
  svg: SVGSVGElement,
  id: number,
  x: number,
  y: number,
  ctx: RenderContext
): void {
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', nodeClass(id, ctx));
  g.dataset.id = String(id);
  g.setAttribute('transform', `translate(${x}, ${y})`);

  const c = document.createElementNS(SVG_NS, 'circle');
  c.setAttribute('r', String(NODE_RADIUS));
  g.appendChild(c);

  const t = document.createElementNS(SVG_NS, 'text');
  t.textContent = String(id);
  g.appendChild(t);

  svg.appendChild(g);
}

/**
 * Calcula as classes CSS de um vértice a partir do estado de UI e do passo
 * atual do algoritmo. Prioridade quando várias condições se aplicam:
 * `current` > `inpath` > `visited`.
 *
 * @param id - Id do vértice a classificar.
 * @param ctx - Contexto de renderização (origem, destino, aresta pendente, passo atual).
 * @returns Lista de classes separadas por espaço, sempre incluindo `node`.
 */
function nodeClass(id: number, ctx: RenderContext): string {
  const classes = ['node'];
  if (id === ctx.startId) classes.push('start');
  if (id === ctx.endId) classes.push('end');
  if (ctx.pendingEdgeFrom === id) classes.push('current');

  if (ctx.step) {
    if (ctx.step.current === id) classes.push('current');
    else if (ctx.step.found && ctx.step.path.includes(id)) classes.push('inpath');
    else if (ctx.step.visited.has(id)) classes.push('visited');
  }
  return classes.join(' ');
}

/**
 * Converte a posição de um evento de mouse (coordenadas de tela) para
 * coordenadas relativas ao elemento SVG.
 *
 * @param svg - Elemento SVG de referência.
 * @param ev - Evento de mouse contendo `clientX`/`clientY`.
 * @returns Posição `{ x, y }` relativa ao canto superior esquerdo do SVG.
 */
export function svgPoint(
  svg: SVGSVGElement,
  ev: MouseEvent
): { x: number; y: number } {
  const rect = svg.getBoundingClientRect();
  return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
}
