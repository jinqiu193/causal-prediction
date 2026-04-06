'use client';

import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import type { CausalGraph, CausalNode, CausalEdge } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { ZoomIn, ZoomOut, RotateCcw, MousePointer } from 'lucide-react';
import { Button } from '@/components/ui/button';

const NODE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  event:    { bg: 'rgba(99,102,241,0.25)',  border: '#6366f1', text: '#c7d2fe' },
  state:     { bg: 'rgba(59,130,246,0.25)',  border: '#3b82f6', text: '#bfdbfe' },
  condition: { bg: 'rgba(245,158,11,0.25)',  border: '#f59e0b', text: '#fde68a' },
  outcome:   { bg: 'rgba(16,185,129,0.25)',  border: '#10b981', text: '#a7f3d0' },
  feedback:  { bg: 'rgba(236,72,153,0.25)',  border: '#ec4899', text: '#f9a8d4' },
};

const EDGE_COLORS: Record<string, string> = {
  causes:   '#818cf8',
  enables:  '#34d399',
  prevents: '#f87171',
  amplifies:'#fbbf24',
  delays:   '#c084fc',
  feedback: '#f472b6',
};

const NODE_W = 130;
const NODE_H = 58;
const H_GAP = 80;   // 水平间距（同一层节点之间）
const V_GAP = 20;   // 同一父节点下子节点的垂直间距
const LAYER_GAP = 180; // 层间距

interface DrawNode {
  id: string;
  label: string;
  type: string;
  probability?: number;
  layer: number;
  x: number;
  y: number;
  width: number;
  height: number;
  node: CausalNode;
  childCount: number; // 子节点数量（用于分支节点居中）
}

function layoutTree(
  nodes: CausalNode[],
  edges: CausalEdge[]
): DrawNode[] {
  if (nodes.length === 0) return [];

  // 按 layer 分组（layer 由 LLM 生成，代表因果推理深度）
  const layerMap = new Map<number, CausalNode[]>();
  nodes.forEach(n => {
    const l = n.layer || 1;
    if (!layerMap.has(l)) layerMap.set(l, []);
    layerMap.get(l)!.push(n);
  });
  const sortedLayers = Array.from(layerMap.keys()).sort((a, b) => a - b);

  const result: DrawNode[] = [];
  const PADDING_X = 60;
  const PADDING_Y = 40;

  sortedLayers.forEach(layer => {
    const layerNodes = layerMap.get(layer)!;
    const totalH = layerNodes.length * (NODE_H + V_GAP) - V_GAP;
    const startY = PADDING_Y;

    layerNodes.forEach((node, ni) => {
      const x = PADDING_X + layer * LAYER_GAP;
      const y = startY + ni * (NODE_H + V_GAP);
      result.push({
        id: node.id, label: node.label, type: node.type || 'event',
        probability: node.probability, layer, x, y,
        width: NODE_W, height: NODE_H, node,
        childCount: (edges || []).filter(e => e.source === node.id).length,
      });
    });
  });

  return result;
}

