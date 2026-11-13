'use client';

import React from 'react';
import { AlertCircle, Variable } from 'lucide-react';
import type { FormFieldSummary, ProcedureVariableMapping } from '../../types/procedure';

interface VariableMappingTabProps {
  conditionVariables: string[];
  formFields: FormFieldSummary[];
  mappings: ProcedureVariableMapping[];
  onChange: (updatedMappings: ProcedureVariableMapping[]) => void;
  isReadOnly?: boolean;
}

export function VariableMappingTab({
  conditionVariables,
  formFields,
  mappings,
  onChange,
  isReadOnly,
}: VariableMappingTabProps) {
  // Ensure every conditionVariable from BPMN has an entry in the list
  const mappingMap = new Map(mappings.map((m) => [m.operatonVarName, m]));
  const allVarNames = Array.from(new Set([...conditionVariables, ...mappings.map((m) => m.operatonVarName)]));

  const handleFieldChange = (varName: string, formFieldKey: string) => {
    const existing = mappingMap.get(varName);
    const selectedField = formFields.find((f) => f.key === formFieldKey);
    let defaultType: 'NUMBER' | 'STRING' | 'BOOLEAN' = 'STRING';
    if (selectedField?.type === 'NUMBER') defaultType = 'NUMBER';

    const updated: ProcedureVariableMapping = {
      operatonVarName: varName,
      formFieldKey,
      variableType: existing?.variableType || defaultType,
      fallbackValue: existing?.fallbackValue || (defaultType === 'NUMBER' ? '0' : ''),
    };

    const newMappings = mappings.filter((m) => m.operatonVarName !== varName);
    if (formFieldKey) newMappings.push(updated);
    onChange(newMappings);
  };

  const handleTypeChange = (varName: string, variableType: 'NUMBER' | 'STRING' | 'BOOLEAN') => {
    const existing = mappingMap.get(varName);
    if (!existing) return;
    const newMappings = mappings.map((m) =>
      m.operatonVarName === varName ? { ...m, variableType } : m,
    );
    onChange(newMappings);
  };

  const handleFallbackChange = (varName: string, fallbackValue: string) => {
    const existing = mappingMap.get(varName);
    if (!existing) return;
    const newMappings = mappings.map((m) =>
      m.operatonVarName === varName ? { ...m, fallbackValue } : m,
    );
    onChange(newMappings);
  };

  return (
    <div className="space-y-4">
      <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-xl flex items-start gap-3">
        <Variable className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
          <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
            Bảng Ánh xạ Tham số Rẽ nhánh (Dynamic Variable Mapping)
          </p>
          <p>
            Các biến điều kiện dưới đây được bóc tách tự động từ các Gateway trong sơ đồ BPMN Operaton.
            Khi người dùng nộp đơn, hệ thống sẽ tự động lấy giá trị từ trường form đã chọn và truyền sang Operaton để rẽ nhánh chuẩn xác.
          </p>
        </div>
      </div>

      {allVarNames.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-400">
          Quy trình BPMN này không sử dụng biến điều kiện rẽ nhánh (hoặc chưa chọn quy trình ở Tab 2).
        </div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Biến trong BPMN</th>
                <th className="py-3 px-4">Trường Form Ánh xạ</th>
                <th className="py-3 px-4">Kiểu Ép kiểu</th>
                <th className="py-3 px-4">Giá trị Dự phòng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {allVarNames.map((varName) => {
                const map = mappingMap.get(varName);
                const isConfigured = !!map?.formFieldKey;

                return (
                  <tr key={varName} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-xs">
                          {varName}
                        </span>
                        {!isConfigured && (
                          <span className="flex items-center gap-1 text-[11px] text-red-500 font-medium">
                            <AlertCircle className="w-3.5 h-3.5" /> Chưa map
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 min-w-[220px]">
                      <select
                        disabled={isReadOnly}
                        value={map?.formFieldKey || ''}
                        onChange={(e) => handleFieldChange(varName, e.target.value)}
                        className={`w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none ${
                          !isConfigured ? 'border-red-300 dark:border-red-800' : 'border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <option value="">-- Chọn trường Form tương ứng --</option>
                        {formFields.map((fld) => (
                          <option key={fld.key} value={fld.key}>
                            {fld.label || fld.key} ({fld.key} — {fld.type})
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="py-3.5 px-4 w-36">
                      <select
                        disabled={isReadOnly || !isConfigured}
                        value={map?.variableType || 'NUMBER'}
                        onChange={(e) => handleTypeChange(varName, e.target.value as 'NUMBER' | 'STRING' | 'BOOLEAN')}
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                      >
                        <option value="NUMBER">SỐ (Float / Int)</option>
                        <option value="STRING">CHUỖI (String)</option>
                        <option value="BOOLEAN">LOGIC (Boolean)</option>
                      </select>
                    </td>

                    <td className="py-3.5 px-4 w-36">
                      <input
                        type="text"
                        disabled={isReadOnly || !isConfigured}
                        value={map?.fallbackValue ?? ''}
                        onChange={(e) => handleFallbackChange(varName, e.target.value)}
                        placeholder="vd: 0"
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-slate-800 dark:text-slate-100"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
