'use client';

import { useMemo, useRef, useEffect, useState } from 'react';
import type { CausalGraph, CausalNode, CausalEdge } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const NODE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  event:     { bg: 'rgba(139,92,246,0.2)',   border: '#8b5cf6', text: '#c4b5fd' },
  state:      { bg: 'rgba(59,130,246,0.2)',   border: '#60a5fa', text: '#bfdbfe' },
  condition:  { bg: 'rgba(245,158,11,0.2)',   border: '#fbbf24', text: '#fef3c7' },
  outcome:    { bg: 'rgba(16,185,129,0.2)',   border: '#34d399', text: '#d1fae5' },
  feedback:   { bg: 'rgba(236,72,153,0.2)',   border: '#f472b6', text: '#fce7f3' },
};

const EDGE_COLORS: Record<string, string> = {
  causes: '#60a5fa',
  enables: '#34d399',
  prevents: '#f87171',
  amplifies: '#fbbf24',
  delays: '#a78bfa',
  feedback: '#f472b6',
};

interface LayoutNode {
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
}

interface LayoutEdge {
  source: string;
  target: string;
  type: string;
  strength?: string;
  label?: string;
  points: { x: number; y: number }[];
}

function measureText(ctx: CanvasRenderingContext2D, text: string, font: string): { width: number; height: number } {
  ctx.font = font;
  const lines = text.split('\n');
  const width = Math.max(...lines.map(l => ctx.measureText(l).width));
  const height = lines.length * 20;
  return { width, height };
}

// 构建树的层级结构
function buildTreeLayout(
  nodes: CausalNode[],
  edges: CausalEdge[],
  canvasWidth: number
): { nodes: LayoutNode[]; edges: LayoutEdge[] } {
  if (nodes.length === 0) return { nodes: [], edges: [] };

  const NODE_W = 140;
  const NODE_H = 56;
  const H_GAP = 60;
  const V_GAP = 24;
  const PADDING = 40;

  // 找出根节点
  const hasIncoming = new Set(edges.map(e => e.target));
  let roots = nodes.filter(n => !hasIncoming.has(n.id));
  if (roots.length === 0) {
    const minLayer = Math.min(...nodes.map(n => n.layer || 1));
    roots = nodes.filter(n => (n.layer || 1) === minLayer);
  }

  // 按 layer 分组
  const layerMap = new Map<number, CausalNode[]>();
  nodes.forEach(n => {
    const l = n.layer || 1;
    if (!layerMap.has(l)) layerMap.set(l, []);
    layerMap.get(l)!.push(n);
  });
  const maxLayer = Math.max(...nodes.map(n => n.layer || 1));
  const layers = Array.from({ length: maxLayer }, (_, i) => layerMap.get(i + 1) || []);

  // 计算每层位置
  const layerX: number[] = [];
  layers.forEach((layerNodes, li) => {
    layerX.push(PADDING + li * (NODE_W + H_GAP));
  });

  const layoutNodes: LayoutNode[] = [];
  const nodePosMap = new Map<string, { x: number; y: number }>();

  // 分配节点位置
  layers.forEach((layerNodes, li) => {
    const totalH = layerNodes.length * (NODE_H + V_GAP) - V_GAP;
    let startY = (canvasWidth - totalH) / 2;
    startY = Math.max(PADDING, startY);

    layerNodes.forEach((node, ni) => {
      const x = layerX[li];
      const y = startY + ni * (NODE_H + V_GAP);
      nodePosMap.set(node.id, { x, y });
      layoutNodes.push({
        id: node.id,
        label: node.label,
        type: node.type || 'event',
        probability: node.probability,
        layer: li,
        x,
        y,
        width: NODE_W,
        height: NODE_H,
        node,
      });
    });
  });

  // 构建边
  const layoutEdges: LayoutEdge[] = edges
    .map(edge => {
      const src = nodePosMap.get(edge.source);
      const tgt = nodePosMap.get(edge.target);
      if (!src || !tgt) return null;

      const sx = src.x + NODE_W;
      const sy = src.y + NODE_H / 2;
      const tx = tgt.x;
      const ty = tgt.y + NODE_H / 2;

      // 三次贝塞尔曲线控制点
      const cx1 = sx + (tx - sx) * 0.5;
      const cy1 = sy;
      const cx2 = sx + (tx - sx) * 0.5;
      const cy2 = ty;

      return {
        source: edge.source,
        target: edge.target,
        type: edge.type || 'causes',
        strength: edge.strength,
        label: edge.label,
        points: [{ x: sx, y: sy }, { x: cx1, y: cy1 }, { x: cx2, y: cy2 }, { x: tx, y: ty }],
      };
    })
    .filter(Boolean) as LayoutEdge[];

  return { nodes: layoutNodes, edges: layoutEdges };
}

function buildSvgPath(points: { x: number; y: number }[]): string {
  const [p0, p1, p2, p3] = points;
  return `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y} ${p2.x} ${p2.y} ${p3.x} ${p3.y}`;
}

