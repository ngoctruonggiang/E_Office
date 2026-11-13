'use client';

import React from 'react';
import { AlertTriangle, Check, Layers, Loader2, X } from 'lucide-react';
import type { ProcedureVersionDetail } from '../../types/procedure';

interface PublishConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isPublishing: boolean;
  versionDetail: ProcedureVersionDetail;
}

export function PublishConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isPublishing,
  versionDetail,
}: PublishConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-lg">
                Xác nhận Xuất bản Thủ tục
              </h3>
              <p className="text-xs text-slate-500">
                Phiên bản {versionDetail.version} sẽ trở thành phiên bản hiệu lực chính thức
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isPublishing}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary Card */}
        <div className="p-5 space-y-4">
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Thủ tục:</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {versionDetail.procedure?.name} ({versionDetail.procedure?.code})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Biểu mẫu gắn kèm:</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {versionDetail.formVersion?.form?.name || 'Biểu mẫu'} (v{versionDetail.formVersion?.version})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Quy trình Operaton:</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {versionDetail.operatonDefinitionKey} (v{versionDetail.operatonDefinitionVersion})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Số bước duyệt:</span>
              <span className="font-semibold text-primary">
                {versionDetail.actorMappings.length} bước
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Số biến rẽ nhánh đã map:</span>
              <span className="font-semibold text-emerald-600">
                {versionDetail.variableMappings.length} biến
              </span>
            </div>
          </div>

          {/* Notice Alert */}
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <p className="font-medium">Chính sách Bất biến (Version Pinning - ADR-005):</p>
              <p className="mt-0.5 text-slate-600 dark:text-slate-400">
                Sau khi phát hành, cấu hình của phiên bản này sẽ được khóa cứng và không thể sửa đổi trực tiếp.
                Mọi yêu cầu tạo mới sẽ sử dụng phiên bản này.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPublishing}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPublishing}
            className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition flex items-center gap-2"
          >
            {isPublishing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang xuất bản...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Xác nhận Xuất bản</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

