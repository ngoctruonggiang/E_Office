'use client';

import React, { useEffect, useRef, useState } from 'react';
import BpmnNavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';

interface BpmnFlowViewerProps {
  xml?: string | null;
  activeTaskKeys?: string[];
  bypassedTaskKeys?: string[];
  completedTaskKeys?: string[];
  activeFlowIds?: string[];
  bypassedFlowIds?: string[];
  mode?: 'preview' | 'live';
  className?: string;
  onTaskClick?: (taskKey: string) => void;
}

export function BpmnFlowViewer({
  xml,
  activeTaskKeys = [],
  bypassedTaskKeys = [],
  completedTaskKeys = [],
  activeFlowIds = [],
  bypassedFlowIds = [],
  mode = 'preview',
  className = '',
  onTaskClick,
}: BpmnFlowViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || !xml) return;

    let viewer: any = null;
    let canceled = false;
    setLoading(true);
    setError(null);

    // Clean container in case of remount
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }

    try {
      viewer = new BpmnNavigatedViewer({
        container: containerRef.current,
      });
      viewerRef.current = viewer;

      viewer
        .importXML(xml)
        .then(() => {
          if (canceled) return;
          setLoading(false);
          setError(null);

          try {
            const canvas = viewer.get('canvas');
            canvas?.zoom('fit-viewport');

            // Apply highlights to elements
            const eventBus = viewer.get('eventBus');

            // Register click handler
            if (onTaskClick) {
              eventBus.on('element.click', (event: any) => {
                if (canceled) return;
                const element = event.element;
                if (element && element.type === 'bpmn:UserTask') {
                  onTaskClick(element.id);
                }
              });
            }

            // 1. Highlight completed tasks (Live mode)
            for (const taskKey of completedTaskKeys) {
              canvas.addMarker(taskKey, 'bpmn-node-completed');
            }

            // 2. Highlight active / current tasks
            for (const taskKey of activeTaskKeys) {
              if (mode === 'live') {
                canvas.addMarker(taskKey, 'bpmn-node-current');
              } else {
                canvas.addMarker(taskKey, 'bpmn-node-predicted-active');
              }
            }

            // 3. Highlight bypassed tasks
            for (const taskKey of bypassedTaskKeys) {
              canvas.addMarker(taskKey, 'bpmn-node-bypassed');
            }

            // 4. Highlight flows
            for (const flowId of activeFlowIds) {
              canvas.addMarker(flowId, 'bpmn-flow-active');
            }
            for (const flowId of bypassedFlowIds) {
              canvas.addMarker(flowId, 'bpmn-flow-bypassed');
            }
          } catch {
            // ignore canvas errors during fast unmount
          }
        })
        .catch((err: any) => {
          if (canceled) return;
          const errMsg = err?.message || String(err);
          if (errMsg.includes('root-0') || errMsg.includes('destroyed')) {
            return;
          }
          console.error('BPMN Import error:', err);
          setError('Không thể kết xuất sơ đồ quy trình BPMN');
          setLoading(false);
        });
    } catch (err: any) {
      if (canceled) return;
      console.error('BPMN viewer init error:', err);
      setError('Lỗi khởi tạo sơ đồ BPMN');
      setLoading(false);
    }

    return () => {
      canceled = true;
      if (viewer) {
        try {
          viewer.destroy();
        } catch {
          // ignore destroy errors
        }
        viewerRef.current = null;
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [
    xml,
    activeTaskKeys,
    bypassedTaskKeys,
    completedTaskKeys,
    activeFlowIds,
    bypassedFlowIds,
    mode,
    onTaskClick,
  ]);

  const handleZoomIn = () => {
    if (viewerRef.current) {
      viewerRef.current.get('zoomScroll').stepZoom(1);
    }
  };

  const handleZoomOut = () => {
    if (viewerRef.current) {
      viewerRef.current.get('zoomScroll').stepZoom(-1);
    }
  };

  const handleResetZoom = () => {
    if (viewerRef.current) {
      viewerRef.current.get('canvas').zoom('fit-viewport');
    }
  };

  return (
    <div className={`relative w-full h-[400px] border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900/50 overflow-hidden ${className}`}>
      {/* Zoom Toolbar */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-white/90 dark:bg-slate-800/90 backdrop-blur shadow-sm border border-slate-200 dark:border-slate-700 rounded-lg p-1">
        <button
          type="button"
          onClick={handleZoomIn}
          title="Phóng to"
          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          title="Thu nhỏ"
          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleResetZoom}
          title="Vừa màn hình"
          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Legend Badge */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-2 text-xs bg-white/90 dark:bg-slate-800/90 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
        {mode === 'preview' ? (
          <>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-emerald-500 border border-emerald-600" />
              <span className="text-slate-700 dark:text-slate-200">Nhánh dự kiến kích hoạt</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-slate-300 dark:bg-slate-600 border border-dashed border-slate-400" />
              <span className="text-slate-500 dark:text-slate-400">Không thỏa điều kiện (Bỏ qua)</span>
            </span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-emerald-500" />
              <span className="text-slate-700 dark:text-slate-200">Đã hoàn thành</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-amber-500 animate-pulse" />
              <span className="text-slate-700 dark:text-slate-200">Đang chờ xử lý</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-slate-200 dark:bg-slate-700" />
              <span className="text-slate-500 dark:text-slate-400">Chưa đến lượt</span>
            </span>
          </>
        )}
      </div>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-900/60 z-20">
          <Spinner />
          <span className="ml-2 text-sm text-slate-500">Đang tải sơ đồ quy trình...</span>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-rose-500 bg-rose-50/50 dark:bg-rose-950/20 p-4">
          {error}
        </div>
      )}

      <div ref={containerRef} className="w-full h-full" />

      {/* Embedded CSS for BPMN Highlights */}
      <style jsx global>{`
        /* Predicted Active Node */
        .bpmn-node-predicted-active .djs-visual > rect,
        .bpmn-node-predicted-active .djs-visual > circle,
        .bpmn-node-predicted-active .djs-visual > polygon {
          stroke: #10b981 !important;
          stroke-width: 2.5px !important;
          fill: #ecfdf5 !important;
        }

        /* Current Active Node (Live Pulse) */
        .bpmn-node-current .djs-visual > rect,
        .bpmn-node-current .djs-visual > circle,
        .bpmn-node-current .djs-visual > polygon {
          stroke: #f59e0b !important;
          stroke-width: 3px !important;
          fill: #fffbeb !important;
          stroke-dasharray: 4, 2;
          animation: bpmn-dash 1s linear infinite;
        }

        /* Completed Node */
        .bpmn-node-completed .djs-visual > rect,
        .bpmn-node-completed .djs-visual > circle,
        .bpmn-node-completed .djs-visual > polygon {
          stroke: #059669 !important;
          stroke-width: 2.5px !important;
          fill: #d1fae5 !important;
        }

        /* Bypassed / Dimmed Node */
        .bpmn-node-bypassed {
          opacity: 0.3 !important;
        }

        /* Flow paths */
        .bpmn-flow-active .djs-visual > path {
          stroke: #10b981 !important;
          stroke-width: 2.5px !important;
        }
        .bpmn-flow-bypassed .djs-visual > path {
          opacity: 0.25 !important;
          stroke-dasharray: 4, 4 !important;
        }

        @keyframes bpmn-dash {
          to {
            stroke-dashoffset: -12;
          }
        }
      `}</style>
    </div>
  );
}

