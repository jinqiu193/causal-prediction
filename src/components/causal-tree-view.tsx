'use client';

import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import type { CausalGraph, CausalNode, CausalEdge } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const NODE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  event:    { bg: 'rgba(99,102,241,0.25)',  border: '#6366f1', text: '#c7d2fe' },
  state:    { bg: 'rgba(59,130,246,0.25)',  border: '#3b82f6', text: '#bfdbfe' },
  condition:{ bg: 'rgba(245,158,11,0.25)',  border: '#f59e0b', text: '#fde68a' },
  outcome:  { bg: 'rgba(16,185,129,0.25)',  border: '#10b981', text: '#a7f3d0' },
  feedback: { bg: 'rgba(236,72,153,0.25)',  border: '#ec4899', text: '#f9a8d4' },
};

const EDGE_COLORS: Record<string, string> = {
  causes:   '#818cf8',
  enables:   '#34d399',
  prevents:  '#f87171',
  amplifies: '#fbbf24',
  delays:    '#c084fc',
  feedback:  '#f472b6',
};

const NODE_W = 130;
const NODE_H = 58;
const LAYER_GAP = 185;

interface DrawNode {
  id: string;
  label: string;
  type: string;
  probability?: number;
  layer: number;
  x: number;
  y: number;
  node: CausalNode;
}

function layoutTree(nodes: CausalNode[], edges: CausalEdge[]): DrawNode[] {
  if (nodes.length === 0) return [];
  const layerMap = new Map<number, CausalNode[]>();
  nodes.forEach(n => {
    const l = n.layer || 1;
    if (!layerMap.has(l)) layerMap.set(l, []);
    layerMap.get(l)!.push(n);
  });
  const sortedLayers = Array.from(layerMap.keys()).sort((a, b) => a - b);
  const result: DrawNode[] = [];
  const V_GAP = 22;
  const PADDING_Y = 50;

  sortedLayers.forEach((layer, li) => {
    const layerNodes = layerMap.get(layer)!;
    layerNodes.forEach((node, ni) => {
      const x = 60 + li * LAYER_GAP;
      const y = PADDING_Y + ni * (NODE_H + V_GAP);
      result.push({ id: node.id, label: node.label, type: node.type || 'event', probability: node.probability, layer: li, x, y, node });
    });
  });
  return result;
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  nodes: DrawNode[],
  edges: CausalEdge[],
  selId: string | null,
  hovId: string | null,
  overrides: Map<string, { x: number; y: number }>,
  selNeighbors: Set<string>,
  edgeSet: Set<string>,
) {
  ctx.clearRect(0, 0, w, h);

  // 背景
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, w, h);

  // 网格
  ctx.strokeStyle = 'rgba(51,65,85,0.35)';
  ctx.lineWidth = 0.5;
  for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

  // 边
  edges.forEach(edge => {
    const src = nodes.find(n => n.id === edge.source);
    const tgt = nodes.find(n => n.id === edge.target);
    if (!src || !tgt) return;
    const sx = (overrides.get(src.id)?.x ?? src.x) + NODE_W;
    const sy = (overrides.get(src.id)?.y ?? src.y) + NODE_H / 2;
    const tx = overrides.get(tgt.id)?.x ?? tgt.x;
    const ty = (overrides.get(tgt.id)?.y ?? tgt.y) + NODE_H / 2;
    const cx = sx + (tx - sx) * 0.5;
    const isH = selNeighbors.has(edge.id);
    const alpha = selId ? (isH ? 1 : 0.1) : 0.5;
    const lw = isH ? 2.5 : 1.2;

    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.bezierCurveTo(cx, sy, cx, ty, tx, ty);
    ctx.strokeStyle = EDGE_COLORS[edge.type || 'causes'] || '#64748b';
    ctx.lineWidth = lw;
    ctx.globalAlpha = alpha;
    ctx.stroke();

    // 箭头
    const angle = Math.atan2(ty - sy, tx - sx);
    const al = 8;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx - al * Math.cos(angle - Math.PI / 7), ty - al * Math.sin(angle - Math.PI / 7));
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx - al * Math.cos(angle + Math.PI / 7), ty - al * Math.sin(angle + Math.PI / 7));
    ctx.stroke();
    ctx.globalAlpha = 1;
  });

  // 节点
  nodes.forEach(n => {
    const x = overrides.get(n.id)?.x ?? n.x;
    const y = overrides.get(n.id)?.y ?? n.y;
    const colors = NODE_COLORS[n.type] || NODE_COLORS.event;
    const isSel = n.id === selId;
    const isHov = n.id === hovId;
    const isRel = selId && selNeighbors.has(n.id);
    const isDim = !!selId && !selNeighbors.has(n.id) && n.id !== selId;

    if (isSel || isHov) {
      ctx.shadowColor = isSel ? colors.border : '#60a5fa';
      ctx.shadowBlur = isSel ? 22 : 14;
    } else {
      ctx.shadowBlur = 0;
    }

    const r = 10;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + NODE_W - r, y);
    ctx.quadraticCurveTo(x + NODE_W, y, x + NODE_W, y + r);
    ctx.lineTo(x + NODE_W, y + NODE_H - r);
    ctx.quadraticCurveTo(x + NODE_W, y + NODE_H, x + NODE_W - r, y + NODE_H);
    ctx.lineTo(x + r, y + NODE_H);
    ctx.quadraticCurveTo(x, y + NODE_H, x, y + NODE_H - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();

    ctx.fillStyle = isSel ? colors.border + '55' : isRel ? colors.bg.replace('0.25', '0.5') : colors.bg;
    ctx.fill();
    ctx.strokeStyle = isSel ? colors.border : colors.border + '80';
    ctx.lineWidth = isSel ? 2.5 : 1.5;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.globalAlpha = isDim ? 0.25 : 1;
    ctx.fillStyle = colors.border;
    ctx.font = 'bold 9px system-ui';
    ctx.fillText((n.type || 'event').toUpperCase(), x + 8, y + 15);

    ctx.fillStyle = isDim ? colors.text + '50' : isSel || isRel ? '#ffffff' : colors.text;
    ctx.font = `${isSel || isRel ? '600' : '500'} 12px system-ui`;
    const maxW = NODE_W - 16;
    let label = n.label;
    if (ctx.measureText(label).width > maxW) {
      while (label.length > 0 && ctx.measureText(label + '…').width > maxW) label = label.slice(0, -1);
      label += '…';
    }
    ctx.fillText(label, x + 8, y + 33);

    if (n.probability != null) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px system-ui';
      ctx.fillText(`${n.probability}%`, x + 8, y + 47);
    }
    ctx.globalAlpha = 1;
  });
}

