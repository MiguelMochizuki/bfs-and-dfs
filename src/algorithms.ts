import type { Graph } from './graph';
import type { RunResult, Step } from './types';

// ============================================================================
// Utilitários
// ============================================================================

/**
 * Reconstrói o caminho de `start` até `end` seguindo o mapa de pais.
 *
 * @param parent - Mapa filho → pai construído durante a busca.
 * @param start - Id do vértice de origem.
 * @param end - Id do vértice de destino.
 * @returns Sequência de ids de `start` até `end`, ou `[]` se `end` não
 *   estiver conectado a `start` no mapa de pais.
 */
function reconstructPath(
  parent: Map<number, number | null>,
  start: number,
  end: number
): number[] {
  const path: number[] = [];
  const seen = new Set<number>();
  let cur: number | null | undefined = end;

  while (cur !== null && cur !== undefined) {
    if (seen.has(cur)) break; // sanidade: ciclos inesperados
    seen.add(cur);
    path.unshift(cur);
    if (cur === start) return path;
    cur = parent.get(cur) ?? null;
  }
  return []; // não alcançou start
}

/**
 * Fábrica de uma função `snapshot` que grava uma cópia do estado atual da
 * busca em `steps`. Compartilhada por BFS e DFS para manter os passos
 * consistentes.
 *
 * @param steps - Array de saída onde cada chamada à função retornada
 *   inserirá um novo {@link Step}.
 * @param state - Referências mutáveis para o estado vivo da busca (visited,
 *   parent, treeEdges, order, frontier, path, found); cada snapshot copia
 *   esses valores no momento da chamada.
 * @returns Função `snapshot(current, finished?)` que grava um {@link Step}.
 */
function makeSnapshotter(
  steps: Step[],
  state: {
    visited: Set<number>;
    parent: Map<number, number | null>;
    treeEdges: [number, number][];
    order: number[];
    frontier: number[];
    path: number[];
    found: boolean;
  }
) {
  return function snapshot(current: number | null, finished = false): void {
    steps.push({
      visited: new Set(state.visited),
      current,
      frontier: [...state.frontier],
      treeEdges: [...state.treeEdges],
      parent: new Map(state.parent),
      path: [...state.path],
      order: [...state.order],
      finished,
      found: state.found,
    });
  };
}

// ============================================================================
// BFS — Busca em Largura (fila / FIFO)
// ============================================================================

/**
 * Busca em largura de `start` até `end` (ou exaustão, se `end` for `null`).
 *
 * - A fronteira é uma **fila**.
 * - Um vértice é marcado como visitado **ao entrar na fila** (evita
 *   duplicatas), mas só é considerado **processado** ao sair dela.
 * - O destino encerra a busca **quando sai da fila**, não quando entra.
 *   Isso garante que `order` e `frontier` reflitam o estado real.
 *
 * @param graph - Grafo a percorrer.
 * @param start - Id do vértice de origem.
 * @param end - Id do vértice de destino, ou `null` para percorrer todo o
 *   componente conexo de `start` sem parar.
 * @returns Sequência de {@link Step} (um por vértice processado, mais os
 *   snapshots inicial e final) junto com o resultado consolidado.
 */
export function bfs(
  graph: Graph,
  start: number,
  end: number | null
): RunResult {
  const steps: Step[] = [];
  const adj = graph.adjacency();

  // ----- estado da busca -----
  const visited = new Set<number>([start]);
  const parent = new Map<number, number | null>([[start, null]]);
  const treeEdges: [number, number][] = [];
  const order: number[] = [];
  const queue: number[] = [start];

  // `state` é a única fonte de verdade para `path`/`found`: são mutados
  // via `state.path =`/`state.found =`, nunca reatribuindo uma variável
  // externa — senão `snapshot()` continuaria enxergando os valores
  // capturados na criação do objeto, travados (ver `makeSnapshotter`).
  const state = {
    visited,
    parent,
    treeEdges,
    order,
    frontier: queue,
    path: [] as number[],
    found: end === null || start === end,
  };

  const snapshot = makeSnapshotter(steps, state);

  snapshot(null); // estado inicial

  // ----- laço principal -----
  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);

    // destino? encerra aqui, quando ele é de fato processado
    if (end !== null && node === end) {
      state.found = true;
      state.path = reconstructPath(parent, start, end);
      snapshot(node);
      break;
    }

    for (const neighbor of adj.get(node) ?? []) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      parent.set(neighbor, node);
      treeEdges.push([node, neighbor]);
      queue.push(neighbor);
    }

    snapshot(node);
  }

  snapshot(null, true); // estado final
  return { steps, found: state.found, path: state.path, order };
}

// ============================================================================
// DFS — Busca em Profundidade (pilha / LIFO)
// ============================================================================

/**
 * Busca em profundidade de `start` até `end` (ou exaustão, se `end` for `null`).
 *
 * - A fronteira é uma **pilha**.
 * - Visitamos no `pop`, não no `push`: isso evita duplicatas naturalmente
 *   e mantém `order` fiel à ordem real de processamento.
 * - Vizinhos são empilhados em ordem **inversa** para que o primeiro vizinho
 *   seja o primeiro a ser explorado (mantém a ordem "natural" do grafo).
 *
 * @param graph - Grafo a percorrer.
 * @param start - Id do vértice de origem.
 * @param end - Id do vértice de destino, ou `null` para percorrer todo o
 *   componente conexo de `start` sem parar.
 * @returns Sequência de {@link Step} (um por vértice processado, mais os
 *   snapshots inicial e final) junto com o resultado consolidado.
 */
export function dfs(
  graph: Graph,
  start: number,
  end: number | null
): RunResult {
  const steps: Step[] = [];
  const adj = graph.adjacency();

  // ----- estado da busca -----
  const visited = new Set<number>();
  const parent = new Map<number, number | null>();
  const treeEdges: [number, number][] = [];
  const order: number[] = [];
  const stack: number[] = [start];

  let current: number | null = null;

  // `state` é a única fonte de verdade para `path`/`found`: são mutados
  // via `state.path =`/`state.found =`, nunca reatribuindo uma variável
  // externa — senão `snapshot()` continuaria enxergando os valores
  // capturados na criação do objeto, travados (ver `makeSnapshotter`).
  const state = {
    visited,
    parent,
    treeEdges,
    order,
    frontier: stack,
    path: [] as number[],
    found: false,
  };

  const snapshot = makeSnapshotter(steps, state);

  snapshot(current); // estado inicial

  // ----- laço principal -----
  while (stack.length > 0) {
    const node = stack.pop()!;

    // pode haver duplicatas na pilha; ignoramos o que já foi visitado
    if (visited.has(node)) continue;

    visited.add(node);
    current = node;
    order.push(node);

    if (end !== null && node === end) {
      state.found = true;
      state.path = reconstructPath(parent, start, end);
      snapshot(current);
      break;
    }

    // empilha vizinhos na ordem inversa para explorar o primeiro primeiro
    const neighbors = adj.get(node) ?? [];
    for (let i = neighbors.length - 1; i >= 0; i--) {
      const neighbor = neighbors[i];
      if (visited.has(neighbor)) continue;
      if (!parent.has(neighbor)) {
        parent.set(neighbor, node);
        treeEdges.push([node, neighbor]);
      }
      stack.push(neighbor);
    }

    snapshot(current);
  }

  snapshot(null, true); // estado final
  return { steps, found: state.found, path: state.path, order };
}