function drawTree(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  nodes: DrawNode[],
  edges: CausalEdge[],
  selectedId: string | null,
  hoveredId: string | null,
  onNodeClick: (node: CausalNode) => void,
  nodePosMap: Map<string, DrawNode>
) {
  ctx.clearRect(0, 0, width, height);

  if (nodes.length === 0) return;

  // 只高亮直接前驱（入边节点）和直接后继（出边节点）
  const highlightNodes = new Set<string>();
  const highlightEdges = new Set<string>();
  if (selectedId) {
    highlightNodes.add(selectedId);
    // 直接前驱：所有指向此节点的边
    edges.filter(e => e.target === selectedId).forEach(e => {
      highlightNodes.add(e.source);
      highlightEdges.add(e.id);
    });
    // 直接后继：所有从此节点指出的边
    edges.filter(e => e.source === selectedId).forEach(e => {
      highlightNodes.add(e.target);
      highlightEdges.add(e.id);
    });
  }

  // 绘制边
  nodes.forEach(n => {
    const outEdges = edges.filter(e => e.source === n.id);
    outEdges.forEach(edge => {
      const target = nodePosMap.get(edge.target);
      if (!target) return;

      const x1 = n.x + n.width;
      const y1 = n.y + n.height / 2;
      const x2 = target.x;
      const y2 = target.y + target.height / 2;
      const cx = x1 + (x2 - x1) * 0.5;

      const isHighlighted = selectedId && highlightEdges.has(edge.id);
      const alpha = selectedId ? (isHighlighted ? 1 : 0.12) : 0.55;
      const lineWidth = isHighlighted ? (edge.strength === 'critical' ? 3 : edge.strength === 'strong' ? 2.5 : 2) : 1.2;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(cx, y1, cx, y2, x2, y2);
      ctx.strokeStyle = EDGE_COLORS[edge.type || 'causes'] || '#64748b';
      ctx.lineWidth = lineWidth;
      ctx.globalAlpha = alpha;
      ctx.stroke();

      // 边箭头
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const arrowLen = 8;
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - arrowLen * Math.cos(angle - Math.PI / 7), y2 - arrowLen * Math.sin(angle - Math.PI / 7));
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - arrowLen * Math.cos(angle + Math.PI / 7), y2 - arrowLen * Math.sin(angle + Math.PI / 7));
      ctx.stroke();

      // 边标签
      if (edge.label && isHighlighted) {
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        ctx.fillStyle = 'rgba(15,23,42,0.85)';
        const tw = ctx.measureText(edge.label).width;
        ctx.fillRect(mx - tw / 2 - 4, my - 9, tw + 8, 16);
        ctx.fillStyle = EDGE_COLORS[edge.type || 'causes'];
        ctx.font = '11px system-ui, sans-serif';
        ctx.globalAlpha = 0.9;
        ctx.fillText(edge.label, mx - tw / 2, my + 4);
      }
      ctx.globalAlpha = 1;
    });
  });

  // 绘制节点
  nodes.forEach(n => {
    const colors = NODE_COLORS[n.type] || NODE_COLORS.event;
    const isSelected = n.id === selectedId;
    const isHovered = n.id === hoveredId;
    const isRelated = selectedId && highlightNodes.has(n.id) && !isSelected;
    const isDimmed = selectedId && !highlightNodes.has(n.id);

    ctx.globalAlpha = isDimmed ? 0.25 : 1;

    // 发光效果
    if (isSelected || isHovered) {
      ctx.shadowColor = isSelected ? colors.border : '#60a5fa';
      ctx.shadowBlur = isSelected ? 20 : 12;
    } else {
      ctx.shadowBlur = 0;
    }

    // 节点背景
    const r = 10;
    ctx.beginPath();
    ctx.moveTo(n.x + r, n.y);
    ctx.lineTo(n.x + n.width - r, n.y);
    ctx.quadraticCurveTo(n.x + n.width, n.y, n.x + n.width, n.y + r);
    ctx.lineTo(n.x + n.width, n.y + n.height - r);
    ctx.quadraticCurveTo(n.x + n.width, n.y + n.height, n.x + n.width - r, n.y + n.height);
    ctx.lineTo(n.x + r, n.y + n.height);
    ctx.quadraticCurveTo(n.x, n.y + n.height, n.x, n.y + n.height - r);
    ctx.lineTo(n.x, n.y + r);
    ctx.quadraticCurveTo(n.x, n.y, n.x + r, n.y);
    ctx.closePath();

    ctx.fillStyle = isSelected
      ? colors.border + '55'
      : isRelated
      ? colors.bg.replace('0.25', '0.45')
      : colors.bg;
    ctx.fill();

    ctx.lineWidth = isSelected ? 2.5 : isRelated ? 2 : 1.5;
    ctx.strokeStyle = isSelected ? colors.border : isRelated ? colors.border : colors.border + '80';
    ctx.stroke();

    ctx.shadowBlur = 0;

    // 类型标签
    ctx.fillStyle = isDimmed ? colors.text + '40' : colors.border;
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.fillText((n.type || 'event').toUpperCase(), n.x + 8, n.y + 15);

    // 节点名称（两行）
    ctx.fillStyle = isDimmed
      ? colors.text + '60'
      : isSelected || isRelated
      ? '#ffffff'
      : colors.text;
    ctx.font = `${isSelected || isRelated ? '600' : '500'} 12px system-ui, sans-serif`;
    const maxW = n.width - 16;
    const words = n.label;
    let line1 = '', line2 = '';
    ctx.font = '12px system-ui, sans-serif';
    if (ctx.measureText(words).width <= maxW) {
      line1 = words;
    } else {
      for (let i = words.length; i > 0; i--) {
        const t = words.slice(0, i);
        if (ctx.measureText(t).width <= maxW) {
          line1 = t; line2 = words.slice(i); break;
        }
      }
      if (!line2) { line1 = words.slice(0, Math.floor(maxW / 7)); line2 = words.slice(Math.floor(maxW / 7)); }
    }
    ctx.fillText(line1, n.x + 8, n.y + 31);
    if (line2) ctx.fillText(line2 + (line2.length > 10 ? '…' : ''), n.x + 8, n.y + 46);

    // 概率
    if (n.probability != null) {
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillStyle = isDimmed ? '#64748b60' : '#94a3b8';
      ctx.fillText(`${n.probability}%`, n.x + 8, n.y + 56);
    }

    ctx.globalAlpha = 1;
  });
}

