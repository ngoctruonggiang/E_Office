'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  fetchOperatonDefinitions,
  fetchOperatonHealth,
  type OperatonHealthStatus,
  type OperatonProcessDefinitionSummary,
} from '@/features/workflow';
import {
  CheckCircle2,
  GitBranch,
  Layers,
  Plus,
  RefreshCw,
  Server,
  XCircle,
} from 'lucide-react';

export default function WorkflowsListPage() {
  const [health, setHealth] = useState<OperatonHealthStatus | null>(null);
  const [definitions, setDefinitions] = useState<
    OperatonProcessDefinitionSummary[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reloadData = () => {
    setIsLoading(true);
    setError(null);
    Promise.all([
      fetchOperatonHealth().catch((err: unknown) => ({
        status: 'DOWN' as const,
        restEndpoint: '',
        error: err instanceof Error ? err.message : String(err),
      })),
      fetchOperatonDefinitions('e-Office').catch(() => []),
    ])
      .then(([h, defs]) => {
        setHealth(h);
        setDefinitions(defs);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : 'Không thể tải danh sách quy trình',
        );
        setIsLoading(false);
      });
  };

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      fetchOperatonHealth().catch((err: unknown) => ({
        status: 'DOWN' as const,
        restEndpoint: '',
        error: err instanceof Error ? err.message : String(err),
      })),
      fetchOperatonDefinitions('e-Office').catch(() => []),
    ])
      .then(([h, defs]) => {
        if (!isMounted) return;
        setHealth(h);
        setDefinitions(defs);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        setError(
          err instanceof Error ? err.message : 'Không thể tải danh sách quy trình',
        );
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Quản lý Luồng Quy trình (BPMN)
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Các quy trình được điều phối tự động bởi Operaton BPMN Engine cho
            nhóm e-Office.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={reloadData}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
            />
            Làm mới
          </button>
          <Link
            href="/workflows/designer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Thiết kế Luồng mới
          </Link>
        </div>
      </div>

      {/* Engine Status Banner */}
      <div className="mb-6 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <Server className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900">
                Operaton BPMN Engine
              </span>
              {health?.status === 'UP' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" />
                  Đang hoạt động (v{health.engineVersion})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
                  <XCircle className="h-3 w-3" />
                  Mất kết nối
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              REST Endpoint:{' '}
              <code className="font-mono text-slate-600">
                {health?.restEndpoint || 'Chưa cấu hình'}
              </code>
            </p>
          </div>
        </div>

        <div className="text-right text-xs text-slate-500">
          <div>
            Nhóm lọc:{' '}
            <span className="font-semibold text-slate-700">category=e-Office</span>
          </div>
          <div>
            Số quy trình khả dụng:{' '}
            <span className="font-semibold text-emerald-600">
              {definitions.length}
            </span>
          </div>
        </div>
      </div>

      {/* Definitions Table */}
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700">
          {error}
        </div>
      ) : definitions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <Layers className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="mt-3 text-sm font-semibold text-slate-900">
            Chưa có quy trình BPMN nào
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Bấm nút &quot;Thiết kế Luồng mới&quot; để tạo sơ đồ hoặc deploy file BPMN
            vào hệ thống.
          </p>
          <div className="mt-4">
            <Link
              href="/workflows/designer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              Tạo quy trình ngay
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-3">Tên quy trình</th>
                <th className="px-6 py-3">Mã khóa (Key)</th>
                <th className="px-6 py-3">Phiên bản</th>
                <th className="px-6 py-3">Nhóm</th>
                <th className="px-6 py-3">Thời gian lưu vết</th>
                <th className="px-6 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {definitions.map((def) => (
                <tr key={def.id} className="hover:bg-slate-50/70">
                  <td className="px-6 py-4 font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4 text-emerald-600" />
                      <div>
                        <div>{def.name || def.key}</div>
                        {def.description && (
                          <div className="text-xs text-slate-400">
                            {def.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-600">
                    {def.key}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                      v{def.version}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                      {def.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    {def.historyTimeToLive ? `${def.historyTimeToLive} ngày` : '—'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/workflows/designer`}
                      className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
                    >
                      Mở Modeler &rarr;
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