export default function CausalTreeView({
  graph,
  onNodeClick,
}: {
  graph: CausalGraph;
  onNodeClick?: (node: CausalNode) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 60, y: 40 });
  const [canvasSize, setCanvasSize] = useState({ w: 900, h: 600 });

  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(
    () => buildTreeLayout(graph.nodes, graph.edges || [], canvasSize.h),
    [graph.nodes, graph.edges, canvasSize.h]
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setCanvasSize({ w: Math.max(900, width), h: Math.max(500, height) });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.w * dpr;
    canvas.height = canvasSize.h * dpr;
    canvas.style.width = `${canvasSize.w}px`;
    canvas.style.height = `${canvasSize.h}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvasSize.w, canvasSize.h);

    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(zoom, zoom);

    // 绘制边
    layoutEdges.forEach(edge => {
      const color = EDGE_COLORS[edge.type] || '#64748b';
      ctx.beginPath();
      const path = new Path2D(buildSvgPath(edge.points));
      ctx.strokeStyle = color;
      ctx.lineWidth = edge.strength === 'critical' ? 3 : edge.strength === 'strong' ? 2.5 : edge.strength === 'weak' ? 1 : 1.5;
      ctx.stroke(path);

      // 边标签
      if (edge.label) {
        const mid = edge.points[2];
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.8;
        ctx.font = '11px system-ui, sans-serif';
        ctx.fillText(edge.label, mid.x + 4, mid.y - 4);
        ctx.globalAlpha = 1;
      }
    });

    // 绘制节点
    layoutNodes.forEach(lNode => {
      const colors = NODE_COLORS[lNode.type] || NODE_COLORS.event;
      const isHovered = false; // 简化，hover 可后续加

      // 阴影
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 4;

      // 圆角矩形
      const r = 10;
      ctx.beginPath();
      const x = lNode.x, y = lNode.y, w = lNode.width, h = lNode.height;
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();

      ctx.fillStyle = colors.bg;
      ctx.fill();
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // 类型标签
      ctx.fillStyle = colors.border;
      ctx.globalAlpha = 0.9;
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.fillText((lNode.type || 'event').toUpperCase(), x + 8, y + 16);
      ctx.globalAlpha = 1;

      // 节点名称
      ctx.fillStyle = colors.text;
      ctx.font = '13px system-ui, sans-serif';
      const maxTextW = w - 16;
      let label = lNode.label;
      if (ctx.measureText(label).width > maxTextW) {
        while (ctx.measureText(label + '…').width > maxTextW && label.length > 0) {
          label = label.slice(0, -1);
        }
        label += '…';
      }
      ctx.fillText(label, x + 8, y + 34);

      // 概率
      if (lNode.probability != null) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '10px system-ui, sans-serif';
        ctx.fillText(`${lNode.probability}%`, x + 8, y + 50);
      }
    });

    ctx.restore();
  }, [layoutNodes, layoutEdges, zoom, offset, canvasSize]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.min(2.5, Math.max(0.4, z * delta)));
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const cx = (e.clientX - rect.left - offset.x) / zoom;
    const cy = (e.clientY - rect.top - offset.y) / zoom;
    for (const lNode of layoutNodes) {
      if (cx >= lNode.x && cx <= lNode.x + lNode.width && cy >= lNode.y && cy <= lNode.y + lNode.height) {
        onNodeClick?.(lNode.node);
        return;
      }
    }
  };

  const handleDrag = (e: React.MouseEvent, type: 'start' | 'move' | 'end') => {
    if (type === 'start') {
      (e.currentTarget as HTMLElement).dataset.dragging = 'true';
    }
    if (type === 'end') {
      delete (e.currentTarget as HTMLElement).dataset.dragging;
    }
  };

  if (layoutNodes.length === 0) {
    return (
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardContent className="p-6 text-center text-slate-500 text-sm">
          暂无因果图数据
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">因果链 · 思维导图视图</span>
          <span className="text-xs text-slate-600">·</span>
          <span className="text-xs text-slate-500">{graph.nodes.length} 节点</span>
          <span className="text-xs text-slate-600">·</span>
          <span className="text-xs text-slate-500">{graph.edges?.length || 0} 条边</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setZoom(z => Math.min(2.5, z * 1.2))} className="h-7 w-7 p-0 text-slate-400 hover:text-white">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <span className="text-xs text-slate-500 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="sm" onClick={() => setZoom(z => Math.max(0.4, z * 0.8))} className="h-7 w-7 p-0 text-slate-400 hover:text-white">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setZoom(1); setOffset({ x: 60, y: 40 }); }} className="h-7 w-7 p-0 text-slate-400 hover:text-white">
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 图例 */}
      <div className="flex items-center gap-3 px-1 flex-wrap">
        {Object.entries(NODE_COLORS).map(([type, c]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: c.bg, border: `1.5px solid ${c.border}` }} />
            <span className="text-[10px] text-slate-400 uppercase">{type}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-2">
          {Object.entries(EDGE_COLORS).slice(0, 4).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1">
              <svg width="20" height="2"><line x1="0" y1="1" x2="20" y2="1" stroke={color} strokeWidth="1.5"/></svg>
              <span className="text-[10px] text-slate-500">{type === 'causes' ? '→' : type === 'enables' ? '↗' : type === 'prevents' ? '⊘' : '↗'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 画布 */}
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-xl border border-slate-700/40 bg-slate-900"
        style={{ height: 520 }}
        onWheel={handleWheel}
      >
        <canvas
          ref={canvasRef}
          className="cursor-grab active:cursor-grabbing"
          onClick={handleCanvasClick}
          onMouseDown={(e) => {
            const startX = e.clientX - offset.x;
            const startY = e.clientY - offset.y;
            const onMove = (me: MouseEvent) => {
              setOffset({ x: me.clientX - startX, y: me.clientY - startY });
            };
            const onUp = () => {
              window.removeEventListener('mousemove', onMove);
              window.removeEventListener('mouseup', onUp);
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
          }}
        />
      </div>

      <p className="text-[10px] text-slate-600 text-center">滚轮缩放 · 拖拽平移 · 点击节点查看详情</p>
    </div>
  );
}
