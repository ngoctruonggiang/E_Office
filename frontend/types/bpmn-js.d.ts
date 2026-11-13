declare module 'bpmn-js/lib/Modeler' {
  export default class BpmnModeler {
    constructor(options?: any);
    importXML(xml: string): Promise<{ warnings: any[] }>;
    saveXML(options?: { format?: boolean }): Promise<{ xml?: string; error?: any }>;
    saveSVG(options?: any): Promise<{ svg?: string; error?: any }>;
    destroy(): void;
    get(moduleName: string): any;
    on(event: string, callback: (e: any) => void): void;
    off(event: string, callback?: (e: any) => void): void;
  }
}

declare module 'bpmn-js/lib/NavigatedViewer' {
  export default class BpmnNavigatedViewer {
    constructor(options?: any);
    importXML(xml: string): Promise<{ warnings: any[] }>;
    destroy(): void;
    get(moduleName: string): any;
  }
}

