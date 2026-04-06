'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import CausalGraphView from '@/components/causal-graph';
import PredictionResultView from '@/components/prediction-result';
import NodeEditDialog from '@/components/node-edit-dialog';
import SensitivityView from '@/components/sensitivity-view';
import HistoricalCasesView from '@/components/historical-cases-view';
import SettingsDialog, { type ApiConfig } from '@/components/settings-dialog';
import KnowledgePanel from '@/components/knowledge-panel';
import type { CausalGraph, PredictionResult, StreamEvent, CausalNode, SensitivityAnalysis, HistoricalCase } from '@/lib/types';
import { 
  Send,
  Loader2,
  Sparkles,
  ChevronUp,
  X,
  Lightbulb,
  Settings,
  GitBranch,
  TrendingUp,
  Activity,
  History,
  BookOpen
} from 'lucide-react';

const EXAMPLE_QUESTIONS = [
  '如果美国对伊朗实施军事打击，会对全球能源格局产生什么影响？',
  '人工智能技术突破会对就业市场产生什么影响？',
  '如果台海局势紧张升级，对全球半导体供应链有何影响？',
  '气候变化加剧会对全球农业产生什么影响？'
];

export default function Home() {
  const [question, setQuestion] = useState('');
  const [customLogic, setCustomLogic] = useState('');
  const [depth, setDepth] = useState<'standard' | 'deep' | 'comprehensive'>('deep');
  const [isLoading, setIsLoading] = useState(false);
  const [reasoningSteps, setReasoningSteps] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [causalGraph, setCausalGraph] = useState<CausalGraph | null>(null);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // 新增状态：节点编辑
  const [editingNode, setEditingNode] = useState<CausalNode | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  
  // 新增状态：敏感性分析
  const [sensitivityAnalysis, setSensitivityAnalysis] = useState<SensitivityAnalysis | null>(null);
  const [isLoadingSensitivity, setIsLoadingSensitivity] = useState(false);
  
  // 新增状态：历史案例
  const [historicalCases, setHistoricalCases] = useState<HistoricalCase[]>([]);
  const [isLoadingHistorical, setIsLoadingHistorical] = useState(false);

  // 设置弹窗
  const [showSettings, setShowSettings] = useState(false);

  // 当前激活的菜单项
  const [activeTab, setActiveTab] = useState<'graph' | 'prediction' | 'sensitivity' | 'history' | 'knowledge'>('graph');
  const [apiConfig, setApiConfig] = useState<ApiConfig>(() => {
    try {
      const stored = localStorage.getItem('causal-predict-config');
      if (stored) return JSON.parse(stored);
    } catch {}
    return {
      minimaxApiKey: '',
      minimaxApiUrl: 'https://api.minimaxi.com/anthropic/v1/messages',
      minimaxModel: 'MiniMax-M2.7',
      tavilyApiKey: '',
      tavilyApiUrl: 'https://api.tavily.com/search',
    };
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if ((causalGraph || prediction) && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [causalGraph, prediction]);

  // 获取敏感性分析
  const fetchSensitivityAnalysis = useCallback(async (graph: CausalGraph) => {
    if (!graph || graph.nodes.length === 0) return;
    
    setIsLoadingSensitivity(true);
    try {
      const response = await fetch('/api/sensitivity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ graph })
      });
      
      if (response.ok) {
        const data = await response.json();
        setSensitivityAnalysis(data);
      }
    } catch {
      // 忽略错误
    } finally {
      setIsLoadingSensitivity(false);
    }
  }, []);

  // 获取历史案例
  const fetchHistoricalCases = useCallback(async (q: string, keywords: string[]) => {
    setIsLoadingHistorical(true);
    try {
      const response = await fetch('/api/historical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, keywords })
      });
      
      if (response.ok) {
        const data = await response.json();
        setHistoricalCases(data.cases || []);
      }
    } catch {
      // 忽略错误
    } finally {
      setIsLoadingHistorical(false);
    }
  }, []);

  const handlePredict = useCallback(async () => {
    if (!question.trim()) return;

    setIsLoading(true);
    setError(null);
    setReasoningSteps([]);
    setProgress(null);
    setCausalGraph(null);
    setPrediction(null);
    setSensitivityAnalysis(null);
    setHistoricalCases([]);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question, 
          customLogic: customLogic || undefined,
          depth,
          apiConfig 
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) throw new Error('请求失败');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应');

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event: StreamEvent = JSON.parse(line.slice(6));

              switch (event.type) {
                case 'reasoning':
                  setReasoningSteps(prev => [...prev, event.data as string]);
                  break;
                case 'progress':
                  setProgress(event.data as { current: number; total: number });
                  break;
                case 'graph':
                  const graph = event.data as CausalGraph;
                  setCausalGraph(graph);
                  // 自动获取敏感性分析
                  fetchSensitivityAnalysis(graph);
                  // 自动获取历史案例
                  const keywords = graph.nodes.flatMap(n => n.keywords || []).slice(0, 5);
                  fetchHistoricalCases(question, keywords);
                  break;
                case 'result':
                  setPrediction(event.data as PredictionResult);
                  break;
                case 'error':
                  setError((event.data as { message: string }).message);
                  break;
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } catch {
      if (!error) {
        setError('请求失败，请重试');
      }
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  }, [question, customLogic, depth, error, fetchSensitivityAnalysis, fetchHistoricalCases]);

  const handleCancel = () => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
  };

  // 节点编辑处理
  const handleNodeClick = (node: CausalNode) => {
    setEditingNode(node);
    setShowEditDialog(true);
  };

  const handleNodeSave = (updatedNode: CausalNode) => {
    if (!causalGraph) return;
    
    const updatedGraph = {
      ...causalGraph,
      nodes: causalGraph.nodes.map(n => 
        n.id === updatedNode.id ? updatedNode : n
      )
    };
    setCausalGraph(updatedGraph);
    
    // 重新计算敏感性分析
    fetchSensitivityAnalysis(updatedGraph);
  };

  const handleNodeDelete = (nodeId: string) => {
    if (!causalGraph) return;
    
    const updatedGraph = {
      ...causalGraph,
      nodes: causalGraph.nodes.filter(n => n.id !== nodeId),
      edges: causalGraph.edges.filter(e => e.source !== nodeId && e.target !== nodeId)
    };
    setCausalGraph(updatedGraph);
    
    // 重新计算敏感性分析
    fetchSensitivityAnalysis(updatedGraph);
  };

  const handleExampleClick = (example: string) => {
    setQuestion(example);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handlePredict();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 pb-48">
      {/* 头部 */}
      <header className="sticky top-0 z-20 border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-cyan-500 blur-lg opacity-50"></div>
                <div className="relative p-2.5 bg-gradient-to-br from-violet-500 to-cyan-500 rounded-xl">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">智能预测系统</h1>
                <p className="text-xs text-slate-400">系统动力学建模 · 多情景推演 · 交互编辑</p>
              </div>
            </div>
            
            {reasoningSteps.length > 0 && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-full border border-slate-700">
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 text-cyan-400 animate-spin" />
                ) : (
                  <div className="h-3.5 w-3.5 rounded-full bg-green-500 animate-pulse" />
                )}
                <span className="text-xs text-slate-300">{reasoningSteps[reasoningSteps.length - 1]}</span>
              </div>
            )}

            <button
              onClick={() => setShowSettings(true)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              title="API 配置"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* 欢迎区域 */}
        {!causalGraph && !prediction && !isLoading && (
          <div className="text-center py-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-full border border-slate-700 mb-6">
              <Lightbulb className="h-4 w-4 text-amber-400" />
              <span className="text-sm text-slate-300">提出预测问题，AI构建因果模型，你可交互编辑</span>
            </div>

            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              探索未来的<span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400">可能性</span>
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto mb-6">
              深度因果建模 + 敏感性分析 + 历史案例参考
            </p>

            {/* 快捷入口 */}
            <div className="grid gap-3 md:grid-cols-2 max-w-3xl mx-auto mb-8">
              {EXAMPLE_QUESTIONS.map((example, index) => (
                <button
                  key={index}
                  onClick={() => handleExampleClick(example)}
                  className="group p-4 text-left bg-slate-800/30 hover:bg-slate-800/60 border border-slate-700/50 hover:border-violet-500/50 rounded-xl transition-all duration-300"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl opacity-50 group-hover:opacity-100 transition-opacity">
                      {['🌍', '🤖', '💻', '🌱'][index]}
                    </span>
                    <p className="text-sm text-slate-300 group-hover:text-white transition-colors">
                      {example}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            {/* 知识库快捷入口 */}
            <div className="max-w-3xl mx-auto">
              <Card className="bg-slate-800/30 border-slate-700/50">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-500/20 rounded-lg">
                        <BookOpen className="h-5 w-5 text-orange-400" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-white">知识库</h3>
                        <p className="text-xs text-slate-400">维护高确定性原则，构建因果图时自动检索</p>
                      </div>
                    </div>
                    <Button
                      onClick={() => setActiveTab('knowledge')}
                      className="bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border-0"
                      size="sm"
                    >
                      管理知识库
                    </Button>
                  </div>
                  <KnowledgePanel />
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* 结果区域 */}
        {(causalGraph || prediction || isLoading) && (
          <div ref={resultsRef}>
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl mb-4">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* 顶部固定菜单 */}
            <div className="sticky top-[73px] z-10 bg-slate-900/90 backdrop-blur-xl border-b border-slate-700/50 -mx-4 px-4 mb-6">
              <nav className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-none">
                <button
                  onClick={() => setActiveTab('graph')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    activeTab === 'graph'
                      ? 'bg-cyan-500/20 text-cyan-400'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <GitBranch className="h-4 w-4" />
                  因果图
                  {causalGraph && (
                    <span className="text-xs opacity-60">{causalGraph.nodes.length}节点</span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('prediction')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    activeTab === 'prediction'
                      ? 'bg-violet-500/20 text-violet-400'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <TrendingUp className="h-4 w-4" />
                  预测结论
                </button>

                <button
                  onClick={() => setActiveTab('sensitivity')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    activeTab === 'sensitivity'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Activity className="h-4 w-4" />
                  敏感性分析
                </button>

                <button
                  onClick={() => setActiveTab('history')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    activeTab === 'history'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <History className="h-4 w-4" />
                  历史案例
                </button>

                <button
                  onClick={() => setActiveTab('knowledge')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    activeTab === 'knowledge'
                      ? 'bg-orange-500/20 text-orange-400'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <BookOpen className="h-4 w-4" />
                  知识库
                </button>
              </nav>
            </div>

            {/* 内容区 */}
            <div>
              {/* 因果图 */}
              {activeTab === 'graph' && (
                <div>
                  {causalGraph ? (
                    <Card className="bg-slate-800/50 border-slate-700/50 overflow-hidden">
                      <div className="p-4 border-b border-slate-700/50 bg-slate-800/30">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-white">深度因果关系图</h3>
                          <div className="flex items-center gap-3 text-xs text-slate-400">
                            <span>{causalGraph.nodes.length} 节点</span>
                            <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                            <span>{causalGraph.edges?.length || 0} 连线</span>
                          </div>
                        </div>
                        {causalGraph.description && (
                          <p className="text-sm text-slate-400 mt-2">{causalGraph.description}</p>
                        )}
                      </div>
                      <CardContent className="p-0">
                        <CausalGraphView graph={causalGraph} onNodeClick={handleNodeClick} />
                      </CardContent>
                    </Card>
                  ) : isLoading ? (
                    <Card className="bg-slate-800/50 border-slate-700/50">
                      <CardContent className="p-4">
                        <Skeleton className="h-[500px] w-full bg-slate-700" />
                      </CardContent>
                    </Card>
                  ) : null}
                </div>
              )}

              {/* 预测结论 */}
              {activeTab === 'prediction' && (
                <div>
                  {prediction ? (
                    <PredictionResultView result={prediction} />
                  ) : (
                    <Card className="bg-slate-800/50 border-slate-700/50">
                      <CardContent className="p-8 text-center text-slate-500">
                        暂无预测结论
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* 敏感性分析 */}
              {activeTab === 'sensitivity' && (
                <div>
                  {isLoadingSensitivity ? (
                    <Card className="bg-slate-800/50 border-slate-700/50">
                      <CardContent className="p-8 flex items-center justify-center gap-3 text-slate-400">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>正在分析关键因素...</span>
                      </CardContent>
                    </Card>
                  ) : sensitivityAnalysis ? (
                    <SensitivityView
                      analysis={sensitivityAnalysis}
                      onNodeClick={(nodeId) => {
                        const node = causalGraph?.nodes.find(n => n.id === nodeId);
                        if (node) handleNodeClick(node);
                      }}
                    />
                  ) : (
                    <Card className="bg-slate-800/50 border-slate-700/50">
                      <CardContent className="p-8 text-center text-slate-500">
                        暂无敏感性分析数据
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* 历史案例 */}
              {activeTab === 'history' && (
                <div>
                  {isLoadingHistorical ? (
                    <Card className="bg-slate-800/50 border-slate-700/50">
                      <CardContent className="p-8 flex items-center justify-center gap-3 text-slate-400">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>正在搜索历史案例...</span>
                      </CardContent>
                    </Card>
                  ) : (
                    <HistoricalCasesView cases={historicalCases} />
                  )}
                </div>
              )}

              {/* 知识库 */}
              {activeTab === 'knowledge' && (
                <div>
                  <Card className="bg-slate-800/50 border-slate-700/50">
                    <CardContent className="p-6">
                      <KnowledgePanel />
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* 悬浮输入框 */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-slate-900 via-slate-900/98 to-transparent pt-8 pb-4">
        <div className="max-w-5xl mx-auto px-4">
          {showAdvanced && (
            <div className="mb-3 p-4 bg-slate-800/80 border border-slate-700 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-300">高级选项</span>
                <button 
                  onClick={() => setShowAdvanced(false)}
                  className="text-slate-500 hover:text-slate-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">推演深度</label>
                  <Select value={depth} onValueChange={(v: typeof depth) => setDepth(v)} disabled={isLoading}>
                    <SelectTrigger className="bg-slate-900 border-slate-600 text-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="standard">标准 (8-12节点)</SelectItem>
                      <SelectItem value="deep">深度 (12-16节点)</SelectItem>
                      <SelectItem value="comprehensive">全面 (15-20节点)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">基准逻辑（可选）</label>
                  <Textarea
                    placeholder="A → B → C..."
                    value={customLogic}
                    onChange={(e) => setCustomLogic(e.target.value)}
                    className="h-9 bg-slate-900 border-slate-600 text-slate-200 placeholder:text-slate-500 resize-none"
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="relative">
            {progress && isLoading && (
              <div className="absolute -top-1 left-0 right-0 h-1 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            )}

            <div className="flex items-end gap-3 p-3 bg-slate-800/90 border border-slate-700/50 rounded-2xl shadow-2xl backdrop-blur-sm">
              <div className="flex-1">
                <Textarea
                  placeholder="输入你想预测的问题..."
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="min-h-[52px] max-h-32 bg-transparent border-0 resize-none text-white placeholder:text-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0 text-base p-2"
                  disabled={isLoading}
                />
              </div>
              
              <div className="flex items-center gap-2 pb-1">
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className={`p-2.5 rounded-xl transition-all ${
                    showAdvanced 
                      ? 'bg-violet-500/20 text-violet-400' 
                      : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700'
                  }`}
                  title="高级选项"
                >
                  <ChevronUp className={`h-5 w-5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                </button>

                {isLoading ? (
                  <Button
                    onClick={handleCancel}
                    variant="outline"
                    className="bg-transparent border-slate-600 text-slate-300 hover:bg-slate-700"
                  >
                    取消
                  </Button>
                ) : (
                  <Button
                    onClick={handlePredict}
                    disabled={!question.trim()}
                    className="bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-600 hover:to-cyan-600 text-white px-5"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    预测
                  </Button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-center gap-4 mt-2 text-xs text-slate-500">
              <span>按 Enter 发送</span>
              <span>深度: {depth === 'standard' ? '标准' : depth === 'deep' ? '深度' : '全面'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 节点编辑弹窗 */}
      <NodeEditDialog
        node={editingNode}
        open={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        onSave={handleNodeSave}
        onDelete={handleNodeDelete}
      />

      {/* 设置弹窗 */}
      <SettingsDialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={(config) => {
          setApiConfig(config);
          localStorage.setItem('causal-predict-config', JSON.stringify(config));
        }}
      />
    </div>
  );
}
