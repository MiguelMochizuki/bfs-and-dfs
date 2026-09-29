import { makeSnapshotter, reconstructPath } from './algorithms';
import type { Edge, RunResult, Step, Vertex } from './types';

/**
 * Grafo simples (sem laços nem arestas duplicadas) representado por lista de
 * adjacência: `adj` mapeia cada vértice aos seus vizinhos, na ordem em que as
 * arestas foram inseridas, e é a única fonte de verdade das arestas.
 *
 * A lista é **sempre simétrica**: toda seta `u→v` tem a contrapartida `v→u`.
 * Cada seta carrega um bit `mirror`: `false` para a seta desenhada pelo
 * usuário, `true` para a contrapartida criada só para o modo não-direcionado.
 * Alternar {@link Graph.directed} apenas muda quais setas são visíveis
 * (todas × só as primárias), então a troca é exatamente reversível.
 *
 * Vértices têm coordenadas para renderização.
 */
export class Graph {
  /** Vértices por id, na ordem de criação. */
  readonly vertices = new Map<number, Vertex>();
  /** Se o grafo é direcionado; alternar não altera `adj`, só a visão dele. */
  directed = false;
  private adj = new Map<number, Map<number, boolean>>(); // vizinho → é espelho?
  private nextId = 0;

  /**
   * Arestas derivadas da lista de adjacência (uma por par em grafos
   * não-direcionados), para o renderer.
   */
  get edges(): Edge[] {
    const result: Edge[] = [];
    for (const [from, out] of this.adj) {
      for (const [to, mirror] of out) {
        if (this.directed ? !mirror : from < to) result.push({ from, to });
      }
    }
    return result;
  }

