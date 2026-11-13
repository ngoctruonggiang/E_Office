'use client';

import React, { useEffect, useRef, useState } from 'react';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import { useT } from '@/components/providers/I18nProvider';
import { deployOperatonWorkflow } from '../api/operaton';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Layers,
  Send,
  Upload,
  AlertTriangle,
} from 'lucide-react';

const DEFAULT_STARTER_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
                  targetNamespace="e-Office">
  <bpmn:process id="eoffice_new_workflow" name="Quy trình Mới (e-Office)" isExecutable="true" camunda:historyTimeToLive="180">
    <bpmn:startEvent id="start_event_requestor" name="Người trình nộp yêu cầu">
      <bpmn:outgoing>flow_start_to_step1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:sequenceFlow id="flow_start_to_step1" sourceRef="start_event_requestor" targetRef="step_review_1" />
    <bpmn:userTask id="step_review_1" name="Xem xét 1" camunda:assignee="\${actor_step_review_1}">
      <bpmn:extensionElements>
        <camunda:properties>
          <camunda:property name="allowOverride" value="true" />
        </camunda:properties>
      </bpmn:extensionElements>
      <bpmn:incoming>flow_start_to_step1</bpmn:incoming>
      <bpmn:outgoing>flow_step1_to_end</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:sequenceFlow id="flow_step1_to_end" sourceRef="step_review_1" targetRef="end_approved" />
    <bpmn:endEvent id="end_approved" name="Hoàn thành phê duyệt">
      <bpmn:incoming>flow_step1_to_end</bpmn:incoming>
    </bpmn:endEvent>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="eoffice_new_workflow">
      <bpmndi:BPMNShape id="_BPMNShape_Start" bpmnElement="start_event_requestor">
        <dc:Bounds x="160" y="180" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="_BPMNShape_Task1" bpmnElement="step_review_1">
        <dc:Bounds x="260" y="158" width="120" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="_BPMNShape_End" bpmnElement="end_approved">
        <dc:Bounds x="450" y="180" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Edge_Start_Task" bpmnElement="flow_start_to_step1">
        <di:waypoint x="196" y="198" />
        <di:waypoint x="260" y="198" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_Task_End" bpmnElement="flow_step1_to_end">
        <di:waypoint x="380" y="198" />
        <di:waypoint x="450" y="198" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

interface WebBpmnModelerProps {
  initialXml?: string;
  initialWorkflowName?: string;
  onBack?: () => void;
  onDeploySuccess?: (deploymentId: string) => void;
}

interface DiagramElement {
  id?: string;
  type?: string;
  businessObject?: {
    id?: string;
    name?: string;
    assignee?: string;
    loopCharacteristics?: unknown;
    $attrs?: Record<string, string>;
    extensionElements?: {
      values?: Array<{
        values?: Array<{ name: string; value: string }>;
      }>;
    };
    conditionExpression?: {
      body?: string;
    };
  };
}

