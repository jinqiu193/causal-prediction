'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Settings, Save, RotateCcw } from 'lucide-react';

interface ApiConfig {
  // LLM
  minimaxApiKey: string;
  minimaxApiUrl: string;
  minimaxModel: string;
  // Search
  tavilyApiKey: string;
  tavilyApiUrl: string;
}

const DEFAULT_CONFIG: ApiConfig = {
  minimaxApiKey: '',
  minimaxApiUrl: 'https://api.minimaxi.com/anthropic/v1/messages',
  minimaxModel: 'MiniMax-M2.7',
  tavilyApiKey: '',
  tavilyApiUrl: 'https://api.tavily.com/search',
};

const STORAGE_KEY = 'causal-predict-config';

function loadConfig(): ApiConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
    }
  } catch {
    // ignore
  }
  return DEFAULT_CONFIG;
}

function saveConfig(config: ApiConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function resetConfig() {
  localStorage.removeItem(STORAGE_KEY);
}

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (config: ApiConfig) => void;
}

export default function SettingsDialog({ open, onClose, onSave }: SettingsDialogProps) {
  const [config, setConfig] = useState<ApiConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    if (open) {
      setConfig(loadConfig());
    }
  }, [open]);

  const handleSave = () => {
    saveConfig(config);
    onSave(config);
    onClose();
  };

  const handleReset = () => {
    setConfig(DEFAULT_CONFIG);
    resetConfig();
    onSave(DEFAULT_CONFIG);
    onClose();
  };

  const update = (key: keyof ApiConfig, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-100">
            <Settings className="h-5 w-5 text-cyan-400" />
            API 配置
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* LLM 配置 */}
          <div className="space-y-4">
            <div className="text-sm font-medium text-cyan-400 border-b border-slate-700 pb-1">
              大模型 (LLM)
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="minimaxApiKey" className="text-slate-300 text-xs">API Key</Label>
                <Input
                  id="minimaxApiKey"
                  type="password"
                  value={config.minimaxApiKey}
                  onChange={(e) => update('minimaxApiKey', e.target.value)}
                  placeholder="sk-..."
                  className="bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="minimaxApiUrl" className="text-slate-300 text-xs">接口地址</Label>
                <Input
                  id="minimaxApiUrl"
                  value={config.minimaxApiUrl}
                  onChange={(e) => update('minimaxApiUrl', e.target.value)}
                  placeholder="https://api.minimaxi.com/anthropic/v1/messages"
                  className="bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="minimaxModel" className="text-slate-300 text-xs">模型 ID</Label>
                <Input
                  id="minimaxModel"
                  value={config.minimaxModel}
                  onChange={(e) => update('minimaxModel', e.target.value)}
                  placeholder="MiniMax-M2.7"
                  className="bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500 text-sm"
                />
              </div>
            </div>
          </div>

          {/* 搜索配置 */}
          <div className="space-y-4">
            <div className="text-sm font-medium text-violet-400 border-b border-slate-700 pb-1">
              搜索 (Tavily)
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="tavilyApiKey" className="text-slate-300 text-xs">API Key</Label>
                <Input
                  id="tavilyApiKey"
                  type="password"
                  value={config.tavilyApiKey}
                  onChange={(e) => update('tavilyApiKey', e.target.value)}
                  placeholder="tvly-..."
                  className="bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tavilyApiUrl" className="text-slate-300 text-xs">接口地址</Label>
                <Input
                  id="tavilyApiUrl"
                  value={config.tavilyApiUrl}
                  onChange={(e) => update('tavilyApiUrl', e.target.value)}
                  placeholder="https://api.tavily.com/search"
                  className="bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500 text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            className="bg-transparent border-slate-600 text-slate-400 hover:bg-slate-800 hover:text-slate-300"
          >
            <RotateCcw className="h-4 w-4 mr-1.5" />
            重置
          </Button>
          <Button
            onClick={handleSave}
            className="bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-600 hover:to-cyan-600 text-white"
          >
            <Save className="h-4 w-4 mr-1.5" />
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type { ApiConfig };
