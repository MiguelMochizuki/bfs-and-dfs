import './style.css';
import { Graph } from './graph';
import { bfs, dfs, findAllPaths } from './algorithms';
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

// Navegação por todos os caminhos simples (botão "Continuar", só em DFS com destino)
let allPaths: number[][] | null = null;
let revealIndex = 0; // quantos caminhos já foram revelados sequencialmente (backtracking)
let displayIndex = 0; // caminho mostrado agora: segue revealIndex, mas trava no melhor ao esgotar
let browsingPaths = false;
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
const runBtn = document.getElementById('runBtn') as HTMLButtonElement;
const stepBtn = document.getElementById('stepBtn') as HTMLButtonElement;
const continueBtn = document.getElementById('continueBtn') as HTMLButtonElement;
const playAllBtn = document.getElementById('playAllBtn') as HTMLButtonElement;
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

runBtn.addEventListener('click', runAll);
stepBtn.addEventListener('click', stepOnce);
continueBtn.addEventListener('click', continuePath);
playAllBtn.addEventListener('click', playAllPaths);
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
 * Handler do botão "Executar": calcula a busca (se ainda não calculada) e
 * pula direto para o último passo, mostrando o resultado final.
 */
function runAll(): void {
  if (!validate()) return;
  browsingPaths = false;
  if (!currentRun) {
    currentRun = compute();
    currentStepIndex = 0;
  }
  currentStepIndex = currentRun.steps.length - 1;
  render();
  updateStatus();
  updateVisitOrder();
  updateContinueButton();
}

/**
 * Handler do botão "Passo": calcula a busca (se ainda não calculada) e
 * avança um único passo por chamada.
 */
function stepOnce(): void {
  if (!validate()) return;
  browsingPaths = false;
  if (!currentRun) {
    currentRun = compute();
    currentStepIndex = 0;
  } else if (currentStepIndex < currentRun.steps.length - 1) {
    currentStepIndex++;
  }
  render();
  updateStatus();
  updateVisitOrder();
  updateContinueButton();
}

/**
 * Handler do botão "Continuar": cada algoritmo no seu escopo.
 *
 * - **BFS** já acha "o" caminho ótimo de cara — não existe "próximo
 *   caminho" a explorar. Aqui "Continuar" vira só um sinônimo de "Passo":
 *   mostra a busca avançando um passo por clique.
 * - **DFS** não garante caminho ótimo (acha "um" caminho qualquer). Aqui
 *   "Continuar" faz backtracking: calcula (via {@link findAllPaths}) todos
 *   os caminhos simples de origem a destino e revela o próximo a cada
 *   clique, mostrando o melhor (mais curto) entre os já revelados — efeito
 *   "redo" do Prolog. Ao esgotar, passa a exibir o melhor de todos, não o
 *   último rastreado. Não precisa ter rodado "Executar" antes.
 */
function continuePath(): void {
  if (getAlgorithm() === 'bfs') {
    stepOnce();
    return;
  }

  if (endId === null) return;
  if (!validate()) return;

  let freshlyComputed = false;
  if (allPaths === null) {
    allPaths = findAllPaths(graph, startId!, endId);
    revealIndex = 0;
    freshlyComputed = true;
  }

  if (allPaths.length === 0) {
    browsingPaths = false;
    statusEl.textContent = 'Destino não alcançável a partir da origem.';
    render();
    updateContinueButton();
    return;
  }

  // Se "Executar"/"Passo" já mostrou o 1º caminho (currentRun.found), este
  // clique sempre significa "próximo". Só quando nada rodou antes é que o
  // 1º clique aqui deve, ele mesmo, mostrar o 1º caminho.
  const alreadyShowedFirst = freshlyComputed ? !!currentRun?.found : true;
  browsingPaths = true;
  if (alreadyShowedFirst && revealIndex < allPaths.length - 1) revealIndex++;
  displayIndex =
    revealIndex === allPaths.length - 1 ? bestPathIndex(allPaths) : revealIndex;
  render();
  updateStatus();
  updateVisitOrder();
  updateContinueButton();
}

/** @returns Índice do caminho mais curto (menos arestas) em `paths`. */
function bestPathIndex(paths: number[][]): number {
  let best = 0;
  for (let i = 1; i < paths.length; i++) {
    if (paths[i].length < paths[best].length) best = i;
  }
  return best;
}

/**
 * Invalida a execução atual, forçando um novo cálculo na próxima chamada a
 * {@link runAll} ou {@link stepOnce}. Chamado sempre que o grafo, a origem,
 * o destino ou o algoritmo selecionado mudam.
 */
function resetRun(): void {
  currentRun = null;
  currentStepIndex = 0;
  allPaths = null;
  revealIndex = 0;
  displayIndex = 0;
  browsingPaths = false;
  visitOrderEl.textContent = '';
  updateContinueButton();
}

