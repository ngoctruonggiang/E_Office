'use client';

import React, { useEffect, useState } from 'react';
import {
  Search,
  Users,
  X,
  Settings2,
  ChevronDown,
  ChevronUp,
  User,
  Zap,
  Building2,
  Briefcase,
  AlertTriangle,
  Play,
  CheckCircle2,
} from 'lucide-react';
import { fetchProcedureDirectory, fetchOrgTitles, testResolveActors } from '../../api/procedure';
import type {
  ProcedureActorMapping,
  UserDirectoryItem,
  DynamicActorRuleType,
  DynamicActorFallbackStrategy,
  DynamicActorRuleConfig,
} from '../../types/procedure';

interface ActorMappingTabProps {
  versionId?: string;
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
  versionId,
  workflowTasks,
  mappings,
  onChange,
  isReadOnly,
}: ActorMappingTabProps) {
  const [users, setUsers] = useState<UserDirectoryItem[]>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [titles, setTitles] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activePickerTaskId, setActivePickerTaskId] = useState<string | null>(null);
  const [activeConfigTaskId, setActiveConfigTaskId] = useState<string | null>(null);

  // Test resolution state
  const [isTestingResolve, setIsTestingResolve] = useState(false);
  const [testResults, setTestResults] = useState<Array<{
    taskDefinitionKey: string;
    taskName: string;
    assigneeType: string;
    userId: string | null;
    userName?: string;
    resolutionOrigin: string;
    fallbackApplied: boolean;
    warning?: string;
  }> | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // Load directory users, departments, and titles
  useEffect(() => {
    let isMounted = true;
    fetchProcedureDirectory()
      .then((res) => {
        if (isMounted) setUsers(res);
      })
      .catch((err) => console.error('Failed to load directory:', err));

    fetchOrgTitles()
      .then((res) => {
        if (isMounted) {
          setDepartments(res.departments || []);
          setTitles(res.titles || []);
        }
      })
      .catch((err) => console.error('Failed to load org titles:', err));

    return () => {
      isMounted = false;
    };
  }, []);

  const mappingMap = new Map(mappings.map((m) => [m.taskDefinitionKey, m]));

  const getOrCreateMapping = (taskKey: string, taskName: string, order: number): ProcedureActorMapping => {
    const existing = mappingMap.get(taskKey);
    if (existing) return existing;
    return {
      taskDefinitionKey: taskKey,
      taskName,
      order,
      assigneeType: 'DIRECT_USER',
      defaultUserId: null,
      defaultUser: null,
      ruleConfig: null,
      allowOverride: true,
      required: true,
    };
  };

  const updateMapping = (taskKey: string, updated: Partial<ProcedureActorMapping>, defaultName?: string, defaultOrder?: number) => {
    const current = getOrCreateMapping(taskKey, defaultName || taskKey, defaultOrder || 1);
    const merged: ProcedureActorMapping = {
      ...current,
      ...updated,
    };
    const newMappings = mappings.filter((m) => m.taskDefinitionKey !== taskKey);
    newMappings.push(merged);
    newMappings.sort((a, b) => a.order - b.order);
    onChange(newMappings);
  };

  const handleSelectDirectUser = (taskKey: string, taskName: string, order: number, user: UserDirectoryItem | null) => {
    updateMapping(
      taskKey,
      {
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
        ruleConfig: null,
      },
      taskName,
      order,
    );
    setActivePickerTaskId(null);
  };

  const handleSetAssigneeType = (taskKey: string, type: 'DIRECT_USER' | 'DYNAMIC_RULE', taskName: string, order: number) => {
    const existing = getOrCreateMapping(taskKey, taskName, order);
    if (type === 'DYNAMIC_RULE') {
      const defaultRule: DynamicActorRuleConfig = (existing.ruleConfig as DynamicActorRuleConfig) || {
        ruleType: 'DIRECT_MANAGER',
        fallbackStrategy: 'PARENT_MANAGER',
      };
      updateMapping(
        taskKey,
        {
          assigneeType: 'DYNAMIC_RULE',
          ruleConfig: defaultRule,
        },
        taskName,
        order,
      );
    } else {
      updateMapping(
        taskKey,
        {
          assigneeType: 'DIRECT_USER',
        },
        taskName,
        order,
      );
    }
  };

  const handleUpdateRuleConfig = (taskKey: string, partialConfig: Partial<DynamicActorRuleConfig>) => {
    const existing = mappingMap.get(taskKey);
    const currentConfig = (existing?.ruleConfig as DynamicActorRuleConfig) || {
      ruleType: 'DIRECT_MANAGER',
      fallbackStrategy: 'PARENT_MANAGER',
    };
    const newConfig: DynamicActorRuleConfig = {
      ...currentConfig,
      ...partialConfig,
    };
    updateMapping(taskKey, { ruleConfig: newConfig });
  };

  const handleRunTestResolve = async () => {
    if (!versionId) return;
    setIsTestingResolve(true);
    setTestError(null);
    try {
      const res = await testResolveActors(versionId);
      setTestResults(res.resolvedActors);
    } catch (err: any) {
      setTestError(err.message || 'Lỗi kiểm tra phân giải');
    } finally {
      setIsTestingResolve(false);
    }
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
      <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-xl flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
            <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
              Cấu hình Người duyệt & Quyền Override Từng bước (Actor Assignment)
            </p>
            <p>
              Hỗ trợ <strong>Chỉ định đích danh</strong> hoặc <strong>Quy tắc động</strong> (Trưởng phòng trực tiếp, Chức danh theo phòng ban).
              Cờ <strong>Cho phép sửa</strong> (allowOverride) giúp người trình đơn có thể linh hoạt thay đổi người duyệt khi nộp đơn.
            </p>
          </div>
        </div>

        {versionId && (
          <button
            type="button"
            onClick={handleRunTestResolve}
            disabled={isTestingResolve}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-900/40 hover:bg-emerald-200/70 rounded-lg transition"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isTestingResolve ? 'Đang phân giải...' : 'Thử nghiệm phân giải'}</span>
          </button>
        )}
      </div>

      {/* Test Resolution Preview Result */}
      {testError && (
        <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{testError}</span>
        </div>
      )}

      {testResults && (
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Kết quả thử nghiệm phân giải theo tài khoản của bạn:
            </span>
            <button
              type="button"
              onClick={() => setTestResults(null)}
              className="text-slate-400 hover:text-slate-600 text-xs"
            >
              Đóng
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {testResults.map((r) => (
              <div
                key={r.taskDefinitionKey}
                className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs space-y-1"
              >
                <div className="font-medium text-slate-800 dark:text-slate-100 flex items-center justify-between">
                  <span>{r.taskName}</span>
                  {r.fallbackApplied && (
                    <span className="px-1.5 py-0.5 text-[9px] bg-amber-100 text-amber-700 rounded font-semibold">
                      Fallback
                    </span>
                  )}
                </div>
                <div className="text-slate-600 dark:text-slate-300 font-semibold">
                  {r.userName || r.userId || 'Chưa tìm thấy người'}
                </div>
                <div className="text-[10px] text-slate-400">
                  {r.resolutionOrigin}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                <th className="py-3 px-4 min-w-[180px]">Bước duyệt (BPMN Task)</th>
                <th className="py-3 px-4 min-w-[320px]">Chỉ định người duyệt</th>
                <th className="py-3 px-4 w-32 text-center">Cho phép sửa?</th>
                <th className="py-3 px-4 w-28 text-center">Bắt buộc?</th>
                <th className="py-3 px-4 w-16 text-center">Cấu hình</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {workflowTasks.map((task, idx) => {
                const taskKey = task.taskKey || task.id;
                const map = getOrCreateMapping(taskKey, task.name, idx + 1);
                const assignedUser = map?.defaultUser;
                const isDynamic = map.assigneeType === 'DYNAMIC_RULE';
                const ruleConfig = (map.ruleConfig as DynamicActorRuleConfig) || null;
                const isPickerOpen = activePickerTaskId === taskKey;
                const isConfigOpen = activeConfigTaskId === taskKey;

                return (
                  <React.Fragment key={taskKey}>
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
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
                        {isDynamic ? (
                          /* Dynamic Rule Summary Badge */
                          <div
                            onClick={() => !isReadOnly && setActiveConfigTaskId(isConfigOpen ? null : taskKey)}
                            className="cursor-pointer group flex items-center justify-between p-2 rounded-lg border transition-colors bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800/50 hover:border-purple-400"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 flex items-center justify-center shrink-0">
                                <Zap className="w-3.5 h-3.5" />
                              </div>
                              <div>
                                <div className="font-semibold text-purple-900 dark:text-purple-200 text-xs flex items-center gap-1.5">
                                  <span>
                                    {ruleConfig?.ruleType === 'DIRECT_MANAGER' && 'Trưởng phòng trực tiếp'}
                                    {ruleConfig?.ruleType === 'DEPARTMENT_TITLE' &&
                                      `${ruleConfig.title || 'Chức danh'} • ${ruleConfig.departmentName || 'Phòng ban'}`}
                                    {ruleConfig?.ruleType === 'REQUESTOR_DEPT_TITLE' &&
                                      `${ruleConfig.title || 'Chức danh'} (Cùng phòng)`}
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.2 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 rounded font-normal">
                                    Quy tắc động
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  Dự phòng:{' '}
                                  {ruleConfig?.fallbackStrategy === 'PARENT_MANAGER' && 'Quản lý cấp trên'}
                                  {ruleConfig?.fallbackStrategy === 'SPECIFIC_USER' &&
                                    `User: ${ruleConfig.fallbackUserName || ruleConfig.fallbackUserId || 'Chưa chọn'}`}
                                  {ruleConfig?.fallbackStrategy === 'BLOCK_SUBMISSION' && 'Chặn nộp đơn'}
                                </div>
                              </div>
                            </div>
                            {!isReadOnly && (
                              <button
                                type="button"
                                className="p-1 text-slate-400 group-hover:text-purple-600 transition"
                                title="Chỉnh sửa quy tắc"
                              >
                                <Settings2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ) : assignedUser ? (
                          /* Direct User Assigned Card */
                          <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-xs">
                                {assignedUser.displayName?.charAt(0) || assignedUser.email.charAt(0)}
                              </div>
                              <div>
                                <div className="font-medium text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
                                  <span>{assignedUser.displayName || assignedUser.email}</span>
                                  <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-700 rounded font-normal">
                                    Đích danh
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                                  <span>{assignedUser.department || 'Chưa gán phòng'}</span>
                                  {assignedUser.title && (
                                    <>
                                      <span>•</span>
                                      <span className="text-emerald-600 font-medium">{assignedUser.title}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            {!isReadOnly && (
                              <button
                                type="button"
                                onClick={() => handleSelectDirectUser(taskKey, task.name, idx + 1, null)}
                                className="p-1 text-slate-400 hover:text-red-500 rounded transition"
                                title="Bỏ gán"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ) : (
                          /* Direct User Not Assigned Button */
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
                              <span>+ Chọn người duyệt đích danh...</span>
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
                                      onClick={() => handleSelectDirectUser(taskKey, task.name, idx + 1, u)}
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
                            onChange={(e) =>
                              updateMapping(taskKey, { allowOverride: e.target.checked }, task.name, idx + 1)
                            }
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
                            onChange={(e) =>
                              updateMapping(taskKey, { required: e.target.checked }, task.name, idx + 1)
                            }
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                      </td>

                      {/* Config Expand Button */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          disabled={isReadOnly}
                          onClick={() => setActiveConfigTaskId(isConfigOpen ? null : taskKey)}
                          className={`p-1.5 rounded-lg border transition ${
                            isConfigOpen
                              ? 'bg-primary text-white border-primary'
                              : 'text-slate-500 border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800'
                          }`}
                          title="Mở cấu hình nâng cao"
                        >
                          {isConfigOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <Settings2 className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                    </tr>

                    {/* Expandable Configuration Card */}
                    {isConfigOpen && (
                      <tr className="bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800">
                        <td colSpan={6} className="p-4">
                          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm space-y-4">
                            {/* Mode Segmented Switch */}
                            <div className="flex items-center gap-3">
                              <span className="font-semibold text-slate-700 dark:text-slate-200 text-xs">
                                Phương thức gán:
                              </span>
                              <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800">
                                <button
                                  type="button"
                                  onClick={() => handleSetAssigneeType(taskKey, 'DIRECT_USER', task.name, idx + 1)}
                                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition ${
                                    !isDynamic
                                      ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
                                      : 'text-slate-500 hover:text-slate-700'
                                  }`}
                                >
                                  <User className="w-3 h-3" />
                                  <span>Chỉ định đích danh User</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSetAssigneeType(taskKey, 'DYNAMIC_RULE', task.name, idx + 1)}
                                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition ${
                                    isDynamic
                                      ? 'bg-purple-600 text-white shadow-sm'
                                      : 'text-slate-500 hover:text-slate-700'
                                  }`}
                                >
                                  <Zap className="w-3 h-3" />
                                  <span>Quy tắc động (Phòng ban / Chức danh)</span>
                                </button>
                              </div>
                            </div>

                            {/* Dynamic Rule Form */}
                            {isDynamic && (
                              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {/* Rule Type Selector */}
                                  <div>
                                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                      Loại quy tắc động
                                    </label>
                                    <select
                                      value={ruleConfig?.ruleType || 'DIRECT_MANAGER'}
                                      onChange={(e) =>
                                        handleUpdateRuleConfig(taskKey, {
                                          ruleType: e.target.value as DynamicActorRuleType,
                                        })
                                      }
                                      className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-primary"
                                    >
                                      <option value="DIRECT_MANAGER">
                                        Trưởng phòng / Quản lý trực tiếp (DIRECT_MANAGER)
                                      </option>
                                      <option value="DEPARTMENT_TITLE">
                                        Chức danh theo phòng ban xác định (DEPARTMENT_TITLE)
                                      </option>
                                      <option value="REQUESTOR_DEPT_TITLE">
                                        Chức danh cùng phòng người trình (REQUESTOR_DEPT_TITLE)
                                      </option>
                                    </select>
                                  </div>

                                  {/* Fallback Strategy Selector */}
                                  <div>
                                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                      Chiến lược khi khuyết người (Fallback)
                                    </label>
                                    <select
                                      value={ruleConfig?.fallbackStrategy || 'PARENT_MANAGER'}
                                      onChange={(e) =>
                                        handleUpdateRuleConfig(taskKey, {
                                          fallbackStrategy: e.target.value as DynamicActorFallbackStrategy,
                                        })
                                      }
                                      className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-primary"
                                    >
                                      <option value="PARENT_MANAGER">
                                        Tự động chuyển lên Quản lý cấp trên (PARENT_MANAGER)
                                      </option>
                                      <option value="SPECIFIC_USER">
                                        Chuyển cho User chỉ định (SPECIFIC_USER)
                                      </option>
                                      <option value="BLOCK_SUBMISSION">
                                        Báo lỗi và chặn nộp đơn nếu không tìm thấy (BLOCK_SUBMISSION)
                                      </option>
                                    </select>
                                  </div>
                                </div>

                                {/* Conditional Fields for DEPARTMENT_TITLE */}
                                {ruleConfig?.ruleType === 'DEPARTMENT_TITLE' && (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-purple-50/30 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 rounded-lg">
                                    <div>
                                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                                        <Building2 className="w-3.5 h-3.5 text-purple-600" />
                                        <span>Phòng ban phụ trách</span>
                                      </label>
                                      <select
                                        value={ruleConfig.departmentId || ''}
                                        onChange={(e) => {
                                          const selectedDept = departments.find((d) => d.id === e.target.value);
                                          handleUpdateRuleConfig(taskKey, {
                                            departmentId: e.target.value,
                                            departmentName: selectedDept?.name || '',
                                          });
                                        }}
                                        className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-primary"
                                      >
                                        <option value="">-- Chọn phòng ban --</option>
                                        {departments.map((dept) => (
                                          <option key={dept.id} value={dept.id}>
                                            {dept.name}
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    <div>
                                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                                        <Briefcase className="w-3.5 h-3.5 text-purple-600" />
                                        <span>Chức danh nghiệp vụ</span>
                                      </label>
                                      <input
                                        type="text"
                                        list={`titles-list-${taskKey}`}
                                        value={ruleConfig.title || ''}
                                        onChange={(e) =>
                                          handleUpdateRuleConfig(taskKey, { title: e.target.value })
                                        }
                                        placeholder="Ví dụ: Kế toán trưởng, Trưởng phòng..."
                                        className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-primary"
                                      />
                                      <datalist id={`titles-list-${taskKey}`}>
                                        {titles.map((t) => (
                                          <option key={t} value={t} />
                                        ))}
                                      </datalist>
                                    </div>
                                  </div>
                                )}

                                {/* Conditional Fields for REQUESTOR_DEPT_TITLE */}
                                {ruleConfig?.ruleType === 'REQUESTOR_DEPT_TITLE' && (
                                  <div className="p-3 bg-purple-50/30 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 rounded-lg">
                                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                                      <Briefcase className="w-3.5 h-3.5 text-purple-600" />
                                      <span>Chức danh cần tìm trong phòng ban người trình</span>
                                    </label>
                                    <input
                                      type="text"
                                      list={`titles-list-${taskKey}`}
                                      value={ruleConfig.title || ''}
                                      onChange={(e) =>
                                        handleUpdateRuleConfig(taskKey, { title: e.target.value })
                                      }
                                      placeholder="Ví dụ: Phó phòng, Thư ký ban..."
                                      className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-primary"
                                    />
                                    <datalist id={`titles-list-${taskKey}`}>
                                      {titles.map((t) => (
                                        <option key={t} value={t} />
                                      ))}
                                    </datalist>
                                  </div>
                                )}

                                {/* Conditional Fallback User selector */}
                                {ruleConfig?.fallbackStrategy === 'SPECIFIC_USER' && (
                                  <div className="p-3 bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-lg">
                                    <label className="block text-xs font-medium text-amber-800 dark:text-amber-200 mb-1">
                                      Nhân sự dự phòng khi không phân giải được:
                                    </label>
                                    <select
                                      value={ruleConfig.fallbackUserId || ''}
                                      onChange={(e) => {
                                        const fallbackUser = users.find((u) => u.id === e.target.value);
                                        handleUpdateRuleConfig(taskKey, {
                                          fallbackUserId: e.target.value,
                                          fallbackUserName: fallbackUser?.displayName || fallbackUser?.email || '',
                                        });
                                      }}
                                      className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-primary"
                                    >
                                      <option value="">-- Chọn User dự phòng --</option>
                                      {users.map((u) => (
                                        <option key={u.id} value={u.id}>
                                          {u.displayName || u.email} ({u.department || 'N/A'}{' '}
                                          {u.title ? `• ${u.title}` : ''})
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Close button */}
                            <div className="flex justify-end pt-2">
                              <button
                                type="button"
                                onClick={() => setActiveConfigTaskId(null)}
                                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-300 transition"
                              >
                                Đóng cấu hình
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
