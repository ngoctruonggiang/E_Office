'use client';

import React from 'react';
import { FileText, Layers, ShoppingCart, Tag, Users } from 'lucide-react';

interface GeneralInfoTabProps {
  code: string;
  name: string;
  description: string;
  departmentId: string;
  icon: string;
  color: string;
  onChange: (fields: Partial<{ code: string; name: string; description: string; departmentId: string; icon: string; color: string }>) => void;
  isReadOnly?: boolean;
}

const AVAILABLE_ICONS = [
  { name: 'file-text', icon: FileText, label: 'Văn bản' },
  { name: 'shopping-cart', icon: ShoppingCart, label: 'Mua sắm' },
  { name: 'layers', icon: Layers, label: 'Quy trình' },
  { name: 'users', icon: Users, label: 'Nhân sự' },
  { name: 'tag', icon: Tag, label: 'Danh mục' },
];

const AVAILABLE_COLORS = [
  { value: '#2563eb', label: 'Xanh dương' },
  { value: '#16a34a', label: 'Xanh lá' },
  { value: '#9333ea', label: 'Tím' },
  { value: '#ea580c', label: 'Cam' },
  { value: '#dc2626', label: 'Đỏ' },
  { value: '#0891b2', label: 'Xanh lam' },
];

export function GeneralInfoTab({
  code,
  name,
  description,
  departmentId,
  icon,
  color,
  onChange,
  isReadOnly,
}: GeneralInfoTabProps) {
  return (
    <div className="max-w-3xl space-y-6">
      {/* Code & Name */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
            Mã Thủ tục <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={code}
            disabled={true} // Code is immutable once created
            className="w-full px-3 py-2 text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 font-mono cursor-not-allowed"
          />
          <p className="text-[11px] text-slate-400 mt-1">Mã định danh duy nhất của thủ tục</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
            Tên Thủ tục <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            disabled={isReadOnly}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="vd: Yêu cầu Mua sắm Hàng hóa & Dịch vụ"
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-slate-800 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
          Mô tả & Hướng dẫn Áp dụng
        </label>
        <textarea
          rows={3}
          value={description}
          disabled={isReadOnly}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Mô tả phạm vi áp dụng, tiêu chuẩn và hướng dẫn cho người trình đơn..."
          className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-slate-800 dark:text-slate-100 resize-none"
        />
      </div>

      {/* Department & Visual Identity */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
          Mã Đơn vị / Phòng ban Phụ trách
        </label>
        <input
          type="text"
          value={departmentId}
          disabled={isReadOnly}
          onChange={(e) => onChange({ departmentId: e.target.value })}
          placeholder="vd: dept-procurement-001"
          className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-slate-800 dark:text-slate-100"
        />
      </div>

      {/* Visual Identity: Icon & Color */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-200 dark:border-slate-800">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">
            Biểu tượng nhận diện
          </label>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_ICONS.map((item) => {
              const IconComp = item.icon;
              const isSelected = icon === item.name;
              return (
                <button
                  key={item.name}
                  type="button"
                  disabled={isReadOnly}
                  onClick={() => onChange({ icon: item.name })}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition ${
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <IconComp className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">
            Màu sắc chủ đạo
          </label>
          <div className="flex items-center gap-3">
            {AVAILABLE_COLORS.map((c) => {
              const isSelected = color === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  disabled={isReadOnly}
                  onClick={() => onChange({ color: c.value })}
                  style={{ backgroundColor: c.value }}
                  className={`w-7 h-7 rounded-full transition-transform flex items-center justify-center ${
                    isSelected ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'opacity-80 hover:opacity-100'
                  }`}
                  title={c.label}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
