'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { CausalGraph, CausalNode, EdgeType, EdgeStrength } from '@/lib/types';
import { Maximize2, Minimize2, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CausalGraphProps {
  graph: CausalGraph;
  onNodeClick?: (node: CausalNode) => void;
}

// 根据层级计算节点位置
function calculateNodePositions(nodes: CausalNode[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const layerMap = new Map<number, CausalNode[]>();
  
  nodes.forEach(node => {
    const layer = node.layer || 1;
    if (!layerMap.has(layer)) {
      layerMap.set(layer, []);
    }
    layerMap.get(layer)!.push(node);
  });

  const nodeWidth = 200;
  const horizontalGap = 100;
  const verticalGap = 70;

  layerMap.forEach((layerNodes, layer) => {
    const startX = (layer - 1) * (nodeWidth + horizontalGap);
    
    layerNodes.forEach((node, index) => {
      positions.set(node.id, {
        x: startX,
        y: index * (80 + verticalGap) - ((layerNodes.length - 1) * (80 + verticalGap)) / 2 + 200
      });
    });
  });

  return positions;
}

function getNodeStyle(node: CausalNode): { background: string; border: string; color: string } {
  switch (node.type) {
    case 'event':
      return { 
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.15) 100%)', 
        border: '#8b5cf6',
        color: '#c4b5fd'
      };
    case 'state':
      return { 
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(96, 165, 250, 0.15) 100%)', 
        border: '#60a5fa',
        color: '#bfdbfe'
      };
    case 'condition':
      return { 
        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(251, 191, 36, 0.15) 100%)', 
        border: '#fbbf24',
        color: '#fef3c7'
      };
    case 'outcome':
      return { 
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(52, 211, 153, 0.15) 100%)', 
        border: '#34d399',
        color: '#d1fae5'
      };
    case 'feedback':
      return { 
        background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.2) 0%, rgba(244, 114, 182, 0.15) 100%)', 
        border: '#f472b6',
        color: '#fce7f3'
      };
    default:
      return { 
        background: 'rgba(51, 65, 85, 0.5)', 
        border: '#64748b',
        color: '#cbd5e1'
      };
  }
}

function getEdgeStyle(type?: EdgeType, strength?: EdgeStrength): { stroke: string; strokeWidth: number; animated: boolean } {
  let stroke = '#64748b';
  let strokeWidth = 2;
  let animated = false;

  switch (type) {
    case 'causes': stroke = '#60a5fa'; break;
    case 'enables': stroke = '#34d399'; break;
    case 'prevents': stroke = '#f87171'; break;
    case 'amplifies': stroke = '#fbbf24'; animated = true; break;
    case 'delays': stroke = '#a78bfa'; break;
    case 'feedback': stroke = '#f472b6'; animated = true; break;
  }

  switch (strength) {
    case 'critical': strokeWidth = 3.5; break;
    case 'strong': strokeWidth = 2.5; break;
    case 'medium': strokeWidth = 2; break;
    case 'weak': strokeWidth = 1.5; break;
  }

  return { stroke, strokeWidth, animated };
}

function convertToFlowGraph(graph: CausalGraph): { nodes: Node[]; edges: Edge[] } {
  const positions = calculateNodePositions(graph.nodes);

  const nodes: Node[] = graph.nodes.map((node) => {
    const position = positions.get(node.id) || { x: 0, y: 0 };
    
    return {
      id: node.id,
      type: 'default',
      position,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: {
        label: (
          <div className="p-2.5 min-w-[140px]">
            <div className="flex items-center gap-1.5 mb-1">
              {node.type && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/20 text-white/90 font-medium uppercase tracking-wider">
                  {node.type}
                </span>
              )}
              {node.layer && (
                <span className="text-[9px] text-white/60">L{node.layer}</span>
              )}
              {node.isUserModified && (
                <span className="text-[9px] px-1 py-0.5 rounded-full bg-cyan-500/30 text-cyan-300">
                  已编辑
                </span>
              )}
            </div>
            <div className="font-medium text-sm leading-tight text-white">{node.label}</div>
            {node.newsSummary && (
              <div className="flex items-center gap-1 mt-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-[10px] text-white/70">有新闻</span>
              </div>
            )}
            {node.probability !== undefined && (
              <div className="mt-1 text-xs font-bold text-white">
                {node.probability}%
              </div>
            )}
          </div>
        ),
        nodeData: node
      },
      style: {
        background: getNodeStyle(node).background,
        border: `2px solid ${getNodeStyle(node).border}`,
        borderRadius: '12px',
        width: 200,
        boxShadow: `0 0 20px ${getNodeStyle(node).border}20, inset 0 1px 0 rgba(255,255,255,0.1)`,
        cursor: 'pointer'
      }
    };
  });

  const edges: Edge[] = graph.edges.map(edge => {
    const style = getEdgeStyle(edge.type, edge.strength);
    
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      animated: style.animated,
      type: 'smoothstep',
      style: { stroke: style.stroke, strokeWidth: style.strokeWidth },
      labelStyle: { fill: '#94a3b8', fontWeight: 500, fontSize: 10 },
      labelBgStyle: { fill: '#1e293b', fillOpacity: 0.9, rx: 4, ry: 4 },
      labelBgPadding: [4, 2] as [number, number],
      markerEnd: { type: MarkerType.ArrowClosed, color: style.stroke, width: 12, height: 12 }
    };
  });

  return { nodes, edges };
}

