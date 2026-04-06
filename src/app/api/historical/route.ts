import { NextRequest } from 'next/server';
import type { HistoricalCase } from '@/lib/types';

const CASE_ANALYSIS_PROMPT = `你是一个历史分析专家。基于搜索到的新闻和信息，提取历史相似案例。

分析这些信息，找出与当前问题相似的历史事件，输出JSON格式：

{"cases":[{"id":"case_1","title":"历史事件名称","summary":"事件概述","year":2020,"similarity":75,"outcome":"最终结果","keyFactors":["因素1","因素2"],"lessons":["经验教训1","经验教训2"]}]}

要求：
- cases 数组包含 2-4 个最相似的历史案例
- similarity 为 0-100 的相似度评分
- year 为事件发生年份
- outcome 描述实际发生的结果
- keyFactors 列出关键影响因素
- lessons 提炼可借鉴的经验

只输出JSON，不要其他文字。`;

async function callMinimax(
  apiUrl: string,
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  temperature: number
): Promise<string> {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature,
      max_tokens: 4096
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MiniMax API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as { content: Array<{ type: string; text?: string }> };
  return data.content.find(c => c.type === 'text')?.text || '';
}

function safeParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch {}
    return null;
  }
}

export async function POST(request: NextRequest) {
  let body: { question?: string; keywords?: string[]; apiConfig?: Record<string, string> };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: '无效请求' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const { question, keywords = [], apiConfig } = body;

  const apiUrl = apiConfig?.minimaxApiUrl || process.env.MINIMAX_API_URL || 'https://api.minimaxi.com/anthropic/v1/messages';
  const apiKey = apiConfig?.minimaxApiKey || process.env.MINIMAX_API_KEY || '';
  const model = apiConfig?.minimaxModel || process.env.MINIMAX_MODEL || 'MiniMax-M2.7';

  if (!question) {
    return new Response(JSON.stringify({ error: '请提供问题' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const messages = [
      { role: 'system', content: CASE_ANALYSIS_PROMPT },
      { role: 'user', content: `问题：${question}\n关键词：${keywords.join('、')}` }
    ];

    const response = await callMinimax(apiUrl, apiKey, model, messages, 0.3);
    const parsed = safeParseJson(response) as { cases?: HistoricalCase[] } | null;

    if (parsed && parsed.cases) {
      return new Response(JSON.stringify({ cases: parsed.cases }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ cases: [] }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    return new Response(JSON.stringify({ error: message, cases: [] }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
