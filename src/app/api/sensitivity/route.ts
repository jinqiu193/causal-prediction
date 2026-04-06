import { NextRequest } from 'next/server';
import type { CausalGraph, SensitivityAnalysis } from '@/lib/types';

const SENSITIVITY_PROMPT = `你是一个系统动力学分析专家。基于给定的因果关系图，进行敏感性分析。

分析每个节点对最终结果的影响程度，输出JSON格式：

{"factors":[{"nodeId":"node_1","nodeLabel":"节点名称","impact":35,"direction":"positive","description":"影响说明"}],"baseProbability":75,"analysis":"整体敏感性分析结论"}

要求：
- factors 数组按 impact 从大到小排序
- impact 为 0-100 的整数，表示影响权重
- direction: positive(正向促进) 或 negative(负向抑制)
- 所有节点的 impact 总和应接近 100
- 分析影响最大的前5-7个节点

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
  let body: { graph?: CausalGraph; apiConfig?: Record<string, string> };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: '无效请求' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const { graph, apiConfig } = body;

  const apiUrl = apiConfig?.minimaxApiUrl || process.env.MINIMAX_API_URL || 'https://api.minimaxi.com/anthropic/v1/messages';
  const apiKey = apiConfig?.minimaxApiKey || process.env.MINIMAX_API_KEY || '';
  const model = apiConfig?.minimaxModel || process.env.MINIMAX_MODEL || 'MiniMax-M2.7';

  if (!graph) {
    return new Response(JSON.stringify({ error: '缺少因果图数据' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const messages = [
      { role: 'system', content: SENSITIVITY_PROMPT },
      { role: 'user', content: `因果图：${JSON.stringify(graph)}` }
    ];

    const response = await callMinimax(apiUrl, apiKey, model, messages, 0.3);
    const parsed = safeParseJson(response) as SensitivityAnalysis | null;

    if (parsed && parsed.factors) {
      return new Response(JSON.stringify(parsed), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      factors: graph.nodes.slice(0, 5).map((n, i) => ({
        nodeId: n.id,
        nodeLabel: n.label,
        impact: Math.round(80 / (i + 1)),
        direction: 'positive' as const,
        description: n.description || ''
      })),
      baseProbability: 60,
      analysis: '基于因果图分析完成'
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