export default function CausalTreeView({ graph, onNodeClick }: { graph: CausalGraph; onNodeClick?: (node: CausalNode) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 所有值都用 ref，避免闭包陷阱
  const selIdRef = useRef<string | null>(null);
  const hovIdRef = useRef<string | null>(null);
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 20, y: 20 });
  const overridesRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const isDraggingNode = useRef(false);
  const isDraggingCanvas = useRef(false);
  const dragNodeId = useRef<string | null>(null);
  const dragOff = useRef({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 });

  const [size, setSize] = useState({ w: 1000, h: 580 });
  const [selId, setSelId] = useState<string | null>(null);
  const [hovId, setHovId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const nodes = useMemo(() => layoutTree(graph.nodes, graph.edges || []), [graph.nodes, graph.edges]);

  // 选中邻居（直接前驱+后继）
  const selNeighbors = useMemo(() => {
    const s = new Set<string>();
    const edgeSet = new Set<string>();
    if (!selId) return { s, edgeSet };
    (graph.edges || []).forEach(e => {
      if (e.target === selId) { s.add(e.source); edgeSet.add(e.id); }
      if (e.source === selId) { s.add(e.target); edgeSet.add(e.id); }
    });
    return { s, edgeSet };
  }, [selId, graph.edges]);

  // 完整绘制
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = size.w, h = size.h;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    ctx.save();
    ctx.translate(panRef.current.x, panRef.current.y);
    ctx.scale(zoomRef.current, zoomRef.current);
    drawFrame(ctx, w / zoomRef.current, h / zoomRef.current, nodes, graph.edges || [], selIdRef.current, hovIdRef.current, overridesRef.current, selNeighbors.s, selNeighbors.edgeSet);
    ctx.restore();
  }, [nodes, graph.edges, size, selNeighbors]);

  // 初始化 + ResizeObserver
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;
    redraw();
  }, [size, redraw]);

  useEffect(() => {
    if (!wrapRef.current) return;
    const obs = new ResizeObserver(entries => {
      for (const e of entries) {
        const { width, height } = e.contentRect;
        setSize({ w: Math.max(900, width), h: Math.max(500, height) });
      }
    });
    obs.observe(wrapRef.current);
    return () => obs.disconnect();
  }, []);

  // pan/zoom 变化时同步 ref 并重绘
  useEffect(() => { panRef.current = panRef.current; redraw(); }, [size]); // pan via redraw
  useEffect(() => { zoomRef.current = zoom; redraw(); }, [zoom, size]);

  // 坐标转换
  const toWorld = useCallback((cx: number, cy: number) => {
    return {
      x: (cx - panRef.current.x) / zoomRef.current,
      y: (cy - panRef.current.y) / zoomRef.current,
    };
  }, []);

  const getNodeAt = useCallback((wx: number, wy: number): DrawNode | null => {
    for (const n of nodes) {
      const ox = overridesRef.current.get(n.id)?.x;
      const oy = overridesRef.current.get(n.id)?.y;
      const nx = ox ?? n.x, ny = oy ?? n.y;
      if (wx >= nx && wx <= nx + NODE_W && wy >= ny && wy <= ny + NODE_H) return n;
    }
    return null;
  }, [nodes]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingNode.current || isDraggingCanvas.current) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const w = toWorld(e.clientX - rect.left, e.clientY - rect.top);
    const n = getNodeAt(w.x, w.y);
    if (n) {
      selIdRef.current = selIdRef.current === n.id ? null : n.id;
      setSelId(selIdRef.current);
    } else {
      selIdRef.current = null;
      setSelId(null);
    }
  }, [toWorld, getNodeAt]);

  const handleDblClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const w = toWorld(e.clientX - rect.left, e.clientY - rect.top);
    const n = getNodeAt(w.x, w.y);
    if (n) onNodeClick?.(n.node);
  }, [toWorld, getNodeAt, onNodeClick]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const w = toWorld(e.clientX - rect.left, e.clientY - rect.top);
    const n = getNodeAt(w.x, w.y);

    if (n) {
      dragNodeId.current = n.id;
      const nx = overridesRef.current.get(n.id)?.x ?? n.x;
      const ny = overridesRef.current.get(n.id)?.y ?? n.y;
      dragOff.current = { x: w.x - nx, y: w.y - ny };
      isDraggingCanvas.current = false;
      isDraggingNode.current = false;
    } else {
      dragStart.current = { x: e.clientX, y: e.clientY, px: panRef.current.x, py: panRef.current.y };
      isDraggingCanvas.current = true;
      isDraggingNode.current = false;
    }
  }, [toWorld, getNodeAt]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();

    if (dragNodeId.current) {
      isDraggingNode.current = true;
      const w = toWorld(e.clientX - rect.left, e.clientY - rect.top);
      overridesRef.current.set(dragNodeId.current, {
        x: w.x - dragOff.current.x,
        y: w.y - dragOff.current.y,
      });
      redraw();
    } else if (isDraggingCanvas.current) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      panRef.current = { x: dragStart.current.px + dx, y: dragStart.current.py + dy };
      redraw();
    } else {
      const w = toWorld(e.clientX - rect.left, e.clientY - rect.top);
      const n = getNodeAt(w.x, w.y);
      hovIdRef.current = n?.id || null;
      setHovId(hovIdRef.current);
    }
  }, [toWorld, getNodeAt, redraw]);

  const handleMouseUp = useCallback(() => {
    dragNodeId.current = null;
    isDraggingCanvas.current = false;
    // 延迟重置，防止 click 触发时还在拖拽
    setTimeout(() => { isDraggingNode.current = false; }, 50);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(3, Math.max(0.3, zoomRef.current * delta));
    zoomRef.current = newZoom;
    setZoom(newZoom);
  }, []);

  if (nodes.length === 0) {
    return (
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardContent className="p-6 text-center text-slate-500 text-sm">暂无因果图数据</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {/* 工具栏 */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">{graph.nodes.length} 节点 · {graph.edges?.length || 0} 条边</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => { const z = Math.min(3, zoomRef.current * 1.2); zoomRef.current = z; setZoom(z); }} className="h-7 w-7 p-0 text-slate-400"><ZoomIn className="h-4 w-4"/></Button>
          <span className="text-xs text-slate-500 w-12 text-center">{Math.round(zoomRef.current * 100)}%</span>
          <Button variant="ghost" size="sm" onClick={() => { const z = Math.max(0.3, zoomRef.current * 0.8); zoomRef.current = z; setZoom(z); }} className="h-7 w-7 p-0 text-slate-400"><ZoomOut className="h-4 w-4"/></Button>
          <Button variant="ghost" size="sm" onClick={() => { panRef.current = { x: 20, y: 20 }; zoomRef.current = 1; setZoom(1); redraw(); }} className="h-7 w-7 p-0 text-slate-400"><RotateCcw className="h-4 w-4"/></Button>
        </div>
      </div>

      {/* 图例 */}
      <div className="flex items-center gap-4 flex-wrap">
        {Object.entries(NODE_COLORS).map(([type, c]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: c.bg, border: `1.5px solid ${c.border}` }} />
            <span className="text-[10px] text-slate-400 uppercase">{type}</span>
          </div>
        ))}
        <span className="text-[10px] text-slate-600">· 单击选中 · 双击编辑 · 拖拽节点移动</span>
      </div>

      {/* 画布 */}
      <div ref={wrapRef} className="relative w-full rounded-xl border border-slate-700/40 bg-slate-950 overflow-hidden" style={{ height: 520 }}>
        <canvas
          ref={canvasRef}
          className="cursor-crosshair"
          onClick={handleClick}
          onDoubleClick={handleDblClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        />
      </div>
    </div>
  );
}
