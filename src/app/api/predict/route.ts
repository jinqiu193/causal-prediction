import { NextRequest } from 'next/server';
import type { CausalGraph, PredictionResult, StreamEvent } from '@/lib/types';

// MiniMax API 配置（默认从环境变量读取，支持前端传入覆盖）
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || '';
const MINIMAX_API_URL = process.env.MINIMAX_API_URL || 'https://api.minimaxi.com/anthropic/v1/messages';
const MINIMAX_MODEL = process.env.MINIMAX_MODEL || 'MiniMax-M2.7';

// Tavily 搜索配置
const TAVILY_API_KEY = process.env.TAVILY_API_KEY || '';
const TAVILY_API_URL = process.env.TAVILY_API_URL || 'https://api.tavily.com/search';

interface ApiConfig {
  minimaxApiKey?: string;
  minimaxApiUrl?: string;
  minimaxModel?: string;
  tavilyApiKey?: string;
  tavilyApiUrl?: string;
}

// JSON修复函数 - 尝试修复常见的JSON格式问题
function tryFixJson(jsonStr: string): string {
  let fixed = jsonStr;
  
  // 移除可能的注释
  fixed = fixed.replace(/\/\*[\s\S]*?\*\//g, '');
  fixed = fixed.replace(/\/\/.*$/gm, '');
  
  // 移除末尾的逗号
  fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
  
  // 移除markdown代码块标记
  fixed = fixed.replace(/```json\s*/gi, '');
  fixed = fixed.replace(/```\s*/g, '');
  
  return fixed;
}

// 安全解析JSON
function safeParseJson(text: string): { success: boolean; data?: unknown; error?: string } {
  try {
    // 尝试直接解析
    return { success: true, data: JSON.parse(text) };
  } catch {
    // 尝试修复后解析
    try {
      const fixed = tryFixJson(text);
      return { success: true, data: JSON.parse(fixed) };
    } catch {
      // 尝试提取JSON块
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const fixed = tryFixJson(jsonMatch[0]);
          return { success: true, data: JSON.parse(fixed) };
        }
      } catch {
        // 最终失败
      }
    }
    return { success: false, error: 'JSON解析失败' };
  }
}

// 调用 MiniMax API
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

// Tavily 搜索
async function tavilySearch(apiUrl: string, apiKey: string, query: string, maxResults: number = 3): Promise<string> {
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: maxResults,
        search_depth: 'basic',
        include_answer: true
      })
    });

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.status}`);
    }

    const data = await response.json() as { answer?: string; results?: Array<{ content?: string }> };
    
    // 优先返回 AI 摘要，否则拼接搜索结果
    if (data.answer) {
      return data.answer.slice(0, 300);
    }
    if (data.results && data.results.length > 0) {
      return data.results.slice(0, 2).map(r => r.content).filter(Boolean).join(' ').slice(0, 300);
    }
    return '';
  } catch (error) {
    console.error('Tavily search error:', error);
    return '';
  }
}

// 构建备用因果图
function buildFallbackGraph(question: string): CausalGraph {
  return {
    nodes: [
      { id: 'node_1', label: '触发事件', description: question, type: 'event', keywords: [question.slice(0, 15)], layer: 1, probability: 60 },
      { id: 'node_2', label: '直接影响', description: '事件的一级影响', type: 'state', keywords: ['直接影响'], layer: 2, probability: 55 },
      { id: 'node_3', label: '间接影响', description: '事件的二级影响', type: 'state', keywords: ['间接影响'], layer: 3, probability: 45 },
      { id: 'node_4', label: '长期趋势', description: '长期发展趋势', type: 'outcome', keywords: ['长期趋势'], layer: 4, probability: 35 }
    ],
    edges: [
      { id: 'edge_1', source: 'node_1', target: 'node_2', label: '导致', strength: 'medium', type: 'causes' },
      { id: 'edge_2', source: 'node_2', target: 'node_3', label: '引发', strength: 'medium', type: 'causes' },
      { id: 'edge_3', source: 'node_3', target: 'node_4', label: '演变为', strength: 'weak', type: 'causes' }
    ],
    description: '基于问题的基础因果分析'
  };
}

export async function POST(request: NextRequest) {
  let body: { question?: string; customLogic?: string; depth?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: '无效的请求体' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { question, customLogic, depth = 'deep', apiConfig } = body as { question?: string; customLogic?: string; depth?: string; apiConfig?: ApiConfig };

  // 前端传入的配置优先，否则用环境变量
  const effectiveConfig = {
    minimaxApiKey: apiConfig?.minimaxApiKey || MINIMAX_API_KEY,
    minimaxApiUrl: apiConfig?.minimaxApiUrl || MINIMAX_API_URL,
    minimaxModel: apiConfig?.minimaxModel || MINIMAX_MODEL,
    tavilyApiKey: apiConfig?.tavilyApiKey || TAVILY_API_KEY,
    tavilyApiUrl: apiConfig?.tavilyApiUrl || TAVILY_API_URL,
  };

  if (!question) {
    return new Response(
      JSON.stringify({ error: '请输入问题' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 根据深度调整节点数量要求
  const nodeCount = depth === 'comprehensive' ? '15-20' : depth === 'deep' ? '12-16' : '8-12';

  // 构建提示词
  const buildGraphPrompt = `你是系统动力学建模专家。构建多层级因果关系图。

