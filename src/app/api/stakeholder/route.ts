import { NextRequest, NextResponse } from 'next/server';
import type { StakeholderAnalysis, CausalGraph } from '@/lib/types';

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

const STAKEHOLDER_PROMPT = `你是地缘政治与战略分析专家。基于以下因果图和问题，进行利益相关者分析。

问题：{question}

因果图节点：
{nodes}

因果图边：
{edges}

请分析所有涉及的利益主体，输出JSON格式：
{
  "stakeholders": [
    {
      "id": "st_1",
      "name": "主体名称",
      "type": "government/corporation/organization/individual/bloc",
      "description": "简要描述",
      "attributes": {
        "interest": "核心利益",
        "stance": "support/oppose/neutral/conditional",
        "capability": "strong/moderate/weak",
        "influence": 80,
        "resource": "关键资源"
      },
      "possibleActions": [
        {
          "action": "可能采取的措施",
          "probability": 70,
          "timeframe": "短期/中期/长期",
          "impact": "high/medium/low",
          "description": "措施说明"
        }
      ]
    }
  ],
  "summary": "总体利益格局分析（100字以内）"
}

要求：
- 识别3-8个主要利益主体
- 每个主体分析其核心利益、立场、能力、影响力
- 列出每个主体最可能的2-4项行动
- 只输出JSON，不要其他文字。`;

export async function POST(request: NextRequest) {
  let body: {
    graph?: CausalGraph;
    question?: string;
    apiConfig?: Record<string, string>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '无效请求' }, { status: 400 });
  }

  const { graph, question, apiConfig } = body;

  const apiUrl = apiConfig?.minimaxApiUrl || process.env.MINIMAX_API_URL || 'https://api.minimaxi.com/anthropic/v1/messages';
  const apiKey = apiConfig?.minimaxApiKey || process.env.MINIMAX_API_KEY || '';
  const model = apiConfig?.minimaxModel || process.env.MINIMAX_MODEL || 'MiniMax-M2.7';

  if (!graph || !question) {
    return NextResponse.json({ error: '缺少因果图或问题' }, { status: 400 });
  }

  try {
    const nodesText = graph.nodes.map(n =>
      `- ${n.label}${n.description ? `（${n.description}）` : ''}`
    ).join('\n');

    const edgesText = graph.edges.map(e => {
      const source = graph.nodes.find(n => n.id === e.source)?.label || e.source;
      const target = graph.nodes.find(n => n.id === e.target)?.label || e.target;
      return `- ${source} → ${target}（${e.type || 'causes'}）`;
    }).join('\n');

    const prompt = STAKEHOLDER_PROMPT
      .replace('{question}', question)
      .replace('{nodes}', nodesText)
      .replace('{edges}', edgesText);

    const messages = [
      { role: 'system', content: prompt },
      { role: 'user', content: '请分析上述因果图中的利益相关者。' }
    ];

    const response = await callMinimax(apiUrl, apiKey, model, messages, 0.4);
    const parsed = safeParseJson(response) as StakeholderAnalysis | null;

    if (parsed && parsed.stakeholders) {
      // 确保 id 唯一
      const stakeholders = parsed.stakeholders.map((s, i) => ({
        ...s,
        id: s.id || `st_${Date.now()}_${i}`,
        possibleActions: (s.possibleActions || []).map((a, j) => ({
          ...a,
          probability: Math.min(100, Math.max(0, a.probability || 50)),
          impact: a.impact || 'medium',
        }))
      }));

      return NextResponse.json({
        question,
        stakeholders,
        summary: parsed.summary || '利益格局分析完成',
      });
    }

    // 降级返回空分析
    return NextResponse.json({
      question,
      stakeholders: [],
      summary: '未能生成利益分析'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json({ error: message, stakeholders: [], summary: '' }, { status: 500 });
  }
}
