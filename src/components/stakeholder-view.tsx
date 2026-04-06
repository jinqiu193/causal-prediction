'use client';

import type { StakeholderAnalysis, Stakeholder } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users, TrendingUp, Shield, Zap, ArrowRight } from 'lucide-react';

function StanceBadge({ stance }: { stance: Stakeholder['attributes']['stance'] }) {
  const map = {
    support: { label: '支持', class: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    oppose: { label: '反对', class: 'bg-red-500/20 text-red-400 border-red-500/30' },
    neutral: { label: '中立', class: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
    conditional: { label: '有条件', class: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  };
  const cfg = map[stance] || map.neutral;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${cfg.class}`}>
      {cfg.label}
    </span>
  );
}

function CapabilityBadge({ capability }: { capability: Stakeholder['attributes']['capability'] }) {
  const map = {
    strong: { label: '强', color: 'text-emerald-400', bar: 90 },
    moderate: { label: '中', color: 'text-amber-400', bar: 55 },
    weak: { label: '弱', color: 'text-slate-400', bar: 25 },
  };
  const cfg = map[capability] || map.moderate;
  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
      <Progress value={cfg.bar} className="h-1.5 flex-1" />
    </div>
  );
}

function TypeIcon({ type }: { type: Stakeholder['type'] }) {
  const map: Record<string, { icon: string; label: string }> = {
    government: { icon: 'Gov', label: '政府' },
    corporation: { icon: 'Corp', label: '企业' },
    organization: { icon: 'Org', label: '组织' },
    individual: { icon: 'Ind', label: '个人' },
    bloc: { icon: 'Bloc', label: '集团' },
  };
  const cfg = map[type] || { icon: '?', label: type };
  return (
    <div className="w-9 h-9 rounded-lg bg-violet-500/20 flex items-center justify-center text-xs font-bold text-violet-400 shrink-0">
      {cfg.icon}
    </div>
  );
}

export default function StakeholderView({ analysis }: { analysis: StakeholderAnalysis }) {
  if (!analysis || analysis.stakeholders.length === 0) {
    return (
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardContent className="p-6 text-center text-slate-500">
          暂无利益分析数据
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* 总体格局 */}
      {analysis.summary && (
        <Card className="bg-slate-800/40 border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-cyan-500/20 rounded-lg shrink-0">
                <Users className="h-4 w-4 text-cyan-400" />
              </div>
              <div>
                <h4 className="text-sm font-medium text-slate-200 mb-1">利益格局总览</h4>
                <p className="text-sm text-slate-400 leading-relaxed">{analysis.summary}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 主体列表 */}
      <div className="grid gap-4 md:grid-cols-2">
        {analysis.stakeholders.map((s) => (
          <Card key={s.id} className="bg-slate-800/40 border-slate-700/50 hover:border-slate-600/50 transition-colors">
            <CardContent className="p-4 space-y-3">
              {/* 主体头部 */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <TypeIcon type={s.type} />
                  <div className="min-w-0">
                    <h5 className="font-semibold text-slate-100 text-sm truncate">{s.name}</h5>
                    <p className="text-xs text-slate-500">{s.type}</p>
                  </div>
                </div>
                <StanceBadge stance={s.attributes.stance} />
              </div>

              {/* 描述 */}
              {s.description && (
                <p className="text-xs text-slate-400 leading-relaxed">{s.description}</p>
              )}

              {/* 属性 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Shield className="h-3 w-3" />
                    核心利益
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{s.attributes.interest}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Zap className="h-3 w-3" />
                    行动能力
                  </div>
                  <CapabilityBadge capability={s.attributes.capability} />
                </div>
              </div>

              {s.attributes.resource && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>关键资源：</span>
                  <span className="text-slate-300">{s.attributes.resource}</span>
                </div>
              )}

              {/* 影响力条 */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    影响力
                  </span>
                  <span className="text-cyan-400 font-medium">{s.attributes.influence}/100</span>
                </div>
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 rounded-full transition-all"
                    style={{ width: `${s.attributes.influence}%` }}
                  />
                </div>
              </div>

              {/* 可能行动 */}
              {s.possibleActions.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-slate-500 font-medium flex items-center gap-1">
                    <ArrowRight className="h-3 w-3" />
                    可能措施
                  </div>
                  <div className="space-y-2">
                    {s.possibleActions.map((action, i) => (
                      <div key={i} className="bg-slate-900/50 rounded-lg p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-slate-200 font-medium">{action.action}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              action.impact === 'high' ? 'bg-red-500/20 text-red-400' :
                              action.impact === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                              'bg-slate-500/20 text-slate-400'
                            }`}>
                              {action.impact === 'high' ? '高' : action.impact === 'medium' ? '中' : '低'}影响
                            </span>
                            <span className="text-xs text-slate-500">{action.probability}%</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          {action.timeframe && <span>{action.timeframe}</span>}
                          {action.description && <span className="text-slate-400">{action.description}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
