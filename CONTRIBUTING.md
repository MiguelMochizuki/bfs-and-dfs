# Contribuindo

## Documentation Conventions

### TypeScript

Convenção TSDoc padrão, em português: bloco `/** ... */` em toda classe, interface,
type e função **exportada**, com `@param` por parâmetro, `@returns` quando a função
retorna algo relevante, e `{@link Nome}` para referenciar outra declaração documentada.
Campos de interface levam sua própria linha `/** ... */` de uma frase. Funções internas
(não exportadas) e código trivial (getters de uma linha, handlers de evento) não
precisam de bloco de documentação.

Exemplo (`src/algorithms.ts`):

```ts
/**
 * Busca em largura de `start` até `end` (ou exaustão, se `end` for `null`).
 *
 * - A fronteira é uma **fila**.
 * - Um vértice é marcado como visitado **ao entrar na fila** (evita
 *   duplicatas), mas só é considerado **processado** ao sair dela.
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
```

Interface com campos documentados individualmente (`src/types.ts`):

```ts
export interface Vertex {
  /** Identificador único, atribuído sequencialmente por {@link Graph}. */
  id: number;
  /** Posição horizontal em pixels dentro do SVG. */
  x: number;
  /** Posição vertical em pixels dentro do SVG. */
  y: number;
}
```