export function WebBpmnModeler({
  initialXml,
  initialWorkflowName = 'Quy trình Trình ký (e-Office)',
  onBack,
  onDeploySuccess,
}: WebBpmnModelerProps) {
  const t = useT();
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelerRef = useRef<BpmnModeler | null>(null);

  const [workflowName, setWorkflowName] = useState(initialWorkflowName);
  const [selectedElement, setSelectedElement] = useState<DiagramElement | null>(null);
  const [elementProps, setElementProps] = useState<{
    id: string;
    name: string;
    assignee: string;
    allowOverride: boolean;
    isMultiInstance: boolean;
    conditionExpr: string;
  }>({
    id: '',
    name: '',
    assignee: '',
    allowOverride: true,
    isMultiInstance: false,
    conditionExpr: '',
  });

  const [isDeploying, setIsDeploying] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Initialize BPMN Modeler
  useEffect(() => {
    if (!canvasRef.current) return;

    let canceled = false;

    // Clean container in case of StrictMode or remount
    if (canvasRef.current) {
      canvasRef.current.innerHTML = '';
    }

    const modeler = new BpmnModeler({
      container: canvasRef.current,
    });
    modelerRef.current = modeler;

    const xmlToLoad = initialXml || DEFAULT_STARTER_BPMN;
    modeler
      .importXML(xmlToLoad)
      .then(() => {
        if (canceled) return;
        setFeedback(null);
        try {
          const canvas = modeler.get('canvas');
          canvas?.zoom('fit-viewport');
        } catch {
          // ignore fast unmount zoom errors
        }
      })
      .catch((err: unknown) => {
        if (canceled) return;
        const errMsg = err instanceof Error ? err.message : String(err);
        // Ignore errors caused by React StrictMode unmount / destroy race condition
        if (errMsg.includes('root-0') || errMsg.includes('destroyed')) {
          return;
        }
        setFeedback({
          type: 'error',
          message: `Lỗi tải sơ đồ BPMN: ${errMsg}`,
        });
      });

    // Listen to selection events
    modeler.on('selection.changed', (e: { newSelection?: DiagramElement[] }) => {
      if (canceled) return;
      const element = e.newSelection?.[0];
      setSelectedElement(element || null);
      if (!element || !element.businessObject) return;

      const bo = element.businessObject;
      const type = element.type;

      let assignee = '';
      let allowOverride = true;
      let isMultiInstance = false;
      let conditionExpr = '';

      if (type === 'bpmn:UserTask') {
        assignee = bo.$attrs?.['camunda:assignee'] || bo.assignee || '';
        isMultiInstance = !!bo.loopCharacteristics;
        const ext = bo.extensionElements?.values;
        if (ext) {
          for (const item of ext) {
            if (item.values) {
              const p = item.values.find((val) => val.name === 'allowOverride');
              if (p) allowOverride = p.value === 'true';
            }
          }
        }
      } else if (type === 'bpmn:SequenceFlow') {
        conditionExpr = bo.conditionExpression?.body || '';
      }

      setElementProps({
        id: bo.id || '',
        name: bo.name || '',
        assignee,
        allowOverride,
        isMultiInstance,
        conditionExpr,
      });
    });

    return () => {
      canceled = true;
      try {
        modeler.destroy();
      } catch {
        // ignore destroy error
      }
      modelerRef.current = null;
      if (canvasRef.current) {
        canvasRef.current.innerHTML = '';
      }
    };
  }, [initialXml]);

  // Update properties of the selected element
  const handlePropChange = (field: string, value: string | boolean) => {
    if (!modelerRef.current || !selectedElement) return;
    const modeling = modelerRef.current.get('modeling');

    setElementProps((prev) => ({ ...prev, [field]: value }));

    if (field === 'name') {
      modeling.updateProperties(selectedElement, { name: value });
    } else if (field === 'id') {
      modeling.updateProperties(selectedElement, { id: value });
    } else if (field === 'assignee') {
      modeling.updateProperties(selectedElement, {
        'camunda:assignee': value,
      });
    } else if (field === 'conditionExpr' && typeof value === 'string') {
      const bpmnFactory = modelerRef.current.get('bpmnFactory');
      if (value.trim()) {
        const formalExpression = bpmnFactory.create('bpmn:FormalExpression', {
          body: value,
        });
        modeling.updateProperties(selectedElement, {
          conditionExpression: formalExpression,
        });
      } else {
        modeling.updateProperties(selectedElement, {
          conditionExpression: undefined,
        });
      }
    }
  };

  // Deploy to Operaton
  const handleDeploy = async () => {
    if (!modelerRef.current) return;
    setIsDeploying(true);
    setFeedback(null);

    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      if (!xml) throw new Error('Không thể trích xuất XML từ sơ đồ');

      // Pre-deploy validation
      if (!xml.includes('bpmn:startEvent') && !xml.includes('startEvent')) {
        throw new Error('Sơ đồ quy trình phải có ít nhất 1 Sự kiện Bắt đầu (Start Event)');
      }
      if (!xml.includes('bpmn:userTask') && !xml.includes('userTask')) {
        throw new Error('Sơ đồ quy trình phải có ít nhất 1 Bước Duyệt (User Task)');
      }
      if (!xml.includes('bpmn:endEvent') && !xml.includes('endEvent')) {
        throw new Error('Sơ đồ quy trình phải có ít nhất 1 Sự kiện Kết thúc (End Event)');
      }

      const res = await deployOperatonWorkflow({
        deploymentName: workflowName,
        category: 'e-Office',
        bpmnXml: xml,
      });

      setFeedback({
        type: 'success',
        message: `${t('workflow.modeler.deploySuccess')} (ID: ${res.deploymentId})`,
      });

      if (onDeploySuccess) {
        onDeploySuccess(res.deploymentId);
      }
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : t('workflow.modeler.deployError'),
      });
    } finally {
      setIsDeploying(false);
    }
  };

  // Export XML
  const handleExport = async () => {
    if (!modelerRef.current) return;
    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      if (!xml) return;
      const blob = new Blob([xml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${workflowName.toLowerCase().replace(/\s+/g, '-')}.bpmn`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  // Import XML file
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !modelerRef.current) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const xml = evt.target?.result as string;
      if (xml && modelerRef.current) {
        try {
          await modelerRef.current.importXML(xml);
          const canvas = modelerRef.current.get('canvas');
          canvas.zoom('fit-viewport');
          setFeedback(null);
        } catch (err: unknown) {
          setFeedback({
            type: 'error',
            message: `Lỗi đọc tệp BPMN: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="flex h-full w-full flex-col bg-slate-50">
      {/* Top Header Bar */}
      <div className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-emerald-600" />
            <input
              type="text"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              className="rounded-md border border-transparent px-2 py-1 text-sm font-semibold text-slate-900 hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:outline-none"
              placeholder={t('workflow.modeler.workflowName')}
            />
          </div>
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            {t('workflow.modeler.categoryBadge')}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".bpmn,.xml"
            className="hidden"
            onChange={handleImportFile}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Upload className="h-3.5 w-3.5" />
            {t('workflow.modeler.importXml')}
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" />
            {t('workflow.modeler.exportXml')}
          </button>
          <button
            onClick={handleDeploy}
            disabled={isDeploying}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {isDeploying
              ? t('workflow.modeler.deploying')
              : t('workflow.modeler.deploy')}
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {feedback && (
        <div
          className={`flex items-center gap-2 px-4 py-2 text-xs font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800'
              : 'bg-rose-50 text-rose-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-rose-600" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Main Workspace: Canvas + Inspector */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* BPMN Canvas */}
        <div ref={canvasRef} className="h-full flex-1 bg-white" />

        {/* Right Inspector Panel */}
        <div className="w-80 border-l border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">
            {t('workflow.modeler.inspector.title')}
          </h3>

          {!selectedElement ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
              {t('workflow.modeler.inspector.noSelection')}
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              <div>
                <label className="mb-1 block font-medium text-slate-700">
                  Phần tử:
                </label>
                <span className="inline-block rounded bg-slate-100 px-2 py-0.5 font-mono text-slate-600">
                  {selectedElement.type}
                </span>
              </div>

              <div>
                <label className="mb-1 block font-medium text-slate-700">
                  {t('workflow.modeler.inspector.taskKey')}
                </label>
                <input
                  type="text"
                  value={elementProps.id}
                  onChange={(e) => handlePropChange('id', e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 font-mono text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-slate-700">
                  {t('workflow.modeler.inspector.taskName')}
                </label>
                <input
                  type="text"
                  value={elementProps.name}
                  onChange={(e) => handlePropChange('name', e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {selectedElement.type === 'bpmn:UserTask' && (
                <>
                  <div>
                    <label className="mb-1 block font-medium text-slate-700">
                      {t('workflow.modeler.inspector.assigneeVar')}
                    </label>
                    <input
                      type="text"
                      value={elementProps.assignee}
                      onChange={(e) =>
                        handlePropChange('assignee', e.target.value)
                      }
                      placeholder={`\${actor_${elementProps.id || 'step'}}`}
                      className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 font-mono text-slate-900 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div className="pt-2">
                    <label className="flex items-center gap-2 font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={elementProps.allowOverride}
                        onChange={(e) =>
                          handlePropChange('allowOverride', e.target.checked)
                        }
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>{t('workflow.modeler.inspector.allowOverride')}</span>
                    </label>
                  </div>
                </>
              )}

              {selectedElement.type === 'bpmn:SequenceFlow' && (
                <div>
                  <label className="mb-1 block font-medium text-slate-700">
                    {t('workflow.modeler.inspector.conditionExpr')}
                  </label>
                  <input
                    type="text"
                    value={elementProps.conditionExpr}
                    onChange={(e) =>
                      handlePropChange('conditionExpr', e.target.value)
                    }
                    placeholder={t(
                      'workflow.modeler.inspector.conditionPlaceholder',
                    )}
                    className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 font-mono text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Ví dụ: <code>${'{var_amount >= 50000000}'}</code>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
