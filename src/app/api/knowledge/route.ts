import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { KnowledgeItem } from '@/lib/types';

const DATA_DIR = join(process.cwd(), 'data');
const KNOWLEDGE_FILE = join(DATA_DIR, 'knowledge.json');

function readKnowledge(): { items: KnowledgeItem[] } {
  try {
    if (!existsSync(KNOWLEDGE_FILE)) {
      return { items: [] };
    }
    const raw = readFileSync(KNOWLEDGE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { items: [] };
  }
}

function writeKnowledge(data: { items: KnowledgeItem[] }) {
  if (!existsSync(DATA_DIR)) {
    require('fs').mkdirSync(DATA_DIR, { recursive: true });
  }
  writeFileSync(KNOWLEDGE_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// GET: 获取所有知识条目 / 检索相关条目
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const category = searchParams.get('category') || '';

  const { items } = readKnowledge();

  // 关键词检索
  if (query) {
    const keywords = query.toLowerCase().split(/\s+/);
    const filtered = items.filter(item => {
      const text = `${item.title} ${item.content} ${item.tags.join(' ')} ${item.category}`.toLowerCase();
      return keywords.every(k => text.includes(k));
    });
    // 按优先级和相关性排序
    filtered.sort((a, b) => b.priority - a.priority);
    return NextResponse.json({ items: filtered, total: filtered.length });
  }

  if (category) {
    const filtered = items.filter(i => i.category === category);
    return NextResponse.json({ items: filtered, total: filtered.length });
  }

  return NextResponse.json({ items, total: items.length });
}

// POST: 新增知识条目
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Partial<KnowledgeItem>;
    
    if (!body.title || !body.content) {
      return NextResponse.json({ error: '标题和内容不能为空' }, { status: 400 });
    }

    const { items } = readKnowledge();
    const now = new Date().toISOString();

    const newItem: KnowledgeItem = {
      id: `kb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: body.title.trim(),
      content: body.content.trim(),
      category: body.category?.trim() || '通用',
      priority: typeof body.priority === 'number' ? Math.min(10, Math.max(1, body.priority)) : 5,
      tags: Array.isArray(body.tags) ? body.tags.map(t => t.trim()).filter(Boolean) : [],
      createdAt: now,
      updatedAt: now,
    };

    items.push(newItem);
    writeKnowledge({ items });

    return NextResponse.json({ item: newItem }, { status: 201 });
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }
}

// PUT: 更新知识条目
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json() as Partial<KnowledgeItem> & { id: string };
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少条目ID' }, { status: 400 });
    }

    const { items } = readKnowledge();
    const index = items.findIndex(i => i.id === id);

    if (index === -1) {
      return NextResponse.json({ error: '条目不存在' }, { status: 404 });
    }

    const updated: KnowledgeItem = {
      ...items[index],
      title: body.title?.trim() ?? items[index].title,
      content: body.content?.trim() ?? items[index].content,
      category: body.category?.trim() ?? items[index].category,
      priority: typeof body.priority === 'number' ? Math.min(10, Math.max(1, body.priority)) : items[index].priority,
      tags: Array.isArray(body.tags) ? body.tags.map(t => t.trim()).filter(Boolean) : items[index].tags,
      updatedAt: new Date().toISOString(),
    };

    items[index] = updated;
    writeKnowledge({ items });

    return NextResponse.json({ item: updated });
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }
}

// DELETE: 删除知识条目
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: '缺少条目ID' }, { status: 400 });
  }

  const { items } = readKnowledge();
  const filtered = items.filter(i => i.id !== id);

  if (filtered.length === items.length) {
    return NextResponse.json({ error: '条目不存在' }, { status: 404 });
  }

  writeKnowledge({ items: filtered });
  return NextResponse.json({ success: true });
}
