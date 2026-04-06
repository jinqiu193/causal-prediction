'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { PredictionResult, ScenarioPrediction, TurningPoint, Uncertainty } from '@/lib/types';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Lightbulb, 
  ShieldAlert, 
  TrendingUp,
  GitBranch,
  Zap,
  HelpCircle
} from 'lucide-react';

interface PredictionResultProps {
  result: PredictionResult;
}

function getConfidenceStyles(confidence: string): { bg: string; text: string } {
  switch (confidence) {
    case 'high':
      return { bg: 'bg-emerald-500/20', text: 'text-emerald-400' };
    case 'medium':
      return { bg: 'bg-amber-500/20', text: 'text-amber-400' };
    case 'low':
      return { bg: 'bg-red-500/20', text: 'text-red-400' };
    default:
      return { bg: 'bg-slate-500/20', text: 'text-slate-400' };
  }
}

function getProbabilityColor(probability: number): string {
  if (probability >= 70) return 'text-emerald-400';
  if (probability >= 40) return 'text-amber-400';
  return 'text-red-400';
}

function getImpactBadge(impact: string) {
  switch (impact) {
    case 'high':
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30 text-xs">高影响</Badge>;
    case 'medium':
      return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30 text-xs">中影响</Badge>;
    case 'low':
      return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30 hover:bg-slate-500/30 text-xs">低影响</Badge>;
    default:
      return null;
  }
}

// 情景卡片组件
function ScenarioCard({ scenario, index }: { scenario: ScenarioPrediction; index: number }) {
  const styles = [
    { bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-400', badge: 'bg-emerald-500/20' },
    { bg: 'bg-blue-500/10 border-blue-500/30', text: 'text-blue-400', badge: 'bg-blue-500/20' },
    { bg: 'bg-orange-500/10 border-orange-500/30', text: 'text-orange-400', badge: 'bg-orange-500/20' }
  ];
  const style = styles[index % 3];
  
  return (
    <div className={`p-3 rounded-lg border ${style.bg}`}>
      <div className="flex items-center justify-between mb-2">
        <h4 className={`font-medium text-sm ${style.text}`}>
          {scenario.name}
        </h4>
        <span className={`text-sm font-bold px-2 py-0.5 rounded ${style.badge} ${style.text}`}>
          {scenario.probability}%
        </span>
      </div>
      <p className="text-xs text-slate-400 mb-2">{scenario.description}</p>
      {scenario.triggers && scenario.triggers.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {scenario.triggers.map((trigger, i) => (
            <Badge key={i} variant="outline" className="text-[10px] border-slate-600 text-slate-400">
              {trigger}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// 转折点组件
function TurningPointItem({ point }: { point: TurningPoint }) {
  return (
    <div className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 transition-colors">
      <div className="mt-0.5 p-1.5 bg-amber-500/20 rounded-lg">
        <Zap className="h-3.5 w-3.5 text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm text-slate-200">{point.event}</span>
          {getImpactBadge(point.impact)}
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>概率: <strong className="text-slate-400">{point.probability}%</strong></span>
          <span>时间: <span className="text-slate-400">{point.timeframe}</span></span>
        </div>
      </div>
    </div>
  );
}

// 不确定性组件
function UncertaintyItem({ item }: { item: Uncertainty }) {
  return (
    <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
      <div className="flex items-start gap-2 mb-2">
        <HelpCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
        <div>
          <h4 className="font-medium text-sm text-amber-400">{item.factor}</h4>
          <p className="text-xs text-slate-400 mt-1">{item.impact}</p>
        </div>
      </div>
      {item.mitigationStrategy && (
        <p className="text-xs text-slate-500 pl-6 mt-1">
          💡 {item.mitigationStrategy}
        </p>
      )}
    </div>
  );
}

export default function PredictionResultView({ result }: PredictionResultProps) {
  const confidenceStyles = getConfidenceStyles(result.confidence);

  return (
    <div className="space-y-4">
      {/* 主要结论 */}
      <Card className="bg-slate-800/50 border-slate-700/50 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-cyan-500/5 pointer-events-none"></div>
        <CardHeader className="pb-3 relative">
          <CardTitle className="flex items-center gap-2 text-base text-slate-100">
            <div className="p-1.5 bg-gradient-to-br from-violet-500 to-cyan-500 rounded-lg">
              <TrendingUp className="h-4 w-4 text-white" />
            </div>
            预测结论
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 relative">
          {/* 概率展示 */}
          <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700/50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-400 text-sm">发生概率</span>
              <div className="flex items-center gap-3">
                <Progress 
                  value={result.probability} 
                  className="w-24 h-2 bg-slate-700"
                />
                <span className={`text-3xl font-bold ${getProbabilityColor(result.probability)}`}>
                  {result.probability}%
                </span>
              </div>
            </div>
            
            {/* 置信度 */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">置信度</span>
              <Badge className={`${confidenceStyles.bg} ${confidenceStyles.text} border-0`}>
                {result.confidence === 'high' ? '高置信度' : result.confidence === 'medium' ? '中等置信度' : '低置信度'}
              </Badge>
            </div>
          </div>

          {/* 总结 */}
          <div className="p-4 bg-slate-900/30 rounded-xl border border-slate-700/30">
            <p className="text-sm text-slate-300 leading-relaxed">{result.summary}</p>
          </div>

          {/* 时间线 */}
          {result.timeline && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Clock className="h-4 w-4" />
              <span>预计时间：</span>
              <span className="text-slate-300">{result.timeline}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 多情景预测 */}
      {result.scenarios && result.scenarios.length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm text-slate-100">
              <GitBranch className="h-4 w-4 text-purple-400" />
              多情景预测
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {result.scenarios.map((scenario, index) => (
                <ScenarioCard key={index} scenario={scenario} index={index} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 关键转折点 */}
      {result.turningPoints && result.turningPoints.length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm text-slate-100">
              <Zap className="h-4 w-4 text-amber-400" />
              关键转折点
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {result.turningPoints.map((point, index) => (
                <TurningPointItem key={index} point={point} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 关键因素 */}
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm text-slate-100">
            <Lightbulb className="h-4 w-4 text-yellow-400" />
            关键影响因素
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {result.keyFactors.map((factor, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                <span className="text-slate-300">{factor}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* 不确定性因素 */}
      {result.uncertainties && result.uncertainties.length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm text-slate-100">
              <HelpCircle className="h-4 w-4 text-amber-400" />
              不确定性分析
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {result.uncertainties.map((item, index) => (
                <UncertaintyItem key={index} item={item} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 假设条件与风险 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm text-slate-100">
              <ShieldAlert className="h-4 w-4 text-blue-400" />
              假设条件
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {result.assumptions.map((assumption, index) => (
                <li key={index} className="text-sm text-slate-400 flex items-start gap-2">
                  <span className="text-blue-400">•</span>
                  {assumption}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm text-slate-100">
              <AlertTriangle className="h-4 w-4 text-orange-400" />
              风险因素
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {result.risks.map((risk, index) => (
                <li key={index} className="text-sm text-slate-400 flex items-start gap-2">
                  <span className="text-orange-400">•</span>
                  {risk}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
