'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { SensitivityAnalysis } from '@/lib/types';
import { TrendingUp, TrendingDown, Target } from 'lucide-react';

interface SensitivityViewProps {
  analysis: SensitivityAnalysis;
  onNodeClick?: (nodeId: string) => void;
}

function getImpactColor(impact: number): string {
  if (impact >= 25) return 'text-red-400';
  if (impact >= 15) return 'text-orange-400';
  if (impact >= 10) return 'text-yellow-400';
  return 'text-slate-400';
}

function getImpactBg(impact: number): string {
  if (impact >= 25) return 'bg-red-500';
  if (impact >= 15) return 'bg-orange-500';
  if (impact >= 10) return 'bg-yellow-500';
  return 'bg-slate-500';
}

export default function SensitivityView({ analysis, onNodeClick }: SensitivityViewProps) {
  return (
    <Card className="bg-slate-800/50 border-slate-700/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm text-slate-100">
          <Target className="h-4 w-4 text-cyan-400" />
          敏感性分析
          <Badge variant="outline" className="ml-auto text-xs border-slate-600">
            基准概率: {analysis.baseProbability}%
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 影响因素列表 */}
        <div className="space-y-2">
          {analysis.factors.map((factor, index) => (
            <div
              key={factor.nodeId}
              className={`p-3 rounded-lg bg-slate-900/50 border border-slate-700/50 transition-all ${
                onNodeClick ? 'cursor-pointer hover:bg-slate-800/50 hover:border-cyan-500/30' : ''
              }`}
              onClick={() => onNodeClick?.(factor.nodeId)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 w-4">{index + 1}</span>
                  <span className="font-medium text-sm text-white">{factor.nodeLabel}</span>
                  {factor.direction === 'positive' ? (
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                  )}
                </div>
                <span className={`text-sm font-bold ${getImpactColor(factor.impact)}`}>
                  {factor.impact}%
                </span>
              </div>
              
              <div className="flex items-center gap-2 mb-1.5">
                <Progress 
                  value={factor.impact} 
                  className={`h-1.5 bg-slate-700 [&>div]:${getImpactBg(factor.impact)}`}
                />
              </div>
              
              <p className="text-xs text-slate-400">{factor.description}</p>
            </div>
          ))}
        </div>

        {/* 分析结论 */}
        {analysis.analysis && (
          <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
            <p className="text-xs text-cyan-300">{analysis.analysis}</p>
          </div>
        )}

        {/* 图例说明 */}
        <div className="flex items-center justify-center gap-4 pt-2 text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-emerald-400" />
            <span>正向促进</span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingDown className="h-3 w-3 text-red-400" />
            <span>负向抑制</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
