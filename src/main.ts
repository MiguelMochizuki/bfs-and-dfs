import './style.css';
import { Graph } from './graph';
import { bfs, dfs } from './algorithms';
import { loadTemplate } from './templates';
import { renderGraph, svgPoint } from './renderer';
import type { Algorithm, InteractionMode, RunResult, Step } from './types';

// ---------- Estado global ----------
const graph = new Graph();
let mode: InteractionMode = 'addVertex';
let startId: number | null = null;
let endId: number | null = null;
let pendingEdgeFrom: number | null = null;

let currentRun: RunResult | null = null;
let currentStepIndex = 0;
let autoPlayTimer: number | null = null;
const AUTO_PLAY_INTERVAL_MS = 120;

// Drag
let dragging: { id: number; offsetX: number; offsetY: number } | null = null;
let mouseDownPos: { x: number; y: number } | null = null;
let didDrag = false;
const DRAG_THRESHOLD = 4;

// ---------- Elementos DOM ----------
const svg = document.getElementById('canvas') as unknown as SVGSVGElement;
const statusEl = document.getElementById('status')!;
const visitOrderEl = document.getElementById('visitOrder')!;
const completeBtn = document.getElementById('completeBtn') as HTMLButtonElement;
const stepBtn = document.getElementById('stepBtn') as HTMLButtonElement;
const resetBtn = document.getElementById('resetBtn') as HTMLButtonElement;
const clearBtn = document.getElementById('clearBtn') as HTMLButtonElement;
const directedInput = document.getElementById('directed') as HTMLInputElement;

// ---------- Bindings de UI ----------
document.querySelectorAll<HTMLInputElement>('input[name="mode"]').forEach(el => {
  el.addEventListener('change', () => {
    mode = el.value as InteractionMode;
    pendingEdgeFrom = null;
    updateStatus();
    render();
  });
});

document.querySelectorAll<HTMLInputElement>('input[name="algo"]').forEach(el => {
  el.addEventListener('change', resetRun);
});

directedInput.addEventListener('change', () => {
  graph.directed = directedInput.checked;
  resetRun();
  render();
});

completeBtn.addEventListener('click', runComplete);
stepBtn.addEventListener('click', stepOnce);
resetBtn.addEventListener('click', () => {
  resetRun();
  render();
  updateStatus();
});
clearBtn.addEventListener('click', () => {
  graph.clear();
  startId = endId = pendingEdgeFrom = null;
  resetRun();
  render();
  updateStatus();
});

document.querySelectorAll<HTMLButtonElement>('.templates button').forEach(btn => {
  btn.addEventListener('click', () => {
    loadTemplate(btn.dataset.template!, graph);
    startId = endId = pendingEdgeFrom = null;
    resetRun();
    render();
    updateStatus();
  });
});

// ---------- Drag de vértices ----------
svg.addEventListener('mousedown', ev => {
  const target = ev.target as SVGElement;
  const nodeEl = target.closest('.node') as SVGGElement | null;
  const pt = svgPoint(svg, ev);

  mouseDownPos = pt;
  didDrag = false;

  if (nodeEl) {
    const id = Number(nodeEl.dataset.id);
    const v = graph.vertices.get(id);
    if (v) {
      dragging = { id, offsetX: pt.x - v.x, offsetY: pt.y - v.y };
      ev.preventDefault();
    }
  }
});

svg.addEventListener('mousemove', ev => {
  if (!mouseDownPos) return;
  const pt = svgPoint(svg, ev);
  if (
    !didDrag &&
    Math.hypot(pt.x - mouseDownPos.x, pt.y - mouseDownPos.y) > DRAG_THRESHOLD
  ) {
    didDrag = true;
  }
  if (dragging) {
    const v = graph.vertices.get(dragging.id);
    if (v) {
      v.x = pt.x - dragging.offsetX;
      v.y = pt.y - dragging.offsetY;
      render();
    }
  }
});

window.addEventListener('mouseup', () => {
  dragging = null;
  mouseDownPos = null;
});