/**
 * Habilita "Continuar" e "Ver tudo rápido" com regras diferentes por
 * algoritmo, já que fazem coisas diferentes em cada um (ver
 * {@link continuePath}):
 *
 * - **BFS**: "Continuar" só precisa de grafo e origem válidos, igual
 *   "Passo" (não depende de destino nem de "Executar" já ter rodado).
 *   "Ver tudo rápido" não existe pra BFS — "rodar todos os caminhos" não
 *   faz sentido quando só existe um.
 * - **DFS**: os dois exigem também destino definido, e ficam habilitados
 *   enquanto restarem caminhos simples não revelados (ou nenhum foi
 *   calculado ainda).
 */
function updateContinueButton(): void {
  const baseEligible =
    graph.size > 0 && startId !== null && graph.vertices.has(startId);

  if (getAlgorithm() === 'bfs') {
    continueBtn.disabled = !baseEligible;
    playAllBtn.disabled = true;
    return;
  }

  const dfsEligible =
    baseEligible &&
    endId !== null &&
    (allPaths === null || revealIndex < allPaths.length - 1);
  continueBtn.disabled = !dfsEligible;
  playAllBtn.disabled = autoPlayTimer !== null || !dfsEligible;
}

/**
 * Handler do botão "Ver tudo rápido" (só DFS): dispara {@link continuePath}
 * repetidamente a cada {@link AUTO_PLAY_INTERVAL_MS} até esgotar todos os
 * caminhos simples, parando sozinho no melhor — mesmo resultado de clicar
 * "Continuar" até o fim, só que automático. Desabilita os outros botões
 * de ação enquanto roda. Se o grafo/origem/destino mudar no meio (via
 * canvas), `continuePath` vira no-op e o loop se percebe pelo
 * `continueBtn` desabilitado e para sozinho, sem travar.
 */
function playAllPaths(): void {
  if (getAlgorithm() !== 'dfs') return;
  if (autoPlayTimer !== null || continueBtn.disabled) return;
  setActionButtonsDisabled(true);
  autoPlayTimer = window.setInterval(() => {
    continuePath();
    if (continueBtn.disabled) {
      window.clearInterval(autoPlayTimer!);
      autoPlayTimer = null;
      setActionButtonsDisabled(false);
    }
  }, AUTO_PLAY_INTERVAL_MS);
}

/** Liga/desliga os botões de ação que não fazem sentido durante o autoplay. */
function setActionButtonsDisabled(disabled: boolean): void {
  runBtn.disabled = disabled;
  stepBtn.disabled = disabled;
  resetBtn.disabled = disabled;
  clearBtn.disabled = disabled;
  updateContinueButton();
}

// ---------- Status ----------

/**
 * Atualiza o texto de `statusEl` com a fronteira do passo atual (se houver
 * uma execução em andamento) ou com uma dica de acordo com o modo de
 * interação selecionado.
 */
function updateStatus(): void {
  if (browsingPaths && allPaths) {
    const p = allPaths[displayIndex];
    const edges = p.length - 1;
    const exhausted = revealIndex === allPaths.length - 1;
    let msg: string;
    if (exhausted) {
      msg =
        `${allPaths.length} caminho${allPaths.length === 1 ? '' : 's'} simples explorado${allPaths.length === 1 ? '' : 's'}` +
        ` — melhor: ${p.map(i => 'v' + i).join(' → ')} (${edges} aresta${edges === 1 ? '' : 's'})`;
    } else {
      const bestSoFar = allPaths
        .slice(0, revealIndex + 1)
        .reduce((a, b) => (b.length < a.length ? b : a));
      const bestEdges = bestSoFar.length - 1;
      msg =
        `Caminho ${revealIndex + 1}/${allPaths.length} (${edges} aresta${edges === 1 ? '' : 's'})` +
        ` — ${p.map(i => 'v' + i).join(' → ')}` +
        ` — melhor até agora: ${bestEdges} aresta${bestEdges === 1 ? '' : 's'}`;
    }
    statusEl.textContent = msg;
    return;
  }

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
  if (browsingPaths && allPaths) {
    visitOrderEl.textContent =
      'Caminho: ' + allPaths[displayIndex].map(id => `v${id}`).join(' → ');
    return;
  }
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
  let step: Step | null = null;
  if (browsingPaths && allPaths) {
    const p = allPaths[displayIndex];
    step = {
      visited: new Set(),
      current: null,
      frontier: [],
      treeEdges: [],
      parent: new Map(),
      path: p,
      order: p,
      finished: true,
      found: true,
    };
  } else if (currentRun) {
    step = currentRun.steps[currentStepIndex];
  }
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
updateContinueButton();
render();
