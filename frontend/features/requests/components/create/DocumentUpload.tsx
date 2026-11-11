"use client";

import { useRef } from "react";
import { Paperclip, X, FileText } from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { Button } from "@/components/ui/Button";
import { formatBytes } from "@/lib/utils/format";

/**
 * Stages files locally (not uploaded until the request is created — the upload
 * is then attached to the new request id).
 */
export function DocumentUpload({
  files,
  onChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    onChange([...files, ...Array.from(list)]);
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
      >
        <Paperclip size={15} />
        {t("create.addFiles")}
      </Button>

      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
            >
              <FileText size={16} className="shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(file.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, idx) => idx !== i))}
                title={t("create.removeFile")}
                className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
              >
                <X size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
