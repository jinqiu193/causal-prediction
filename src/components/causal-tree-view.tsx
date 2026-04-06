'use client';

import { useMemo, useState } from 'react';
import type { CausalGraph, CausalNode, CausalEdge } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, ChevronDown, Circle } from 'lucide-react';

interface TreeNode {
  node: CausalNode;
  children: TreeNode[];
  depth: number;
}

const NODE_TYPE_COLORS: Record<string, string> = {
  event: 'bg-violet-500/20 border-violet-500/40 text-violet-300',
  state: 'bg-blue-500/20 border-blue-500/40 text-blue-300',
  condition: 'bg-amber-500/20 border-amber-500/40 text-amber-300',
  outcome: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
  feedback: 'bg-pink-500/20 border-pink-500/40 text-pink-300',
};

const EDGE_TYPE_LABELS: Record<string, string> = {
  causes: '导致',
  enables: '促使',
  prevents: '阻止',
  amplifies: '放大',
  delays: '延迟',
  feedback: '反馈',
};

const STRENGTH_LABELS: Record<string, string> = {
  critical: '极强',
  strong: '强',
  medium: '中',
  weak: '弱',
};

// 根据层级构建树
function buildTree(nodes: CausalNode[], edges: CausalEdge[]): TreeNode[] {
  if (nodes.length === 0) return [];

  // 找出根节点（没有任何边指向它的节点）
  const hasIncoming = new Set(edges.map(e => e.target));
  const rootNodes = nodes.filter(n => !hasIncoming.has(n.id));

  // 如果没有根节点，选取 layer 最小的节点
  if (rootNodes.length === 0) {
    const minLayer = Math.min(...nodes.map(n => n.layer || 1));
    rootNodes.push(...nodes.filter(n => (n.layer || 1) === minLayer));
  }

  function buildSubTree(node: CausalNode, depth: number, visited: Set<string>): TreeNode {
    if (visited.has(node.id)) {
      return { node, children: [], depth };
    }
    visited.add(node.id);

    const childEdges = edges.filter(e => e.source === node.id);
    const children = childEdges
      .map(edge => {
        const childNode = nodes.find(n => n.id === edge.target);
        if (!childNode) return null;
        return buildSubTree(childNode, depth + 1, visited);
      })
      .filter(Boolean) as TreeNode[];

    return { node, children, depth };
  }

  const visited = new Set<string>();
  return rootNodes.map(n => buildSubTree(n, 0, visited));
}

// 渲染单条推理链
function ChainLine({ treeNode, edges, onNodeClick, expanded, onToggle }: {
  treeNode: TreeNode;
  edges: CausalEdge[];
  onNodeClick?: (node: CausalNode) => void;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}) {
  const { node, children, depth } = treeNode;

  const hasChildren = children.length > 0;
  const isExpanded = expanded.has(node.id);
  const nodeColor = NODE_TYPE_COLORS[node.type || 'event'] || NODE_TYPE_COLORS.event;

  // 查找连接到这个节点的边（信息来源）
  const incomingEdges = edges.filter(e => e.target === node.id);
  const parentInfo = incomingEdges.length > 0
    ? incomingEdges.map(e => {
        const parent = treeNode.node.id === node.id
          ? null
          : null;
        return e;
      }).filter(Boolean)
    : [];

  return (
    <div className="select-none">
      {/* 当前节点行 */}
      <div
        className="flex items-center gap-1.5 py-1.5 px-2 rounded-lg hover:bg-slate-700/40 transition-colors cursor-pointer group"
        style={{ paddingLeft: `${depth * 24 + 8}px` }}
        onClick={() => onNodeClick?.(node)}
      >
        {/* 展开/收起按钮 */}
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(node.id); }}
            className="p-0.5 hover:bg-slate-600/50 rounded transition-colors shrink-0"
          >
            {isExpanded
              ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            }
          </button>
        ) : (
          <Circle className="h-2 w-2 text-slate-600 shrink-0 ml-1" />
        )}

        {/* 节点类型标签 */}
        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium uppercase tracking-wide shrink-0 ${nodeColor}`}>
          {node.type || 'event'}
        </span>

        {/* 节点名称 */}
        <span className="text-sm text-slate-200 group-hover:text-white font-medium shrink-0">
          {node.label}
        </span>

        {/* 概率 */}
        {typeof node.probability === 'number' && (
          <span className="text-xs text-slate-500 shrink-0">
            {node.probability}%
          </span>
        )}

        {/* 层号 */}
        {node.layer && (
          <span className="text-[10px] text-slate-600 shrink-0">
            L{node.layer}
          </span>
        )}

        {/* 入边信息 */}
        {incomingEdges.length > 0 && (
          <div className="flex items-center gap-1 ml-2 shrink-0">
            {incomingEdges.map((edge, i) => (
              <span key={i} className="text-[10px] text-slate-500 flex items-center gap-0.5">
                <span className="text-violet-400/60">{EDGE_TYPE_LABELS[edge.type || 'causes']}</span>
                {edge.label && <span className="text-slate-400">({edge.label})</span>}
                {edge.strength && edge.strength !== 'medium' && (
                  <span className="text-amber-400/60">{STRENGTH_LABELS[edge.strength]}</span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 子节点 */}
      {hasChildren && isExpanded && (
        <div>
          {children.map(child => (
            <ChainLine
              key={child.node.id}
              treeNode={child}
              edges={edges}
              onNodeClick={onNodeClick}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CausalTreeView({
  graph,
  onNodeClick,
}: {
  graph: CausalGraph;
  onNodeClick?: (node: CausalNode) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // 默认展开前两层
    const initial = new Set<string>();
    graph.nodes
      .filter(n => (n.layer || 1) <= 2)
      .forEach(n => initial.add(n.id));
    return initial;
  });

  const toggleNode = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpanded(new Set(graph.nodes.map(n => n.id)));
  };

  const collapseAll = () => {
    setExpanded(new Set(graph.nodes.filter(n => (n.layer || 1) <= 1).map(n => n.id)));
  };

  const tree = useMemo(() => buildTree(graph.nodes, graph.edges || []), [graph.nodes, graph.edges]);

  if (tree.length === 0) {
    return (
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardContent className="p-6 text-center text-slate-500 text-sm">
          暂无因果图数据
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="text-violet-400">●</span> 因果链视图
          </span>
          <span>{graph.nodes.length} 节点 · {graph.edges?.length || 0} 条边</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={expandAll}
            className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1 rounded hover:bg-slate-700/50 transition-colors"
          >
            全部展开
          </button>
          <span className="text-slate-700">|</span>
          <button
            onClick={collapseAll}
            className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1 rounded hover:bg-slate-700/50 transition-colors"
          >
            全部折叠
          </button>
        </div>
      </div>

      {/* 图例 */}
      <div className="flex items-center gap-4 px-2 flex-wrap">
        {Object.entries(NODE_TYPE_COLORS).map(([type, cls]) => (
          <span key={type} className={`text-[10px] px-1.5 py-0.5 rounded border ${cls}`}>
            {type}
          </span>
        ))}
        <span className="text-[10px] text-slate-600">点击节点可编辑</span>
      </div>

      {/* 树形链 */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-700/30 p-2 max-h-[500px] overflow-y-auto">
        {tree.map((treeNode, i) => (
          <ChainLine
            key={`${treeNode.node.id}_${i}`}
            treeNode={treeNode}
            edges={graph.edges || []}
            onNodeClick={onNodeClick}
            expanded={expanded}
            onToggle={toggleNode}
          />
        ))}
      </div>
    </div>
  );
}
