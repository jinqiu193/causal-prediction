'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CausalNode, NodeType } from '@/lib/types';
import { Trash2, Save, RotateCcw, GitBranch, Loader2 } from 'lucide-react';

interface NodeEditDialogProps {
  node: CausalNode | null;
  open: boolean;
  onClose: () => void;
  onSave: (node: CausalNode) => void;
  onDelete?: (nodeId: string) => void;
  onExpand?: (nodeId: string) => void; // 以此节点扩展，传递节点ID
  isExpanding?: boolean;
}

const NODE_TYPES: { value: NodeType; label: string }[] = [
  { value: 'event', label: '事件 (Event)' },
  { value: 'state', label: '状态 (State)' },
  { value: 'condition', label: '条件 (Condition)' },
  { value: 'outcome', label: '结果 (Outcome)' },
  { value: 'feedback', label: '反馈 (Feedback)' },
];

export default function NodeEditDialog({
  node,
  open,
  onClose,
  onSave,
  onDelete,
  onExpand,
  isExpanding,
}: NodeEditDialogProps) {
  const [editedNode, setEditedNode] = useState<CausalNode | null>(null);
  const [probability, setProbability] = useState(50);

  useEffect(() => {
    if (node) {
      setEditedNode({ ...node });
      setProbability(node.probability || 50);
    }
  }, [node]);

  if (!editedNode) return null;

  const handleSave = () => {
    onSave({
      ...editedNode,
      probability,
      isUserModified: true,
    });
    onClose();
  };

  const handleReset = () => {
    if (node) {
      setEditedNode({ ...node });
      setProbability(node.probability || 50);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            编辑节点
            {editedNode.isUserModified && (
              <span className="text-xs px-2 py-0.5 bg-violet-500/20 text-violet-400 rounded-full">
                已修改
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 节点名称 */}
          <div className="space-y-2">
            <Label className="text-slate-300">节点名称</Label>
            <Input
              value={editedNode.label}
              onChange={(e) => setEditedNode({ ...editedNode, label: e.target.value })}
              className="bg-slate-900 border-slate-600 text-white"
            />
          </div>

          {/* 节点类型 */}
          <div className="space-y-2">
            <Label className="text-slate-300">节点类型</Label>
            <Select
              value={editedNode.type || 'event'}
              onValueChange={(value: NodeType) => 
                setEditedNode({ ...editedNode, type: value })
              }
            >
              <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {NODE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 发生概率 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-slate-300">发生概率</Label>
              <span className="text-2xl font-bold text-cyan-400">{probability}%</span>
            </div>
            <Slider
              value={[probability]}
              onValueChange={([value]) => setProbability(value)}
              min={0}
              max={100}
              step={5}
              className="py-4"
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>不太可能</span>
              <span>可能</span>
              <span>非常可能</span>
            </div>
          </div>

          {/* 节点描述 */}
          <div className="space-y-2">
            <Label className="text-slate-300">描述说明</Label>
            <Input
              value={editedNode.description || ''}
              onChange={(e) => setEditedNode({ ...editedNode, description: e.target.value })}
              placeholder="添加节点描述..."
              className="bg-slate-900 border-slate-600 text-white"
            />
          </div>

          {/* 关键词 */}
          <div className="space-y-2">
            <Label className="text-slate-300">搜索关键词</Label>
            <Input
              value={editedNode.keywords?.join(', ') || ''}
              onChange={(e) => setEditedNode({ 
                ...editedNode, 
                keywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean)
              })}
              placeholder="关键词1, 关键词2, ..."
              className="bg-slate-900 border-slate-600 text-white"
            />
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={handleReset}
              className="flex-1 bg-transparent border-slate-600 text-slate-300"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              重置
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1 bg-gradient-to-r from-violet-500 to-cyan-500"
            >
              <Save className="h-4 w-4 mr-2" />
              保存
            </Button>
          </div>

          {/* 扩展按钮 */}
          {onExpand && (
            <Button
              variant="outline"
              onClick={() => {
                onExpand(editedNode.id);
              }}
              disabled={isExpanding}
              className="w-full bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20"
            >
              {isExpanding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  正在扩展推理链...
                </>
              ) : (
                <>
                  <GitBranch className="h-4 w-4 mr-2" />
                  以此节点为假设继续扩展推理
                </>
              )}
            </Button>
          )}

          {/* 删除按钮 */}
          {onDelete && (
            <Button
              variant="outline"
              onClick={() => {
                onDelete(editedNode.id);
                onClose();
              }}
              className="w-full bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              删除此节点
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