要求：
- 节点类型：event/state/condition/outcome/feedback
- 关系类型：causes/enables/prevents/amplifies
- 强度：critical/strong/medium/weak
- 节点数量：${nodeCount}个
- 推演深度：4-5层

输出合法JSON，格式：
{"nodes":[{"id":"node_1","label":"事件名","description":"说明","type":"event","keywords":["词1","词2"],"layer":1,"probability":80}],"edges":[{"id":"edge_1","source":"node_1","target":"node_2","label":"因果","strength":"strong","type":"causes"}],"scenarios":[{"id":"s1","name":"情景","description":"描述","probability":40,"path":["node_1"]}],"description":"整体描述"}

重要：只输出JSON，不要其他文字。`;

  const reasoningPrompt = `你是战略预测分析师。输出合法JSON：
{"summary":"结论(100-200字)","probability":75,"confidence":"medium","keyFactors":["因素1","因素2","因素3","因素4","因素5"],"timeline":"时间","scenarios":[{"name":"情景","probability":30,"description":"描述","triggers":["触发"]}],"turningPoints":[{"event":"转折","probability":40,"impact":"high","timeframe":"时间"}],"assumptions":["假设"],"risks":["风险"],"uncertainties":[{"factor":"不确定","impact":"影响"}]}`;

  // 创建流式响应
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        // 第一步：构建因果图
        sendEvent({ type: 'reasoning', data: '📊 正在分析问题，构建因果关系图...' });

        let fullPrompt = buildGraphPrompt;
        if (customLogic) {
          fullPrompt += `\n\n用户参考逻辑：${customLogic}`;
        }

        const graphMessages = [
          { role: 'system', content: fullPrompt },
          { role: 'user', content: question }
        ];

        const graphResponse = await callMinimax(
          effectiveConfig.minimaxApiUrl,
          effectiveConfig.minimaxApiKey,
          effectiveConfig.minimaxModel,
          graphMessages,
          0.3
        );

        // 解析因果图
        let causalGraph: CausalGraph;
        const parseResult = safeParseJson(graphResponse);
        
        if (parseResult.success && parseResult.data) {
          const parsed = parseResult.data as CausalGraph;
          
          // 验证基本结构
          if (parsed.nodes && Array.isArray(parsed.nodes) && parsed.nodes.length >= 4) {
            causalGraph = parsed;
            
            // 确保所有节点都有必要字段
            causalGraph.nodes = causalGraph.nodes.map((node, index) => ({
              ...node,
              id: node.id || `node_${index + 1}`,
              label: node.label || `节点${index + 1}`,
              description: node.description || '',
              type: node.type || 'event',
              keywords: Array.isArray(node.keywords) ? node.keywords : [],
              layer: node.layer || Math.floor(index / 4) + 1,
              probability: typeof node.probability === 'number' ? node.probability : 50
            }));

            // 确保所有边都有必要字段
            if (causalGraph.edges && Array.isArray(causalGraph.edges)) {
              causalGraph.edges = causalGraph.edges.map((edge, index) => ({
                ...edge,
                id: edge.id || `edge_${index + 1}`,
                source: edge.source,
                target: edge.target,
                label: edge.label || '',
                strength: edge.strength || 'medium',
                type: edge.type || 'causes'
              }));
            } else {
              causalGraph.edges = [];
            }
            
            sendEvent({ type: 'reasoning', data: `✅ 因果图构建完成 (${causalGraph.nodes.length}节点, ${causalGraph.edges.length}连线)` });
          } else {
            sendEvent({ type: 'reasoning', data: '⚠️ 使用简化模型...' });
            causalGraph = buildFallbackGraph(question);
          }
        } else {
          sendEvent({ type: 'reasoning', data: '⚠️ 使用简化模型...' });
          causalGraph = buildFallbackGraph(question);
        }

        sendEvent({ type: 'graph', data: causalGraph });

        // 第二步：搜索每个节点的新闻（使用 Tavily）
        sendEvent({ type: 'reasoning', data: '🔍 正在搜索相关新闻...' });

        const totalNodes = causalGraph.nodes.length;
        const nodesToSearch = causalGraph.nodes.slice(0, 8);

        for (let i = 0; i < nodesToSearch.length; i++) {
          const node = nodesToSearch[i];
          if (node.keywords && node.keywords.length > 0) {
            const searchQuery = node.keywords.slice(0, 2).join(' ');
            try {
              const summary = await tavilySearch(
                effectiveConfig.tavilyApiUrl,
                effectiveConfig.tavilyApiKey,
                searchQuery,
                2
              );
              if (summary) {
                node.newsSummary = summary.slice(0, 300);
              }
            } catch {
              // 搜索失败继续
            }
            sendEvent({ type: 'progress', data: { current: i + 1, total: totalNodes } });
            await new Promise(resolve => setTimeout(resolve, 150));
          }
        }

        sendEvent({ type: 'reasoning', data: '✅ 新闻搜索完成' });

        // 第三步：推理预测
        sendEvent({ type: 'reasoning', data: '🧠 正在进行预测分析...' });

        const newsContext = causalGraph.nodes
          .filter(n => n.newsSummary)
          .slice(0, 5)
          .map(n => `【${n.label}】${n.newsSummary}`)
          .join('\n');

        const reasoningMessages = [
          { role: 'system', content: reasoningPrompt },
          {
            role: 'user',
            content: `问题：${question}\n\n因果图：${JSON.stringify(causalGraph).slice(0, 3000)}\n\n新闻：${newsContext || '无'}`
          }
        ];

        const reasoningResponse = await callMinimax(
          effectiveConfig.minimaxApiUrl,
          effectiveConfig.minimaxApiKey,
          effectiveConfig.minimaxModel,
          reasoningMessages,
          0.5
        );

        // 解析预测结果
        let prediction: PredictionResult;
        const predParseResult = safeParseJson(reasoningResponse);
        
        if (predParseResult.success && predParseResult.data) {
          const parsed = predParseResult.data as PredictionResult;
          prediction = {
            summary: parsed.summary || '分析完成',
            probability: typeof parsed.probability === 'number' ? parsed.probability : 50,
            confidence: parsed.confidence || 'medium',
            keyFactors: Array.isArray(parsed.keyFactors) ? parsed.keyFactors : ['因素分析中'],
            timeline: parsed.timeline,
            scenarios: Array.isArray(parsed.scenarios) ? parsed.scenarios : [],
            turningPoints: Array.isArray(parsed.turningPoints) ? parsed.turningPoints : [],
            assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions : [],
            risks: Array.isArray(parsed.risks) ? parsed.risks : [],
            uncertainties: Array.isArray(parsed.uncertainties) ? parsed.uncertainties : []
          };
        } else {
          prediction = {
            summary: reasoningResponse.slice(0, 300) || '预测分析完成',
            probability: 50,
            confidence: 'low',
            keyFactors: ['因果因素分析'],
            assumptions: ['基于有限信息'],
            risks: ['存在不确定性'],
            scenarios: [],
            turningPoints: [],
            uncertainties: []
          };
        }

        sendEvent({ type: 'result', data: prediction });
        sendEvent({ type: 'reasoning', data: '✅ 预测分析完成' });

        controller.close();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        sendEvent({ type: 'error', data: { message: errorMessage } });
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
