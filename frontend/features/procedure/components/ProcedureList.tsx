'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FileText,
  GitBranch,
  Layers,
  Loader2,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import {
  createDraftVersion,
  deleteProcedure,
  fetchProcedures,
} from '../api/procedure';
import type { ProcedureListItem } from '../types/procedure';

export function ProcedureList() {
  const router = useRouter();
  const [items, setItems] = useState<ProcedureListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page] = useState(1);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    fetchProcedures({ page, limit: 20, search: search.trim() || undefined })
      .then((res) => {
        if (!isMounted) return;
        setItems(res.items);
        setTotal(res.meta.total);
      })
      .catch((err: unknown) => console.error('Failed to load procedures:', err))
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [page, search, reloadKey]);

  const handleCreateDraft = async (procId: string) => {
    try {
      const draft = await createDraftVersion(procId);
      router.push(`/procedures/${procId}/versions/${draft.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi không xác định';
      alert(`Không thể tạo bản nháp mới: ${msg}`);
    }
  };

  const handleDelete = async (procId: string, procName: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa thủ tục "${procName}" không?`)) return;
    try {
      await deleteProcedure(procId);
      setReloadKey((k) => k + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi không xác định';
      alert(`Lỗi khi xóa: ${msg}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-primary" />
            <span>Danh mục Thủ tục Doanh nghiệp (Procedures)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Kết nối Biểu mẫu động với Quy trình Operaton BPMN chuẩn hóa thẩm quyền phê duyệt
          </p>
        </div>

        <Link
          href="/procedures/new"
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo Thủ tục Mới</span>
        </Link>
      </div>

      {/* ── Filters Bar ── */}
      <div className="flex items-center justify-between gap-4 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo mã hoặc tên thủ tục..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="text-xs text-slate-400">
          Tổng cộng: <strong className="text-slate-700 dark:text-slate-200">{total}</strong> thủ tục
        </div>
      </div>

      {/* ── Procedures Table ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span>Đang tải danh sách thủ tục...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="p-16 text-center text-slate-400 space-y-3">
            <Layers className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 stroke-1" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Chưa có thủ tục nào được tạo
            </p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Hãy bấm &quot;Tạo Thủ tục Mới&quot; để bắt đầu ghép nối Biểu mẫu và Quy trình phê duyệt Operaton.
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Mã & Tên Thủ tục</th>
                <th className="py-3 px-4">Biểu mẫu Gắn kèm</th>
                <th className="py-3 px-4">Luồng Operaton</th>
                <th className="py-3 px-4 text-center">Trạng thái Hiệu lực</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {items.map((proc) => {
                const activeVer = proc.activeVersion;
                const latestDraft = proc.versions?.find((v) => v.status === 'DRAFT');
                const targetVersionId = latestDraft?.id || activeVer?.id || proc.versions[0]?.id;

                return (
                  <tr key={proc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          style={{ backgroundColor: `${proc.color || '#2563eb'}15`, color: proc.color || '#2563eb' }}
                          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-bold"
                        >
                          <Layers className="w-4 h-4" />
                        </div>
                        <div>
                          <Link
                            href={`/procedures/${proc.id}/versions/${targetVersionId}`}
                            className="font-semibold text-slate-800 dark:text-slate-100 hover:text-primary transition"
                          >
                            {proc.name}
                          </Link>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded">
                              {proc.code}
                            </span>
                            {proc.departmentName && (
                              <span className="text-[11px] text-slate-500">
                                • {proc.departmentName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {activeVer?.formName ? (
                        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                          <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span className="font-medium truncate max-w-[180px]">{activeVer.formName}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Chưa gắn form</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {activeVer?.operatonDefinitionKey ? (
                        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                          <GitBranch className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span className="font-mono text-xs truncate max-w-[180px]">
                            {activeVer.operatonDefinitionKey}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Chưa gắn luồng</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {activeVer ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                          Phiên bản {activeVer.version}
                        </span>
                      ) : latestDraft ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                          Nháp v{latestDraft.version}
                        </span>
                      ) : (
                        <span className="text-slate-400">Chưa cấu hình</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {latestDraft ? (
                          <Link
                            href={`/procedures/${proc.id}/versions/${latestDraft.id}`}
                            className="px-2.5 py-1 text-[11px] font-medium bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-md transition"
                          >
                            Sửa nháp v{latestDraft.version}
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleCreateDraft(proc.id)}
                            className="px-2.5 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md transition"
                          >
                            + Bản nháp mới
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDelete(proc.id, proc.name)}
                          className="p-1 text-slate-400 hover:text-red-500 rounded transition"
                          title="Xóa thủ tục"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
