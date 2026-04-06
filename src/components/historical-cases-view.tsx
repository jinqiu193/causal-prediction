'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { HistoricalCase } from '@/lib/types';
import { History, Calendar, Target, Lightbulb } from 'lucide-react';

interface HistoricalCasesViewProps {
  cases: HistoricalCase[];
}

function getSimilarityColor(similarity: number): string {
  if (similarity >= 70) return 'text-emerald-400';
  if (similarity >= 50) return 'text-yellow-400';
  return 'text-slate-400';
}

export default function HistoricalCasesView({ cases }: HistoricalCasesViewProps) {
  if (!cases || cases.length === 0) {
    return null;
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm text-slate-100">
          <History className="h-4 w-4 text-amber-400" />
          历史相似案例
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {cases.map((caseItem, index) => (
          <div
            key={caseItem.id || index}
            className="p-3 bg-slate-900/50 border border-slate-700/50 rounded-lg hover:border-amber-500/30 transition-all"
          >
            {/* 标题和相似度 */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-xs text-slate-500">{caseItem.year}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className={`text-sm font-bold ${getSimilarityColor(caseItem.similarity)}`}>
                  {caseItem.similarity}%
                </span>
                <span className="text-xs text-slate-500">相似</span>
              </div>
            </div>

            {/* 案例标题 */}
            <h4 className="font-medium text-sm text-white mb-1.5">{caseItem.title}</h4>

            {/* 摘要 */}
            <p className="text-xs text-slate-400 mb-2 line-clamp-2">{caseItem.summary}</p>

            {/* 实际结果 */}
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded mb-2">
              <div className="flex items-center gap-1 mb-1">
                <Target className="h-3 w-3 text-emerald-400" />
                <span className="text-xs font-medium text-emerald-400">实际结果</span>
              </div>
              <p className="text-xs text-slate-300">{caseItem.outcome}</p>
            </div>

            {/* 关键因素 */}
            {caseItem.keyFactors && caseItem.keyFactors.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {caseItem.keyFactors.map((factor, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="text-[10px] border-slate-600 text-slate-400"
                  >
                    {factor}
                  </Badge>
                ))}
              </div>
            )}

            {/* 经验教训 */}
            {caseItem.lessons && caseItem.lessons.length > 0 && (
              <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded">
                <div className="flex items-center gap-1 mb-1">
                  <Lightbulb className="h-3 w-3 text-amber-400" />
                  <span className="text-xs font-medium text-amber-400">经验教训</span>
                </div>
                <ul className="text-xs text-slate-300 space-y-0.5">
                  {caseItem.lessons.slice(0, 3).map((lesson, i) => (
                    <li key={i}>• {lesson}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}

        {/* 提示 */}
        <div className="text-center text-xs text-slate-500 pt-1">
          历史案例仅供参考，实际情况可能有所不同
        </div>
      </CardContent>
    </Card>
  );
}
