import type { Step } from './types';

// ============================================================================
// Auxiliares de busca (usados por Graph.bfs / Graph.dfs)
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
export function reconstructPath(
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
export function makeSnapshotter(
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