function FlowGraph({ graph, height, onNodeClickInternal }: { 
  graph: CausalGraph; 
  height: number;
  onNodeClickInternal?: (nodeId: string) => void;
}) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => convertToFlowGraph(graph),
    [graph]
  );

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const handleNodeClick = (_event: React.MouseEvent, node: Node) => {
    onNodeClickInternal?.(node.id);
  };

  return (
    <div style={{ height }} className="bg-gradient-to-br from-slate-900 to-slate-800">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        attributionPosition="bottom-left"
        minZoom={0.3}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#334155" gap={24} size={1} />
        <Controls 
          showInteractive={false}
          className="!bg-slate-800/80 !border-slate-700 !rounded-lg [&>button]:!bg-slate-700 [&>button]:!border-slate-600 [&>button]:!text-slate-300 [&>button:hover]:!bg-slate-600"
        />
        <MiniMap
          nodeColor={(node) => {
            const style = node.style as { border?: string };
            return style?.border || '#64748b';
          }}
          maskColor="rgba(15, 23, 42, 0.8)"
          className="!bg-slate-800/80 !border-slate-700 !rounded-lg"
          pannable
          zoomable
        />
      </ReactFlow>
    </div>
  );
}

export default function CausalGraphView({ graph, onNodeClick }: CausalGraphProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    
    if (isFullscreen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);

  const handleNodeClickInternal = (nodeId: string) => {
    const node = graph.nodes.find(n => n.id === nodeId);
    if (node) {
      onNodeClick?.(node);
    }
  };

  return (
    <>
      {/* 正常尺寸视图 */}
      <div className="relative group">
        <FlowGraph graph={graph} height={450} onNodeClickInternal={handleNodeClickInternal} />
        
        {/* 操作按钮 */}
        <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          {/* 编辑提示 */}
          <div className="px-3 py-2 bg-slate-800/80 border border-slate-600 rounded-lg text-xs text-slate-300 flex items-center gap-1.5">
            <Edit3 className="h-3.5 w-3.5" />
            点击节点编辑
          </div>
          {/* 全屏按钮 */}
          <button
            onClick={() => setIsFullscreen(true)}
            className="p-2 bg-slate-800/80 hover:bg-slate-700 border border-slate-600 rounded-lg text-slate-400 hover:text-white transition-all"
            title="全屏显示"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 全屏模态框 */}
      {isFullscreen && (
        <div 
          className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex flex-col"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsFullscreen(false);
          }}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-violet-500 to-cyan-500 rounded-lg">
                <Maximize2 className="h-4 w-4 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">深度因果关系图</h2>
                <p className="text-sm text-slate-400 flex items-center gap-2">
                  {graph.nodes.length} 个节点 · {graph.edges?.length || 0} 条连线
                  <span className="text-cyan-400">· 点击节点编辑</span>
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-4 px-4 py-2 bg-slate-800/50 rounded-lg border border-slate-700">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-violet-500"></div>
                  <span className="text-xs text-slate-400">事件</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-blue-500"></div>
                  <span className="text-xs text-slate-400">状态</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-amber-500"></div>
                  <span className="text-xs text-slate-400">条件</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-emerald-500"></div>
                  <span className="text-xs text-slate-400">结果</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-pink-500"></div>
                  <span className="text-xs text-slate-400">反馈</span>
                </div>
              </div>
              
              <Button
                onClick={() => setIsFullscreen(false)}
                variant="outline"
                className="bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                <Minimize2 className="h-4 w-4 mr-2" />
                退出全屏
              </Button>
            </div>
          </div>
          
          <div className="flex-1 m-4 rounded-xl border border-slate-700/50 overflow-hidden" style={{ height: 'calc(100vh - 120px)' }}>
            <FlowGraph graph={graph} height={600} onNodeClickInternal={handleNodeClickInternal} />
          </div>
          
          <div className="text-center pb-4 text-sm text-slate-500">
            按 <kbd className="px-2 py-1 bg-slate-800 rounded text-slate-400">ESC</kbd> 或点击空白区域退出全屏
          </div>
        </div>
      )}
    </>
  );
}
