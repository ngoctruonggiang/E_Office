'use client';

import React, { useState } from 'react';
import {
  Lock,
  UserCheck,
  Edit2,
  AlertCircle,
  CheckCircle,
  GitBranch,
  ShieldAlert,
} from 'lucide-react';
import { useModal } from '@/components/providers/ModalProvider';
import { UserPicker } from '@/features/users/components/UserPicker';
import { BpmnFlowViewer } from '../BpmnFlowViewer';
import type {
  FlowSimulationResult,
  RequestActualActorItem,
} from '../../types/procedure-runtime';

interface FlowPreviewAndActorStepProps {
  bpmnXml?: string | null;
  simulation: FlowSimulationResult | null;
  actors: RequestActualActorItem[];
  onUpdateActor: (taskDefinitionKey: string, newUserId: string) => void;
}

export function FlowPreviewAndActorStep({
  bpmnXml,
  simulation,
  actors,
  onUpdateActor,
}: FlowPreviewAndActorStepProps) {
  const { open, close } = useModal();

  const handleOpenPicker = (actor: RequestActualActorItem) => {
    open(
      <UserPicker
        title={`Chọn người duyệt thay thế: ${actor.taskName}`}
        initialSelected={[actor.userId]}
        single={true}
        onConfirm={(userIds) => {
          if (userIds.length > 0) {
            onUpdateActor(actor.taskDefinitionKey, userIds[0]);
          }
          close();
        }}
      />,
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-xl">
        <div className="flex items-center gap-3">
          <GitBranch className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <div className="text-sm">
            <span className="font-semibold text-indigo-900 dark:text-indigo-200">
              Mô phỏng Luồng duyệt & Người ký thực tế
            </span>
            <p className="text-xs text-indigo-700 dark:text-indigo-300">
              Hệ thống đã tự động tính toán nhánh quy trình theo giá trị bạn đã nhập ở biểu mẫu.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: BPMN Diagram (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-2">
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <span>Sơ đồ tiến trình dự kiến</span>
            <span className="text-xs font-normal text-slate-500">
              (Nhánh xanh lá là nhánh sẽ kích hoạt)
            </span>
          </h4>
          <BpmnFlowViewer
            xml={bpmnXml}
            activeTaskKeys={simulation?.activeTaskKeys || []}
            bypassedTaskKeys={simulation?.bypassedTaskKeys || []}
            activeFlowIds={simulation?.activeFlowIds || []}
            bypassedFlowIds={simulation?.bypassedFlowIds || []}
            mode="preview"
            className="h-[480px]"
          />
        </div>

        {/* Right: Actual Approvers List (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Danh sách Người duyệt thực tế
          </h4>

          <div className="space-y-3 overflow-y-auto max-h-[480px] pr-1">
            {actors.map((actor, idx) => {
              const isActive = simulation?.activeTaskKeys.includes(
                actor.taskDefinitionKey,
              );
              const isBypassed = simulation?.bypassedTaskKeys.includes(
                actor.taskDefinitionKey,
              );

              return (
                <div
                  key={actor.taskDefinitionKey}
                  className={`p-4 rounded-xl border transition-all ${
                    isBypassed
                      ? 'border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/40 opacity-60'
                      : isActive
                      ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/30 dark:bg-emerald-950/20 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Bước {actor.order || idx + 1}: {actor.taskName}
                    </span>
                    {isBypassed ? (
                      <span className="px-2 py-0.5 text-[10px] rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">
                        Bỏ qua theo điều kiện
                      </span>
                    ) : isActive ? (
                      <span className="px-2 py-0.5 text-[10px] rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Cần duyệt
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 text-xs shrink-0">
                        {(actor.userName || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {actor.userName || actor.userId}
                          </span>
                          {actor.isOverridden && (
                            <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/50 px-1.5 py-0.5 rounded">
                              Đã sửa
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {actor.title || actor.department || 'Thành viên'}
                        </p>
                      </div>
                    </div>

                    <div>
                      {actor.allowOverride !== false ? (
                        <button
                          type="button"
                          onClick={() => handleOpenPicker(actor)}
                          className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-3 h-3" /> Thay đổi
                        </button>
                      ) : (
                        <span
                          title="Quy trình cố định không cho phép người trình thay đổi người duyệt ở bước này"
                          className="flex items-center gap-1 text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded"
                        >
                          <Lock className="w-3 h-3" /> Cố định
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

