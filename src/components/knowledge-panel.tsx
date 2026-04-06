'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import type { KnowledgeItem } from '@/lib/types';
import {
  Plus,
  Trash2,
  Edit2,
  Search,
  BookOpen,
  Tag,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

const CATEGORIES = ['通用', '政治', '经济', '科技', '社会', '军事', '环境', '文化', '法律', '金融'];

function EditDialog({
  open,
  onClose,
  item,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  item?: KnowledgeItem;
  onSave: (data: Partial<KnowledgeItem>) => void;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('通用');
  const [priority, setPriority] = useState(5);
  const [tags, setTags] = useState('');

  useEffect(() => {
    if (open) {
      if (item) {
        setTitle(item.title);
        setContent(item.content);
        setCategory(item.category);
        setPriority(item.priority);
        setTags(item.tags.join('、'));
      } else {
        setTitle('');
        setContent('');
        setCategory('通用');
        setPriority(5);
        setTags('');
      }
    }
  }, [open, item]);

  const handleSave = () => {
    if (!title.trim() || !content.trim()) return;
    onSave({
      title: title.trim(),
      content: content.trim(),
      category,
      priority,
      tags: tags.split(/[、,，]/).map(t => t.trim()).filter(Boolean),
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-slate-100">
            {item ? '编辑知识条目' : '新增知识条目'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">标题</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="如：石油危机必引发通胀"
              className="bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">内容（原则/规律）</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="描述这条确定性高的原则..."
              rows={4}
              className="bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500 text-sm resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">分类</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {CATEGORIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">优先级 (1-10)</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={priority}
                onChange={(e) => setPriority(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                className="bg-slate-800 border-slate-600 text-slate-100 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">标签（用顿号、分隔）</Label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="如：能源、制裁、通胀"
              className="bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500 text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="bg-transparent border-slate-600 text-slate-400">
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={!title.trim() || !content.trim()}
            className="bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-600 hover:to-cyan-600 text-white"
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function KnowledgePanel() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editItem, setEditItem] = useState<KnowledgeItem | undefined>();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const url = searchQuery
        ? `/api/knowledge?q=${encodeURIComponent(searchQuery)}`
        : '/api/knowledge';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json() as { items: KnowledgeItem[] };
        setItems(data.items);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleSave = async (data: Partial<KnowledgeItem>) => {
    try {
      if (editItem) {
        const res = await fetch('/api/knowledge', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editItem.id, ...data }),
        });
        if (res.ok) {
          await fetchItems();
        }
      } else {
        const res = await fetch('/api/knowledge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (res.ok) {
          await fetchItems();
        }
      }
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`/api/knowledge?id=${id}`, { method: 'DELETE' });
      await fetchItems();
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* 搜索 + 新增 */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索知识库..."
            className="pl-9 bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 text-sm"
          />
        </div>
        <Button
          onClick={() => { setEditItem(undefined); setShowEditDialog(true); }}
          className="bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-600 hover:to-cyan-600 text-white shrink-0"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-1" />
          新增
        </Button>
      </div>

      {/* 统计 */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <BookOpen className="h-3.5 w-3.5" />
          共 {items.length} 条
        </span>
        {searchQuery && (
          <span>搜索结果：{items.length} 条</span>
        )}
      </div>

      {/* 列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          加载中...
        </div>
      ) : items.length === 0 ? (
        <Card className="bg-slate-800/30 border-slate-700/50">
          <CardContent className="py-10 text-center text-slate-500 text-sm">
            {searchQuery ? '未找到匹配的知识条目' : '知识库为空，点击右上角「新增」添加第一条知识'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
          {items.map((item) => (
            <Card key={item.id} className="bg-slate-800/40 border-slate-700/50 hover:border-slate-600/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="font-medium text-slate-200 text-sm">{item.title}</span>
                      <span className="text-xs px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 rounded">
                        {item.category}
                      </span>
                      <span className="text-xs text-slate-500">优先级 {item.priority}</span>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed line-clamp-2 mb-2">
                      {item.content}
                    </p>
                    {item.tags.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Tag className="h-3 w-3 text-slate-600" />
                        {item.tags.map(tag => (
                          <span key={tag} className="text-xs text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => { setEditItem(item); setShowEditDialog(true); }}
                      className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      {deletingId === item.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 提示 */}
      <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400/80">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <span>知识库中的高优先级原则将在构建因果图时优先被检索，作为分析前置参考。优先级越高、匹配度越高的原则越靠前。</span>
      </div>

      <EditDialog
        open={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        item={editItem}
        onSave={handleSave}
      />
    </div>
  );
}