  /** Quantidade de vértices. */
  get size(): number {
    return this.vertices.size;
  }

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
    this.adj.set(v.id, new Map());
    return v;
  }

  /**
   * Remove um vértice e todas as arestas incidentes a ele.
   * Não faz nada se `id` não existir.
   *
   * @param id - Id do vértice a remover.
   */
  removeVertex(id: number): void {
    if (!this.vertices.delete(id)) return;
    this.adj.delete(id);
    for (const out of this.adj.values()) out.delete(id);
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
    if (from === to || !this.vertices.has(from) || !this.vertices.has(to)) return false;
    if (this.hasEdge(from, to)) return false;
    this.adj.get(from)!.set(to, false); // se era espelho, vira primária mantendo a posição
    const back = this.adj.get(to)!;
    if (!back.has(from)) back.set(from, true);
    return true;
  }

  /**
   * Verifica se existe aresta de `from` para `to`. Em grafos direcionados só
   * conta a seta primária; nos não-direcionados, qualquer sentido.
   *
   * @param from - Id do vértice de origem.
   * @param to - Id do vértice de destino.
   * @returns `true` se a aresta existir.
   */
  hasEdge(from: number, to: number): boolean {
    const mirror = this.adj.get(from)?.get(to);
    return this.directed ? mirror === false : mirror !== undefined;
  }

  /**
   * Remove a aresta entre `from` e `to` (em ambos os sentidos, se o grafo
   * for não-direcionado). No modo direcionado, se `to→from` também for uma
   * seta primária, ela permanece e `from→to` volta a ser só o seu espelho.
   *
   * @param from - Id do vértice de origem.
   * @param to - Id do vértice de destino.
   */
  removeEdge(from: number, to: number): void {
    const out = this.adj.get(from);
    const back = this.adj.get(to);
    if (!out || !back) return;
    if (this.directed) {
      if (out.get(to) !== false) return;
      if (back.get(from) === false) {
        out.set(to, true);
        return;
      }
    }
    out.delete(to);
    back.delete(from);
  }

  /**
   * Vizinhos de `id`, na ordem de inserção das arestas. Em grafos
   * direcionados, só os alcançáveis por setas primárias.
   *
   * @param id - Id do vértice.
   * @returns Ids dos vértices adjacentes (vazio se `id` não existir).
   */
  neighbors(id: number): number[] {
    const result: number[] = [];
    for (const [v, mirror] of this.adj.get(id) ?? []) {
      if (!(this.directed && mirror)) result.push(v);
    }
    return result;
  }

  /** Apaga tudo, reiniciando os ids. */
  clear(): void {
    this.vertices.clear();
    this.adj.clear();
    this.nextId = 0;
  }

  // ===================== BFS =====================

  /**
   * Busca em largura de `start` até `end` (ou exaustão, se `end` for `null`).
   *
   * - A fronteira é uma **fila**.
   * - Um vértice é marcado como visitado **ao entrar na fila** (evita
   *   duplicatas), mas só é considerado **processado** ao sair dela.
   * - O destino encerra a busca **quando sai da fila**, não quando entra.
   *   Isso garante que `order` e `frontier` reflitam o estado real.
   *
   * @param start - Id do vértice de origem.
   * @param end - Id do vértice de destino, ou `null` para percorrer todo o
   *   componente conexo de `start` sem parar.
   * @returns Sequência de {@link Step} (um por vértice processado, mais os
   *   snapshots inicial e final) junto com o resultado consolidado.
   */
  bfs(start: number, end: number | null): RunResult {
    const steps: Step[] = [];

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
      found: start === end,
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

      for (const neighbor of this.neighbors(node)) {
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

  // ===================== DFS (iterativo) =====================

  /**
   * Busca em profundidade de `start` até `end` (ou exaustão, se `end` for `null`).
   *
   * - A fronteira é uma **pilha** de pares (vértice, pai).
   * - Visitamos no `pop`, não no `push`: isso evita duplicatas naturalmente
   *   e mantém `order` fiel à ordem real de processamento.
   * - O pai (e a aresta da árvore) é fixado no `pop`: é o de quem empilhou a
   *   cópia que efetivamente saiu da pilha, não o de quem descobriu o vértice.
   * - Vizinhos são empilhados em ordem **inversa** para que o primeiro vizinho
   *   seja o primeiro a ser explorado.
   *
   * @param start - Id do vértice de origem.
   * @param end - Id do vértice de destino, ou `null` para percorrer todo o
   *   componente conexo de `start` sem parar.
   * @returns Sequência de {@link Step} (um por vértice processado, mais os
   *   snapshots inicial e final) junto com o resultado consolidado.
   */
  dfs(start: number, end: number | null): RunResult {
    const steps: Step[] = [];

    // ----- estado da busca -----
    const visited = new Set<number>();
    const parent = new Map<number, number | null>();
    const treeEdges: [number, number][] = [];
    const order: number[] = [];
    const stack: [number, number | null][] = [[start, null]];

    // Mesma regra do BFS: `state` é mutado, nunca reatribuído por fora.
    const state = {
      visited,
      parent,
      treeEdges,
      order,
      frontier: stack.map(([n]) => n), // apenas ids, para visualização
      path: [] as number[],
      found: start === end,
    };

    const snapshot = makeSnapshotter(steps, state);

    snapshot(null); // estado inicial

    // ----- laço principal -----
    while (stack.length > 0) {
      const [node, p] = stack.pop()!;

      // pode haver duplicatas na pilha; ignoramos o que já foi visitado
      if (visited.has(node)) continue;

      visited.add(node);
      order.push(node);
      parent.set(node, p);
      if (p !== null) treeEdges.push([p, node]);

      if (end !== null && node === end) {
        state.found = true;
        state.path = reconstructPath(parent, start, end);
        // `frontier` fica como no passo anterior (ainda com o destino, sem os
        // vizinhos dele): a busca encerra antes de expandi-lo.
        snapshot(node);
        break;
      }

      const neighbors = this.neighbors(node);
      for (let i = neighbors.length - 1; i >= 0; i--) {
        if (!visited.has(neighbors[i])) stack.push([neighbors[i], node]);
      }

      state.frontier = stack.map(([n]) => n);
      snapshot(node);
    }

    snapshot(null, true); // estado final
    return { steps, found: state.found, path: state.path, order };
  }
}
