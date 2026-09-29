import type { Edge, Vertex } from './types';

/**
 * Grafo simples (sem laços nem arestas duplicadas).
 * Vértices têm coordenadas para renderização.
 * Funciona como direcionado ou não-direcionado conforme `directed`.
 */
export class Graph {
  vertices = new Map<number, Vertex>();
  edges: Edge[] = [];
  directed = false;
  private nextId = 0;

  /**
   * Cria um vértice em (x, y).
   *
   * @param x - Posição horizontal em pixels.
   * @param y - Posição vertical em pixels.
   * @returns O vértice recém-criado, já inserido em {@link Graph.vertices}.
   */
  addVertex(x: number, y: number): Vertex {
    const v: Vertex = { id: this.nextId++, x, y };
    this.vertices.set(v.id, v);
    return v;
  }

  /**
   * Remove um vértice e todas as arestas incidentes a ele.
   * Não faz nada se `id` não existir.
   *
   * @param id - Id do vértice a remover.
   */
  removeVertex(id: number): void {
    if (!this.vertices.has(id)) return;
    this.vertices.delete(id);
    this.edges = this.edges.filter(e => e.from !== id && e.to !== id);
  }

  /**
   * Adiciona uma aresta entre `from` e `to`.
   *
   * @param from - Id do vértice de origem.
   * @param to - Id do vértice de destino.
   * @returns `false` sem modificar o grafo se `from === to`, se algum dos
   *   dois ids não existir, ou se a aresta já existir; `true` caso contrário.
   */
  addEdge(from: number, to: number): boolean {
    if (from === to) return false;
    if (!this.vertices.has(from) || !this.vertices.has(to)) return false;
    if (this.hasEdge(from, to)) return false;
    this.edges.push({ from, to });
    return true;
  }

  /**
   * Verifica se existe aresta entre `from` e `to`, respeitando
   * {@link Graph.directed}: em grafos não-direcionados, checa também o sentido inverso.
   *
   * @param from - Id do vértice de origem.
   * @param to - Id do vértice de destino.
   * @returns `true` se a aresta existir.
   */
  hasEdge(from: number, to: number): boolean {
    if (this.directed) {
      return this.edges.some(e => e.from === from && e.to === to);
    }
    return this.edges.some(
      e =>
        (e.from === from && e.to === to) ||
        (e.from === to && e.to === from)
    );
  }

  /**
   * Remove a aresta entre `from` e `to` (em ambos os sentidos, se o grafo
   * for não-direcionado).
   *
   * @param from - Id do vértice de origem.
   * @param to - Id do vértice de destino.
   */
  removeEdge(from: number, to: number): void {
    this.edges = this.edges.filter(e => {
      if (this.directed) return !(e.from === from && e.to === to);
      return !(
        (e.from === from && e.to === to) ||
        (e.from === to && e.to === from)
      );
    });
  }

  /**
   * Constrói o índice de adjacência (id → ids vizinhos) em uma única passada
   * sobre {@link Graph.edges}, O(V+E). Em grafos não-direcionados, cada aresta
   * aparece nos dois sentidos. Cada lista preserva a ordem de inserção das
   * arestas. O índice é um retrato: reconstrua-o após qualquer mutação.
   *
   * @returns Mapa de cada vértice para os ids dos vértices adjacentes.
   */
  adjacency(): Map<number, number[]> {
    const adj = new Map<number, number[]>();
    for (const id of this.vertices.keys()) adj.set(id, []);
    for (const e of this.edges) {
      adj.get(e.from)!.push(e.to);
      if (!this.directed) adj.get(e.to)!.push(e.from);
    }
    return adj;
  }

  /** Apaga tudo, reiniciando os ids. */
  clear(): void {
    this.vertices.clear();
    this.edges = [];
    this.nextId = 0;
  }

  /** Quantidade de vértices. */
  get size(): number {
    return this.vertices.size;
  }
}
