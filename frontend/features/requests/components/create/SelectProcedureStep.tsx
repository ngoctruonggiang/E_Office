'use client';

import React, { useEffect, useState } from 'react';
import { Search, GitBranch, ArrowRight, Layers, FileText, CheckCircle2 } from 'lucide-react';
import { fetchProcedures } from '@/features/procedure/api/procedure';
import type { ProcedureListItem } from '@/features/procedure/types/procedure';
import { Spinner } from '@/components/ui/Spinner';
import { SelectFormStep } from './SelectFormStep';

interface SelectProcedureStepProps {
  selectedProcedureId?: string | null;
  selectedFormId?: string | null;
  onSelectProcedure: (procedure: ProcedureListItem) => void;
  onSelectForm: (formId: string) => void;
}

export function SelectProcedureStep({
  selectedProcedureId,
  selectedFormId,
  onSelectProcedure,
  onSelectForm,
}: SelectProcedureStepProps) {
  const [tab, setTab] = useState<'procedure' | 'legacy'>('procedure');
  const [procedures, setProcedures] = useState<ProcedureListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchProcedures({ status: 'PUBLISHED', limit: 50 })
      .then((res) => {
        if (active) {
          setProcedures(res.items || []);
        }
      })
      .catch((err) => {
        console.error('Failed to load procedures:', err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredProcedures = procedures.filter((p) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Mode Switcher Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setTab('procedure')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
            tab === 'procedure'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <GitBranch className="w-4 h-4" />
          Quy trình & Thủ tục Doanh nghiệp (Operaton BPMN)
        </button>
        <button
          type="button"
          onClick={() => setTab('legacy')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            tab === 'legacy'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          Biểu mẫu truyền thống
        </button>
      </div>

      {tab === 'procedure' ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <p className="text-sm text-slate-500">
              Chọn Thủ tục chuẩn để tự động kích hoạt luồng phê duyệt và phân quyền tác nhân.
            </p>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm thủ tục hoặc mã..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {loading ? (
            <div className="py-12 flex justify-center">
              <Spinner />
            </div>
          ) : filteredProcedures.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              <GitBranch className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Chưa có Thủ tục nào được Xuất bản phù hợp
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Vui lòng liên hệ Quản trị viên để cấu hình và xuất bản Thủ tục trong danh mục.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProcedures.map((proc) => {
                const isSelected = proc.id === selectedProcedureId;
                return (
                  <div
                    key={proc.id}
                    onClick={() => onSelectProcedure(proc)}
                    className={`cursor-pointer group flex flex-col justify-between rounded-xl border p-5 transition-all duration-150 ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-sm ring-2 ring-indigo-500'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span
                          className="px-2.5 py-1 text-xs font-semibold rounded-md uppercase"
                          style={{
                            backgroundColor: proc.color ? `${proc.color}20` : '#e0e7ff',
                            color: proc.color || '#4f46e5',
                          }}
                        >
                          {proc.code}
                        </span>
                        {isSelected && (
                          <span className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                            <CheckCircle2 className="w-4 h-4" /> Đã chọn
                          </span>
                        )}
                      </div>

                      <h4 className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {proc.name}
                      </h4>

                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1.5">
                        {proc.description || 'Không có mô tả chi tiết'}
                      </p>
                    </div>

                    <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
                      <span>Phiên bản v{proc.activeVersion?.version || 1}.0</span>
                      <span className="flex items-center gap-1 font-medium text-indigo-600 dark:text-indigo-400 group-hover:translate-x-0.5 transition-transform">
                        Bắt đầu <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <SelectFormStep
          selectedId={selectedFormId ?? null}
          onSelect={onSelectForm}
        />
      )}
    </div>
  );
}

