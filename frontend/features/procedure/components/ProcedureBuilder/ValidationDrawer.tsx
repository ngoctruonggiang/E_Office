'use client';

import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, X } from 'lucide-react';
import type { ValidationResult } from '../../types/procedure';

interface ValidationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  result: ValidationResult | null;
  onSelectTab?: (tabIndex: number) => void;
}

export function ValidationDrawer({
  isOpen,
  onClose,
  result,
  onSelectTab,
}: ValidationDrawerProps) {
  if (!isOpen || !result) return null;

  const hasErrors = result.errors && result.errors.length > 0;
  const hasWarnings = result.warnings && result.warnings.length > 0;

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex max-w-full pl-10">
      <div className="w-screen max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-xl flex flex-col">
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            {hasErrors ? (
              <AlertCircle className="w-5 h-5 text-red-500" />
            ) : hasWarnings ? (
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            ) : (
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            )}
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">
              Kết quả Thẩm định Thủ tục
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {result.isValid && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                  Cấu hình hoàn toàn hợp lệ!
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                  Mọi bước duyệt, biến rẽ nhánh và người duyệt mặc định đã được thiết lập đầy đủ. Bạn có thể bấm &quot;Xuất bản&quot; ngay.
                </p>
              </div>
            </div>
          )}

          {/* Errors Section */}
          {hasErrors && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-semibold text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>Lỗi chặn xuất bản ({result.errors.length})</span>
              </div>
              <div className="space-y-2">
                {result.errors.map((err, idx) => {
                  const isActorErr = err.field.startsWith('actorMappings');
                  const isVarErr = err.field.startsWith('variableMappings');
                  const targetTab = isActorErr ? 3 : isVarErr ? 2 : 1;

                  return (
                    <div
                      key={idx}
                      onClick={() => onSelectTab?.(targetTab)}
                      className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 rounded-lg cursor-pointer hover:bg-red-100/70 transition text-left"
                    >
                      <div className="flex items-center justify-between text-xs font-semibold text-red-700 dark:text-red-400">
                        <span>{err.code}</span>
                        <span className="text-[11px] underline">Sửa tại Tab {targetTab + 1} &rarr;</span>
                      </div>
                      <p className="text-xs text-red-800 dark:text-red-300 mt-1">
                        {err.message}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Warnings Section */}
          {hasWarnings && (
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>Cảnh báo khuyến nghị ({result.warnings.length})</span>
              </div>
              <div className="space-y-2">
                {result.warnings.map((warn, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-lg text-xs text-amber-800 dark:text-amber-300"
                  >
                    <span className="font-semibold block">{warn.code}</span>
                    <span className="mt-1 block">{warn.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-md transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

