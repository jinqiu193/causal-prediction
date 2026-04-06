// 因果图节点类型
export type NodeType = 'event' | 'state' | 'condition' | 'outcome' | 'feedback';

// 因果图节点
export interface CausalNode {
  id: string;
  label: string;
  description?: string;
  keywords?: string[];
  type?: NodeType;
  status?: 'unknown' | 'happened' | 'not_happened' | 'partial';
  newsSummary?: string;
  confidence?: number;
  layer?: number;
  probability?: number;
  // 用户编辑标记
  isUserModified?: boolean;
}

// 因果关系强度
export type EdgeStrength = 'critical' | 'strong' | 'medium' | 'weak' | 'conditional';

// 因果关系类型
export type EdgeType = 'causes' | 'enables' | 'prevents' | 'amplifies' | 'delays' | 'feedback';

// 因果图连线
export interface CausalEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  strength?: EdgeStrength;
  type?: EdgeType;
  delay?: string;
  conditions?: string[];
}

// 因果图结构
export interface CausalGraph {
  nodes: CausalNode[];
  edges: CausalEdge[];
  description?: string;
  scenarios?: Scenario[];
}

// 情景分支
export interface Scenario {
  id: string;
  name: string;
  description: string;
  probability: number;
  path: string[];
}

// 新闻搜索结果
export interface NewsItem {
  title: string;
  url?: string;
  snippet: string;
  publishTime?: string;
  source?: string;
}

// ========== 新增：敏感性分析 ==========

export interface SensitivityFactor {
  nodeId: string;
  nodeLabel: string;
  impact: number; // 0-100 影响权重
  direction: 'positive' | 'negative'; // 正向/负向影响
  description: string;
}

export interface SensitivityAnalysis {
  factors: SensitivityFactor[];
  baseProbability: number;
  analysis: string;
}

// ========== 新增：历史案例 ==========

export interface HistoricalCase {
  id: string;
  title: string;
  summary: string;
  year: number;
  similarity: number; // 0-100 相似度
  outcome: string; // 实际结果
  keyFactors: string[];
  lessons: string[]; // 经验教训
}

// 预测结果
export interface PredictionResult {
  summary: string;
  probability: number;
  confidence: 'high' | 'medium' | 'low';
  keyFactors: string[];
  timeline?: string;
  assumptions: string[];
  risks: string[];
  scenarios?: ScenarioPrediction[];
  turningPoints?: TurningPoint[];
  uncertainties?: Uncertainty[];
  // 新增：敏感性分析
  sensitivityAnalysis?: SensitivityAnalysis;
  // 新增：历史案例
  historicalCases?: HistoricalCase[];
}

// 情景预测
export interface ScenarioPrediction {
  name: string;
  probability: number;
  description: string;
  triggers: string[];
}

// 转折点
export interface TurningPoint {
  event: string;
  probability: number;
  impact: 'high' | 'medium' | 'low';
  timeframe: string;
}

// 不确定性因素
export interface Uncertainty {
  factor: string;
  impact: string;
  mitigationStrategy?: string;
}

// API 请求类型
export interface PredictRequest {
  question: string;
  customLogic?: string;
  depth?: 'standard' | 'deep' | 'comprehensive';
}

// 新增：敏感性分析请求
export interface SensitivityRequest {
  graph: CausalGraph;
  targetNodeId?: string; // 目标节点，默认最后一个
}

// 新增：历史案例请求
export interface HistoricalCasesRequest {
  question: string;
  keywords: string[];
}

// API 响应类型（流式）
export interface StreamEvent {
  type: 'graph' | 'news' | 'reasoning' | 'result' | 'error' | 'progress' | 'sensitivity' | 'historical';
  data: CausalGraph | NewsItem[] | string | PredictionResult | { message: string } | { current: number; total: number } | SensitivityAnalysis | HistoricalCase[];
}

// React Flow 节点类型
export interface FlowNode {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: {
    label: string;
    description?: string;
    status?: CausalNode['status'];
    newsSummary?: string;
    confidence?: number;
    type?: NodeType;
    probability?: number;
  };
}

// React Flow 边类型
export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
  style?: Record<string, string | number>;
  type?: string;
}
