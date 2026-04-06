import { NextRequest, NextResponse } from 'next/server';

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

const EXPAND_PROMPT = `你是一个系统动力学建模专家。基于给定的假设节点，深度推演其后续因果链。

原始问题：{question}

假设起点节点：
- 节点名称：{nodeLabel}
- 节点描述：{nodeDescription}
- 节点类型：{nodeType}

请以这个节点为假设起点，深度推演其后续发展（向后2-3层因果链）。

要求：
- 输出新的节点（4-8个），每个节点需包含：id、label、description、type、keywords、layer、probability
- layer 从假设节点的 layer+1 开始递进
- 每条因果边需标注 source、target、label、strength、type
- 每条边都是"假设起点节点的后续影响链"的一部分
- 节点要体现因果传导逻辑，不要有跳跃

输出JSON格式：
{"expandedNodes":[{"id":"exp_node_1","label":"新节点名称","description":"因果描述","type":"event","keywords":["关键词"],"layer":5,"probability":65}],"expandedEdges":[{"id":"exp_edge_1","source":"exp_node_1","target":"exp_node_2","label":"因果传导","strength":"medium","type":"causes"}],"reasoning":"推演思路说明（100字以内）"}

只输出JSON，不要其他文字。`;

export async function POST(request: NextRequest) {
  let body: {
    node: { id: string; label: string; description?: string; type?: string; layer?: number; probability?: number };
    question: string;
    existingNodeIds: string[];
    apiConfig?: Record<string, string>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '无效请求' }, { status: 400 });
  }

  const { node, question, existingNodeIds = [], apiConfig } = body;

  const apiUrl = apiConfig?.minimaxApiUrl || process.env.MINIMAX_API_URL || 'https://api.minimaxi.com/anthropic/v1/messages';
  const apiKey = apiConfig?.minimaxApiKey || process.env.MINIMAX_API_KEY || '';
  const model = apiConfig?.minimaxModel || process.env.MINIMAX_MODEL || 'MiniMax-M2.7';

  if (!node?.label || !question) {
    return NextResponse.json({ error: '缺少节点或问题' }, { status: 400 });
  }

  try {
    const prompt = EXPAND_PROMPT
      .replace('{question}', question)
      .replace('{nodeLabel}', node.label)
      .replace('{nodeDescription}', node.description || '无')
      .replace('{nodeType}', node.type || 'event');

    const messages = [
      { role: 'system', content: prompt },
      { role: 'user', content: `请基于「${node.label}」这个假设节点，深度推演其后续因果链。` }
    ];

    const response = await callMinimax(apiUrl, apiKey, model, messages, 0.3);
    console.log('[Graph Expand] LLM raw response (first 500 chars):', response.slice(0, 500));
    const parsed = safeParseJson(response) as {
      expandedNodes?: Array<{ id: string; label: string; description?: string; type?: string; keywords?: string[]; layer?: number; probability?: number }>;
      expandedEdges?: Array<{ id: string; source: string; target: string; label?: string; strength?: string; type?: string }>;
      reasoning?: string;
    } | null;

    if (!parsed || !parsed.expandedNodes) {
      return NextResponse.json({
        expandedNodes: [],
        expandedEdges: [],
        reasoning: '未能生成扩展内容'
      });
    }

    // 过滤掉与已有节点 id 重复的
    const newNodes = (parsed.expandedNodes || [])
      .filter(n => !existingNodeIds.includes(n.id))
      .map((n, i) => ({
        id: n.id || `exp_node_${Date.now()}_${i}`,
        label: n.label || `扩展节点${i + 1}`,
        description: n.description || '',
        type: n.type || 'event',
        keywords: Array.isArray(n.keywords) ? n.keywords : [],
        layer: n.layer || (node.layer || 1) + 1,
        probability: typeof n.probability === 'number' ? n.probability : 50,
      }));

    // 为新节点生成唯一 id（防止 id 冲突）
    const idMap: Record<string, string> = {};
    newNodes.forEach((n, i) => {
      idMap[n.id] = `exp_${Date.now()}_${i}`;
    });

    const renamedNodes = newNodes.map(n => ({ ...n, id: idMap[n.id] || n.id }));

    // 重写边的引用
    const renamedEdges = (parsed.expandedEdges || []).map((e, i) => ({
      id: `exp_edge_${Date.now()}_${i}`,
      source: idMap[e.source] || e.source,
      target: idMap[e.target] || e.target,
      label: e.label || '导致',
      strength: e.strength || 'medium',
      type: e.type || 'causes',
    }));

    // 如果解析失败或没有扩展节点，返回友好提示
    if (!parsed || !parsed.expandedNodes || parsed.expandedNodes.length === 0) {
      return NextResponse.json({
        expandedNodes: renamedNodes.length > 0 ? renamedNodes : [],
        expandedEdges: renamedEdges.length > 0 ? renamedEdges : [],
        reasoning: parsed?.reasoning || '已尽可能扩展因果链'
      });
    }

    return NextResponse.json({
      expandedNodes: renamedNodes,
      expandedEdges: renamedEdges,
      reasoning: parsed.reasoning || '基于假设节点完成因果链推演'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