export default function CausalTreeView({
  graph,
  onNodeClick,
}: {
  graph: CausalGraph;
  onNodeClick?: (node: CausalNode) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1000, h: 580 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  // 用户拖拽后的节点位置覆盖
  const [nodePositions, setNodePositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const nodePosOverride = useRef<Map<string, { x: number; y: number }>>(new Map());
  const dragNodeId = useRef<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const nodes = useMemo(() => layoutTree(graph.nodes, graph.edges || []), [graph.nodes, graph.edges]);
  const nodePosMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  // 自适应画布大小
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

  // 绘制
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, size.w, size.h);

    // 背景网格
    ctx.strokeStyle = 'rgba(51,65,85,0.35)';
    ctx.lineWidth = 0.5;
    const grid = 40;
    for (let x = 0; x < size.w; x += grid) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size.h); ctx.stroke();
    }
    for (let y = 0; y < size.h; y += grid) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size.w, y); ctx.stroke();
    }

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);
    // 合并布局位置和用户拖拽位置
    const layoutNodesAdjusted = nodes.map(n => {
      const overridden = nodePosOverride.current.get(n.id);
      return overridden ? { ...n, x: overridden.x, y: overridden.y } : n;
    });
    const nodePosMapAdjusted = new Map(layoutNodesAdjusted.map(n => [n.id, n]));
    drawTree(ctx, size.w / zoom, size.h / zoom, layoutNodesAdjusted, graph.edges || [], selectedId, hoveredId, onNodeClick!, nodePosMapAdjusted);
    ctx.restore();
  }, [nodes, graph.edges, selectedId, hoveredId, zoom, pan, size, onNodeClick, nodePosMap]);

  const getNodeAt = useCallback((cx: number, cy: number): DrawNode | null => {
    const wx = (cx - pan.x) / zoom;
    const wy = (cy - pan.y) / zoom;
    for (const n of nodes) {
      if (wx >= n.x && wx <= n.x + n.width && wy >= n.y && wy <= n.y + n.height) {
        return n;
      }
    }
    return null;
  }, [nodes, pan, zoom]);

  const getNodeAtAdjusted = useCallback((cx: number, cy: number): DrawNode | null => {
    const wx = (cx - pan.x) / zoom;
    const wy = (cy - pan.y) / zoom;
    for (const n of nodes) {
      const overridden = nodePosOverride.current.get(n.id);
      const nx = overridden ? overridden.x : n.x;
      const ny = overridden ? overridden.y : n.y;
      if (wx >= nx && wx <= nx + NODE_W && wy >= ny && wy <= ny + NODE_H) {
        return n;
      }
    }
    return null;
  }, [nodes, pan, zoom]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const n = getNodeAtAdjusted(e.clientX - rect.left, e.clientY - rect.top);
    if (n) {
      setSelectedId(prev => prev === n.id ? null : n.id);
    } else {
      setSelectedId(null);
    }
  }, [isDragging, getNodeAtAdjusted]);

  const handleDblClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const n = getNodeAtAdjusted(e.clientX - rect.left, e.clientY - rect.top);
    if (n) onNodeClick?.(n.node);
  }, [getNodeAtAdjusted, onNodeClick]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const n = getNodeAtAdjusted(e.clientX - rect.left, e.clientY - rect.top);

    if (n) {
      // 开始拖拽节点
      const wx = (e.clientX - rect.left - pan.x) / zoom;
      const wy = (e.clientY - rect.top - pan.y) / zoom;
      const nx = (nodePosOverride.current.get(n.id)?.x) ?? n.x;
      const ny = (nodePosOverride.current.get(n.id)?.y) ?? n.y;
      dragNodeId.current = n.id;
      dragOffset.current = { x: wx - nx, y: wy - ny };
      setSelectedId(n.id);
    } else {
      // 开始平移画布
      dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      setIsDragging(false);
      const onMove = (me: MouseEvent) => {
        const dx = me.clientX - dragStart.current.x;
        const dy = me.clientY - dragStart.current.y;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) setIsDragging(true);
        setPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy });
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        dragNodeId.current = null;
        setIsDragging(false);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    }
  }, [pan, zoom, getNodeAtAdjusted]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragNodeId.current) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const wx = (e.clientX - rect.left - pan.x) / zoom;
    const wy = (e.clientY - rect.top - pan.y) / zoom;
    const nx = wx - dragOffset.current.x;
    const ny = wy - dragOffset.current.y;
    nodePosOverride.current.set(dragNodeId.current, { x: nx, y: ny });
    setNodePositions(new Map(nodePosOverride.current));
    setIsDragging(true); // prevent click
  }, [pan, zoom]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    setZoom(z => Math.min(3, Math.max(0.3, z * delta)));
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
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>思维导图视图</span>
          <span className="text-slate-700">|</span>
          <span>{graph.nodes.length} 节点</span>
          <span className="text-slate-700">|</span>
          <span>{graph.edges?.length || 0} 条边</span>
          {selectedId && (
            <>
              <span className="text-slate-700">|</span>
              <button onClick={() => setSelectedId(null)} className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2">
                已选中节点，清除选中
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setZoom(z => Math.min(3, +(z * 1.15).toFixed(2)))} className="h-7 w-7 p-0 text-slate-400"><ZoomIn className="h-4 w-4"/></Button>
          <span className="text-xs text-slate-500 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="sm" onClick={() => setZoom(z => Math.max(0.3, +(z * 0.85).toFixed(2)))} className="h-7 w-7 p-0 text-slate-400"><ZoomOut className="h-4 w-4"/></Button>
          <Button variant="ghost" size="sm" onClick={() => { setZoom(1); setPan({ x: 20, y: 20 }); }} className="h-7 w-7 p-0 text-slate-400"><RotateCcw className="h-4 w-4"/></Button>
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
        <span className="text-[10px] text-slate-600">· 单击选中高亮前后链 · 双击打开编辑</span>
      </div>

      {/* 画布 */}
      <div ref={wrapRef} className="relative w-full rounded-xl border border-slate-700/40 bg-slate-950 overflow-hidden" style={{ height: 520 }}>
        <canvas
          ref={canvasRef}
          className="cursor-crosshair"
          style={{ cursor: isDragging ? 'grabbing' : 'crosshair' }}
          onClick={handleClick}
          onDoubleClick={handleDblClick}
          onMouseDown={handleMouseDown}
          onMouseMove={e => {
            if (dragNodeId.current) {
              // 正在拖拽节点
              handleMouseMove(e);
            } else {
              const rect = canvasRef.current!.getBoundingClientRect();
              const n = getNodeAtAdjusted(e.clientX - rect.left, e.clientY - rect.top);
              setHoveredId(n?.id || null);
            }
          }}
          onMouseLeave={() => { setHoveredId(null); dragNodeId.current = null; }}
          onWheel={handleWheel}
        />
      </div>
    </div>
  );
}
