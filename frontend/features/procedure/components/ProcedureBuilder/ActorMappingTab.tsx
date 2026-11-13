'use client';

import React, { useEffect, useState } from 'react';
import { Search, Users, X } from 'lucide-react';
import { fetchProcedureDirectory } from '../../api/procedure';
import type { ProcedureActorMapping, UserDirectoryItem } from '../../types/procedure';

interface ActorMappingTabProps {
  workflowTasks: Array<{
    id: string;
    taskKey?: string;
    name: string;
    isMultiInstance?: boolean;
    collectionVariable?: string | null;
  }>;
  mappings: ProcedureActorMapping[];
  onChange: (updatedMappings: ProcedureActorMapping[]) => void;
  isReadOnly?: boolean;
}

export function ActorMappingTab({
  workflowTasks,
  mappings,
  onChange,
  isReadOnly,
}: ActorMappingTabProps) {
  const [users, setUsers] = useState<UserDirectoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activePickerTaskId, setActivePickerTaskId] = useState<string | null>(null);

  // Load directory users
  useEffect(() => {
    let isMounted = true;
    fetchProcedureDirectory()
      .then((res) => {
        if (isMounted) setUsers(res);
      })
      .catch((err) => console.error('Failed to load directory:', err));
    return () => {
      isMounted = false;
    };
  }, []);

  const mappingMap = new Map(mappings.map((m) => [m.taskDefinitionKey, m]));

  const handleUserSelect = (taskKey: string, taskName: string, order: number, user: UserDirectoryItem | null) => {
    const existing = mappingMap.get(taskKey);
    const updated: ProcedureActorMapping = {
      taskDefinitionKey: taskKey,
      taskName: existing?.taskName || taskName,
      order: existing?.order ?? order,
      assigneeType: 'DIRECT_USER',
      defaultUserId: user?.id || null,
      defaultUser: user
        ? {
            id: user.id,
            displayName: user.displayName,
            email: user.email,
            department: user.department,
            title: user.title,
            role: user.role,
            isActive: user.isActive,
          }
        : null,
      allowOverride: existing?.allowOverride !== undefined ? existing.allowOverride : true,
      required: existing?.required !== undefined ? existing.required : true,
      isMultiInstance: existing?.isMultiInstance || false,
      collectionVariable: existing?.collectionVariable || null,
    };

    const newMappings = mappings.filter((m) => m.taskDefinitionKey !== taskKey);
    newMappings.push(updated);
    newMappings.sort((a, b) => a.order - b.order);
    onChange(newMappings);
    setActivePickerTaskId(null);
  };

  const handleToggleOverride = (taskKey: string, allowOverride: boolean) => {
    const existing = mappingMap.get(taskKey);
    if (!existing) return;
    onChange(
      mappings.map((m) =>
        m.taskDefinitionKey === taskKey ? { ...m, allowOverride } : m,
      ),
    );
  };

  const handleToggleRequired = (taskKey: string, required: boolean) => {
    const existing = mappingMap.get(taskKey);
    if (!existing) return;
    onChange(
      mappings.map((m) =>
        m.taskDefinitionKey === taskKey ? { ...m, required } : m,
      ),
    );
  };

  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.displayName?.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.department?.toLowerCase().includes(q) ||
      u.title?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Informational Banner */}
      <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-xl flex items-start gap-3">
        <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
          <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
            Cấu hình Người duyệt & Quyền Override Từng bước (Actor Assignment)
          </p>
          <p>
            Mỗi bước duyệt được gán cho một nhân sự mặc định kèm thông tin <strong>Phòng ban & Chức danh</strong>.
            Cờ <strong>Cho phép sửa</strong> (allowOverride) giúp người trình đơn có thể linh hoạt thay đổi người duyệt khi nộp đơn mà không làm hỏng quy trình.
          </p>
        </div>
      </div>

      {workflowTasks.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-400">
          Chưa chọn quy trình BPMN hoặc quy trình không có bước phê duyệt người dùng (UserTask).
        </div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-visible shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 w-12 text-center">STT</th>
                <th className="py-3 px-4 min-w-[200px]">Bước duyệt (BPMN Task)</th>
                <th className="py-3 px-4 min-w-[280px]">Người duyệt mặc định</th>
                <th className="py-3 px-4 w-36 text-center">Cho phép sửa?</th>
                <th className="py-3 px-4 w-32 text-center">Bắt buộc?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {workflowTasks.map((task, idx) => {
                const taskKey = task.taskKey || task.id;
                const map = mappingMap.get(taskKey);
                const assignedUser = map?.defaultUser;
                const isPickerOpen = activePickerTaskId === taskKey;

                return (
                  <tr key={taskKey} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                    <td className="py-3.5 px-4 text-center font-semibold text-slate-400">
                      {idx + 1}
                    </td>

                    <td className="py-3.5 px-4">
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-100 block">
                          {task.name || taskKey}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-[10px] text-slate-400">
                            Key: {taskKey}
                          </span>
                          {task.isMultiInstance && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] bg-purple-50 text-purple-600 font-semibold">
                              Hội đồng
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 relative">
                      {assignedUser ? (
                        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs">
                              {assignedUser.displayName?.charAt(0) || assignedUser.email.charAt(0)}
                            </div>
                            <div>
                              <div className="font-medium text-slate-800 dark:text-slate-200 text-xs">
                                {assignedUser.displayName || assignedUser.email}
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                                <span>{assignedUser.department || 'Chưa gán phòng'}</span>
                                {assignedUser.title && (
                                  <>
                                    <span>•</span>
                                    <span className="text-primary font-medium">{assignedUser.title}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() => handleUserSelect(taskKey, task.name, idx + 1, null)}
                              className="p-1 text-slate-400 hover:text-red-500 rounded transition"
                              title="Bỏ gán"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <div>
                          <button
                            type="button"
                            disabled={isReadOnly}
                            onClick={() => {
                              setActivePickerTaskId(isPickerOpen ? null : taskKey);
                              setSearchQuery('');
                            }}
                            className="w-full px-3 py-1.5 text-xs text-left text-slate-400 border border-dashed border-slate-300 dark:border-slate-700 hover:border-primary hover:text-primary rounded-lg flex items-center justify-between transition"
                          >
                            <span>+ Chọn người duyệt...</span>
                            <Search className="w-3.5 h-3.5" />
                          </button>

                          {/* Autocomplete Dropdown */}
                          {isPickerOpen && (
                            <div className="absolute left-4 right-4 mt-1 z-30 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-2 space-y-2 animate-in fade-in zoom-in-95 duration-100 max-h-64 flex flex-col">
                              <div className="relative">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                                <input
                                  type="text"
                                  autoFocus
                                  value={searchQuery}
                                  onChange={(e) => setSearchQuery(e.target.value)}
                                  placeholder="Tìm theo tên, email, chức danh..."
                                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-primary"
                                />
                              </div>

                              <div className="overflow-y-auto space-y-1 flex-1">
                                {filteredUsers.map((u) => (
                                  <div
                                    key={u.id}
                                    onClick={() => handleUserSelect(taskKey, task.name, idx + 1, u)}
                                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-between text-left transition"
                                  >
                                    <div>
                                      <p className="font-semibold text-slate-800 dark:text-slate-100 text-xs">
                                        {u.displayName || u.email}
                                      </p>
                                      <p className="text-[11px] text-slate-400">
                                        {u.department || 'N/A'} {u.title ? `• ${u.title}` : ''}
                                      </p>
                                    </div>
                                    <span className="text-[10px] text-slate-400">{u.email}</span>
                                  </div>
                                ))}
                                {filteredUsers.length === 0 && (
                                  <p className="text-center py-4 text-xs text-slate-400">
                                    Không tìm thấy nhân sự phù hợp
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Allow Override Toggle */}
                    <td className="py-3.5 px-4 text-center">
                      <label className="inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          disabled={isReadOnly}
                          checked={map?.allowOverride !== false}
                          onChange={(e) => handleToggleOverride(taskKey, e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </td>

                    {/* Required Toggle */}
                    <td className="py-3.5 px-4 text-center">
                      <label className="inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          disabled={isReadOnly}
                          checked={map?.required !== false}
                          onChange={(e) => handleToggleRequired(taskKey, e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
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
