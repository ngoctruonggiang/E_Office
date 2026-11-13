'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { WebBpmnModeler } from '@/features/workflow';

export default function WorkflowDesignerPage() {
  const router = useRouter();

  return (
    <div className="h-[calc(100vh-3.5rem)] w-full">
      <WebBpmnModeler
        onBack={() => router.push('/workflows')}
        onDeploySuccess={() => {
          setTimeout(() => router.push('/workflows'), 1200);
        }}
      />
    </div>
  );
}