// ---------- Cliques ----------
svg.addEventListener('click', ev => {
  if (didDrag) {
    didDrag = false;
    return;
  }

  const target = ev.target as SVGElement;
  const nodeEl = target.closest('.node') as SVGGElement | null;
  const edgeEl = target.closest('.edge') as SVGLineElement | null;

  switch (mode) {
    case 'addVertex': {
      if (nodeEl) return;
      const pt = svgPoint(svg, ev);
      graph.addVertex(pt.x, pt.y);
      resetRun();
      render();
      return;
    }
    case 'addEdge': {
      if (nodeEl) {
        const id = Number(nodeEl.dataset.id);
        if (pendingEdgeFrom === null) {
          pendingEdgeFrom = id;
        } else if (pendingEdgeFrom !== id) {
          graph.addEdge(pendingEdgeFrom, id);
          pendingEdgeFrom = null;
          resetRun();
        }
      } else {
        pendingEdgeFrom = null;
      }
      updateStatus();
      render();
      return;
    }
    case 'setStart': {
      if (nodeEl) {
        startId = Number(nodeEl.dataset.id);
        resetRun();
        render();
      }
      return;
    }
    case 'setEnd': {
      if (nodeEl) {
        endId = Number(nodeEl.dataset.id);
        resetRun();
        render();
      }
      return;
    }
    case 'remove': {
      if (nodeEl) {
        const id = Number(nodeEl.dataset.id);
        graph.removeVertex(id);
        if (startId === id) startId = null;
        if (endId === id) endId = null;
      } else if (edgeEl) {
        const [a, b] = edgeEl.dataset.edge!.split('-').map(Number);
        graph.removeEdge(a, b);
      }
      resetRun();
      render();
      return;
    }
  }
});

// ---------- Execução dos algoritmos ----------

/** @returns Algoritmo selecionado no radio group `input[name="algo"]`. */
function getAlgorithm(): Algorithm {
  const el = document.querySelector<HTMLInputElement>(
    'input[name="algo"]:checked'
  )!;
  return el.value as Algorithm;
}

/**
 * Verifica se há vértices suficientes e uma origem definida para executar
 * a busca. Em caso de falha, escreve a mensagem de erro em `statusEl`.
 *
 * @returns `true` se a execução pode prosseguir.
 */
function validate(): boolean {
  if (graph.size === 0) {
    statusEl.textContent = 'Adicione vértices primeiro.';
    return false;
  }
  if (startId === null || !graph.vertices.has(startId)) {
    statusEl.textContent = 'Defina um vértice de origem.';
    return false;
  }
  return true;
}

/**
 * Executa o algoritmo selecionado (BFS ou DFS) do vértice de origem atual.
 * Assume que {@link validate} já foi chamado com sucesso (usa `startId!`).
 *
 * @returns Resultado completo da busca, com todos os passos.
 */
function compute(): RunResult {
  const algo = getAlgorithm();
  const fn = algo === 'bfs' ? bfs : dfs;
  return fn(graph, startId!, endId);
}

/**
 * Handler do botão "Passo": calcula a busca (se ainda não calculada) e
 * avança um único passo por chamada.
 */
function stepOnce(): void {
  if (!validate()) return;
  if (!currentRun) {
    currentRun = compute();
    currentStepIndex = 0;
  } else if (currentStepIndex < currentRun.steps.length - 1) {
    currentStepIndex++;
  }
  render();
  updateStatus();
  updateVisitOrder();
}

/**
 * Handler do botão "Completo": dispara {@link stepOnce} repetidamente a
 * cada {@link AUTO_PLAY_INTERVAL_MS} até o fim da busca (BFS ou DFS), em
 * estilo de animação — mesmo resultado final de clicar "Passo" até o fim,
 * só que automático. Desabilita os outros botões de ação enquanto roda.
 */
