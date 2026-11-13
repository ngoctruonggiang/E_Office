'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  WebBpmnModeler,
  fetchOperatonDefinitionXml,
  fetchOperatonDefinitions,
} from '@/features/workflow';
import { Spinner } from '@/components/ui/Spinner';

function WorkflowDesignerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const definitionId = searchParams.get('id');

  const [loading, setLoading] = useState(!!definitionId);
  const [initialXml, setInitialXml] = useState<string | undefined>(undefined);
  const [initialName, setInitialName] = useState<string | undefined>(undefined);
  const [initialKey, setInitialKey] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!definitionId) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    Promise.all([
      fetchOperatonDefinitionXml(definitionId),
      fetchOperatonDefinitions('e-Office', false).catch(() => []),
    ])
      .then(([xmlRes, defs]) => {
        if (!active) return;
        const matchingDef = defs.find((d) => d.id === definitionId);
        setInitialXml(xmlRes.bpmn20Xml);
        if (matchingDef) {
          setInitialName(matchingDef.name || matchingDef.key);
          setInitialKey(matchingDef.key);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Lỗi tải sơ đồ BPMN từ Operaton:', err);
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [definitionId]);

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-50">
        <Spinner size={24} />
        <span className="ml-3 text-sm font-medium text-slate-500">
          Đang tải cấu hình quy trình từ Operaton...
        </span>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] w-full">
      <WebBpmnModeler
        key={definitionId || 'new-workflow'}
        initialXml={initialXml}
        initialWorkflowName={initialName}
        initialProcessKey={initialKey}
        onBack={() => router.push('/workflows')}
        onDeploySuccess={() => {
          setTimeout(() => router.push('/workflows'), 1200);
        }}
      />
    </div>
  );
}

export default function WorkflowDesignerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100vh-3.5rem)] w-full items-center justify-center bg-slate-50">
          <Spinner size={24} />
        </div>
      }
    >
      <WorkflowDesignerContent />
    </Suspense>
  );
}

