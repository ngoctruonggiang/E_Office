'use client';

import React from 'react';
import {
  FileText,
  GitBranch,
  Paperclip,
  CheckCircle2,
  Users,
  ShieldCheck,
} from 'lucide-react';
import type { FlowSimulationResult, RequestActualActorItem } from '../../types/procedure-runtime';

interface ReviewAndSubmitStepProps {
  procedureName?: string;
  procedureCode?: string;
  values: Record<string, any>;
  files: File[];
  signingPdfName?: string;
  simulation: FlowSimulationResult | null;
  actors: RequestActualActorItem[];
}

export function ReviewAndSubmitStep({
  procedureName,
  procedureCode,
  values,
  files,
  signingPdfName,
  simulation,
  actors,
}: ReviewAndSubmitStepProps) {
  const activeActors = actors.filter(
    (a) => !simulation || simulation.activeTaskKeys.includes(a.taskDefinitionKey),
  );

  return (
    <div className="space-y-6">
      {/* Procedure Banner */}
      <div className="p-5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase text-indigo-600 dark:text-indigo-400">
          <GitBranch className="w-4 h-4" /> Thủ tục áp dụng
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
          {procedureName || 'Hồ sơ đề xuất'}
        </h3>
        {procedureCode && (
          <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-mono font-semibold">
            {procedureCode}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Form Values Card */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <FileText className="w-4 h-4 text-slate-500" />
            <span>Dữ liệu khai báo biểu mẫu</span>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-sm">
            {Object.keys(values).length === 0 ? (
              <p className="text-xs text-slate-400 py-2">Chưa có thông tin nhập</p>
            ) : (
              Object.entries(values).map(([key, val]) => (
                <div key={key} className="pt-2 flex justify-between gap-4 text-xs">
                  <span className="font-medium text-slate-600 dark:text-slate-400">{key}:</span>
                  <span className="text-slate-900 dark:text-slate-200 font-semibold text-right break-all">
                    {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Documents Card */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Paperclip className="w-4 h-4 text-slate-500" />
            <span>Tài liệu đính kèm & Chữ ký số</span>
          </div>

          <div className="space-y-2 text-xs">
            {signingPdfName && (
              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-medium text-emerald-800 dark:text-emerald-200 truncate">
                    {signingPdfName}
                  </span>
                </div>
                <span className="text-[10px] font-semibold bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-100 px-2 py-0.5 rounded">
                  Tài liệu ký chính
                </span>
              </div>
            )}

            {files.length === 0 ? (
              <p className="text-xs text-slate-400">Không có tài liệu phụ</p>
            ) : (
              files.map((f, i) => (
                <div key={i} className="flex items-center justify-between py-1 text-slate-600 dark:text-slate-400">
                  <span className="truncate">{f.name}</span>
                  <span className="text-[10px] text-slate-400">
                    {(f.size / 1024).toFixed(0)} KB
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Approvers Sequence Card */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <Users className="w-4 h-4 text-slate-500" />
          <span>Tuyến phê duyệt thực tế ({activeActors.length} bước)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {activeActors.map((actor, idx) => (
            <div
              key={actor.taskDefinitionKey}
              className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40"
            >
              <div className="text-[10px] font-semibold text-slate-400 uppercase">
                Bước {actor.order || idx + 1}: {actor.taskName}
              </div>
              <div className="mt-1 font-semibold text-sm text-slate-800 dark:text-slate-200">
                {actor.userName || actor.userId}
              </div>
              <div className="text-xs text-slate-500">
                {actor.title || actor.department || 'Người duyệt'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-3 p-4 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-800 dark:text-amber-300">
        <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Cam kết thông tin</p>
          <p className="mt-0.5">
            Bằng việc nộp hồ sơ này, bạn xác nhận các thông tin và tài liệu đính kèm là chính xác và hợp lệ theo quy chế hoạt động của doanh nghiệp.
          </p>
        </div>
      </div>
    </div>
  );
}