function runComplete(): void {
  if (autoPlayTimer !== null) return;
  if (!validate()) return;
  autoPlayTimer = window.setInterval(() => {
    stepOnce();
    if (!currentRun || currentStepIndex >= currentRun.steps.length - 1) {
      window.clearInterval(autoPlayTimer!);
      autoPlayTimer = null;
      setActionButtonsDisabled(false);
    }
  }, AUTO_PLAY_INTERVAL_MS);
  setActionButtonsDisabled(true);
}

/**
 * Invalida a execução atual, forçando um novo cálculo na próxima chamada a
 * {@link runComplete} ou {@link stepOnce}. Chamado sempre que o grafo, a
 * origem, o destino ou o algoritmo selecionado mudam.
 */
function resetRun(): void {
  currentRun = null;
  currentStepIndex = 0;
  visitOrderEl.textContent = '';
}

/** Liga/desliga os botões de ação que não fazem sentido durante o autoplay. */
function setActionButtonsDisabled(disabled: boolean): void {
  completeBtn.disabled = disabled;
  stepBtn.disabled = disabled;
  resetBtn.disabled = disabled;
  clearBtn.disabled = disabled;
}

// ---------- Status ----------

/**
 * Atualiza o texto de `statusEl` com a fronteira do passo atual (se houver
 * uma execução em andamento) ou com uma dica de acordo com o modo de
 * interação selecionado.
 */
function updateStatus(): void {
  if (currentRun) {
    const s = currentRun.steps[currentStepIndex];
    const frontierTxt = s.frontier.length
      ? `[${s.frontier.map(i => 'v' + i).join(', ')}]`
      : '∅';
    let msg = `Passo ${currentStepIndex + 1}/${currentRun.steps.length} — Fronteira: ${frontierTxt}`;
    if (s.finished) {
      msg += s.found
        ? ` — Caminho: ${s.path.map(i => 'v' + i).join(' → ')}`
        : ' — Destino não alcançado';
    }
    statusEl.textContent = msg;
    return;
  }

  if (mode === 'addEdge' && pendingEdgeFrom !== null) {
    statusEl.textContent = `Aresta a partir de v${pendingEdgeFrom}. Clique no destino.`;
    return;
  }

  const messages: Record<InteractionMode, string> = {
    addVertex: 'Clique no canvas para adicionar um vértice.',
    addEdge: 'Clique em dois vértices para criar uma aresta.',
    setStart: 'Clique em um vértice para defini-lo como origem.',
    setEnd: 'Clique em um vértice para defini-lo como destino.',
    remove: 'Clique em um vértice ou aresta para removê-lo.',
  };
  statusEl.textContent = messages[mode];
}

/** Atualiza `visitOrderEl` com a ordem de visita acumulada até o passo atual. */
function updateVisitOrder(): void {
  if (!currentRun) {
    visitOrderEl.textContent = '';
    return;
  }
  const step: Step = currentRun.steps[currentStepIndex];
  visitOrderEl.textContent =
    'Visita: ' + step.order.map(id => `v${id}`).join(' → ');
}

// ---------- Render ----------

/** Redesenha o SVG a partir do estado atual do grafo e do passo selecionado. */
function render(): void {
  const step: Step | null = currentRun ? currentRun.steps[currentStepIndex] : null;
  renderGraph(svg, {
    graph,
    startId,
    endId,
    step,
    pendingEdgeFrom,
  });
}

// ---------- Resize: reposiciona proporcionalmente ----------
let lastSize = { w: 0, h: 0 };
const resizeObserver = new ResizeObserver(() => {
  const r = svg.getBoundingClientRect();
  if (lastSize.w === 0) {
    lastSize = { w: r.width, h: r.height };
    return;
  }
  const sx = r.width / lastSize.w;
  const sy = r.height / lastSize.h;
  if (Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) return;
  for (const v of graph.vertices.values()) {
    v.x *= sx;
    v.y *= sy;
  }
  lastSize = { w: r.width, h: r.height };
  render();
});
resizeObserver.observe(svg);

// ---------- Init ----------
updateStatus();
render();
