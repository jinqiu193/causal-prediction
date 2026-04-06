import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { KnowledgeItem } from '@/lib/types';

const KNOWLEDGE_FILE = join(process.cwd(), 'data', 'knowledge.json');

// 简单关键词检索 + 优先级排序
function retrieveRelevantKnowledge(question: string, topK: number = 5): KnowledgeItem[] {
  try {
    if (!existsSync(KNOWLEDGE_FILE)) {
      return [];
    }

    const raw = readFileSync(KNOWLEDGE_FILE, 'utf-8');
    const { items } = JSON.parse(raw) as { items: KnowledgeItem[] };

    if (items.length === 0) {
      return [];
    }

    const q = question.toLowerCase();
    // 提取关键词（去掉常见停用词）
    const stopWords = new Set(['的', '了', '和', '是', '在', '对', '有', '会', '如何', '什么', '如果', '会怎样', '产生', '影响', '?', '？', '。', ',', '，']);
    const questionWords = q.split(/\s+|[，。？！、,]/).filter(w => w.length > 1 && !stopWords.has(w));

    // 计算每条知识的匹配得分
    const scored = items.map(item => {
      const text = `${item.title} ${item.content} ${item.tags.join(' ')} ${item.category}`.toLowerCase();
      let score = 0;

      // 完全包含得分
      if (text.includes(q)) score += 20;
      // 关键词匹配
      questionWords.forEach(w => {
        if (text.includes(w)) score += 5;
      });
      // 标签匹配加权
      item.tags.forEach(tag => {
        if (q.includes(tag.toLowerCase())) score += 8;
      });
      // 类目匹配
      if (q.includes(item.category.toLowerCase())) score += 3;
      // 优先级加成
      score += item.priority;

      return { item, score };
    });

    // 过滤掉得分过低的，按得分排序取 topK
    const filtered = scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return filtered.map(s => s.item);
  } catch {
    return [];
  }
}

// POST: 检索相关知识
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { question: string; topK?: number };
    const { question, topK = 5 } = body;

    if (!question) {
      return NextResponse.json({ error: '缺少问题' }, { status: 400 });
    }

    const knowledge = retrieveRelevantKnowledge(question, topK);

    return NextResponse.json({
      knowledge,
      count: knowledge.length,
      prompt: knowledge.length > 0
        ? `【知识库参考原则】\n${knowledge.map((k, i) => `${i + 1}. [${k.category}] ${k.title}：${k.content}`).join('\n')}\n\n请结合上述原则进行因果分析。`
        : ''
    });
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }
}
