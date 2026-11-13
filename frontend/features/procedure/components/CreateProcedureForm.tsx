'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Layers, Loader2 } from 'lucide-react';
import { createProcedure } from '../api/procedure';

const PRESET_COLORS = ['#2563eb', '#16a34a', '#9333ea', '#ea580c', '#dc2626'];

export function CreateProcedureForm() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon] = useState('file-text');
  const [color, setColor] = useState('#2563eb');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      setError('Vui lòng nhập đầy đủ Mã thủ tục và Tên thủ tục.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await createProcedure({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim() || undefined,
        icon,
        color,
      });

      const draftVersionId = res.draftVersion?.id;
      if (draftVersionId) {
        router.push(`/procedures/${res.id}/versions/${draftVersionId}`);
      } else {
        router.push('/procedures');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tạo mới thủ tục.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/procedures" className="hover:text-primary transition flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Quay lại danh mục</span>
        </Link>
        <span>/</span>
        <span>Tạo thủ tục mới</span>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              Khởi tạo Thủ tục Doanh nghiệp Mới
            </h1>
            <p className="text-xs text-slate-400">
              Bước 1: Thiết lập mã và tên thủ tục. Hệ thống sẽ tự động tạo Bản nháp Version 1 để bạn ghép nối Form và Workflow.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-lg text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
              Mã Thủ tục <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="vd: PROC_PURCHASE_01"
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Chỉ bao gồm chữ in hoa, số, gạch ngang và gạch dưới (không dấu)
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
              Tên Thủ tục <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="vd: Yêu cầu Mua sắm Hàng hóa & Dịch vụ"
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
              Mô tả ngắn gọn
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Quy trình áp dụng cho việc mua sắm trang thiết bị văn phòng, máy móc..."
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
              Màu sắc nhận diện
            </label>
            <div className="flex items-center gap-3">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-6 h-6 rounded-full transition-transform ${
                    color === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'opacity-70 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
            <Link
              href="/procedures"
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
            >
              Hủy
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm transition flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Tiếp tục cấu hình luồng &rarr;</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
