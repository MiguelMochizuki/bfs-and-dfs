/** Vértice posicionado no canvas. */
export interface Vertex {
  /** Identificador único, atribuído sequencialmente por {@link Graph}. */
  id: number;
  /** Posição horizontal em pixels dentro do SVG. */
  x: number;
  /** Posição vertical em pixels dentro do SVG. */
  y: number;
}

/**
 * Aresta entre dois ids de vértices. Se o grafo for não-direcionado, a
 * ordem `from`/`to` é apenas de armazenamento e não afeta a conectividade.
 */
export interface Edge {
  /** Id do vértice de origem. */
  from: number;
  /** Id do vértice de destino. */
  to: number;
}

/** Modos de interação com o canvas, selecionados pelos radio buttons da UI. */
export type InteractionMode =
  | 'addVertex'
  | 'addEdge'
  | 'setStart'
  | 'setEnd'
  | 'remove';

/** Algoritmos de busca suportados pelo simulador. */
export type Algorithm = 'bfs' | 'dfs';

/**
 * Snapshot imutável do estado de execução de um algoritmo em um instante
 * específico, usado para reproduzir a busca passo a passo na UI.
 */
export interface Step {
  /** Ids dos vértices já visitados até este passo. */
  visited: Set<number>;
  /** Vértice sendo processado neste passo, ou `null` nos passos "iniciais". */
  current: number | null;
  /** Fronteira: fila (BFS) ou pilha (DFS) de vértices pendentes. */
  frontier: number[];
  /** Arestas que compõem a árvore de busca até este passo. */
  treeEdges: [number, number][];
  /** Mapa filho → pai na árvore de busca; a raiz aponta para `null`. */
  parent: Map<number, number | null>;
  /** Caminho de origem até destino, vazio até ser encontrado. */
  path: number[];
  /** Ordem de visita dos vértices, acumulada até este passo. */
  order: number[];
  /** `true` no último passo da execução (sucesso ou exaustão). */
  finished: boolean;
  /** `true` somente se um destino foi definido e alcançado. */
  found: boolean;
}

/** Resultado completo de uma execução de {@link bfs} ou {@link dfs}. */
export interface RunResult {
  /** Sequência de snapshots, um por vértice processado, do início ao fim. */
  steps: Step[];
  /** `true` somente se um destino foi definido e alcançado. */
  found: boolean;
  /** Caminho de origem até destino; vazio se não encontrado. */
  path: number[];
  /** Ordem final de visita de todos os vértices processados. */
  order: number[];
}
