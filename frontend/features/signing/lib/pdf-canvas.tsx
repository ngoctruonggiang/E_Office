"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface OverlayField {
  id: string;
  /** User id of the approver this box belongs to (matches the backend). */
  assigneeId: string;
  page: number;
  x: number; // % of page width (top-left)
  y: number; // % of page height (top-left)
  width: number; // % of page width
  height: number; // % of page height
  color?: string;
  label?: string;
  /** When signed, the stamped signature image + name are rendered inside the box. */
  signed?: boolean;
  signatureImage?: string;
  signatureName?: string;
}

export interface FieldRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PdfCanvasProps {
  /** Raw PDF bytes (from an uploaded File or a download). */
  data: ArrayBuffer;
  page: number;
  onPageCount?: (count: number) => void;
  fields?: OverlayField[];
  /** When set, clicking the page places a field of this size and calls onPlace. */
  onPlace?: (coords: FieldRect) => void;
  placeSize?: { width: number; height: number };
  placeColor?: string;
  /** Enables drag / resize / remove on existing fields. */
  editable?: boolean;
  onFieldMove?: (id: string, coords: { x: number; y: number }) => void;
  onFieldResize?: (id: string, coords: FieldRect) => void;
  onFieldRemove?: (id: string) => void;
  activeFieldId?: string | null;
  onFieldSelect?: (id: string) => void;
}

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

const MIN_WIDTH_PX = 36;
const MIN_HEIGHT_PX = 12;

type Corner = "nw" | "ne" | "sw" | "se";

export function PdfCanvas({
  data,
  page,
  onPageCount,
  fields = [],
  onPlace,
  placeSize = { width: 22, height: 8 },
  placeColor = "#6366f1",
  editable = false,
  onFieldMove,
  onFieldResize,
  onFieldRemove,
  activeFieldId,
  onFieldSelect,
}: PdfCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      setRendering(true);
      setError(null);
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).href;

        // Copy bytes — pdf.js detaches the buffer it reads from.
        const bytes = new Uint8Array(data.slice(0));
        const pdf = await pdfjs.getDocument({ data: bytes }).promise;
        if (cancelled) return;
        onPageCount?.(pdf.numPages);

        const pageObj = await pdf.getPage(Math.min(page, pdf.numPages));
        if (cancelled) return;

        const containerWidth = wrapRef.current?.clientWidth ?? 700;
        const baseViewport = pageObj.getViewport({ scale: 1 });
        const scale = containerWidth / baseViewport.width;
        const viewport = pageObj.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await pageObj.render({ canvas, canvasContext: ctx, viewport }).promise;
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to render PDF");
      } finally {
        if (!cancelled) setRendering(false);
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [data, page, onPageCount]);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!onPlace) return;
    // Only place on empty page area — clicks on an existing box (a child of the
    // overlay) should select/drag it, not drop a new field.
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * 100;
    const py = ((e.clientY - rect.top) / rect.height) * 100;
    onPlace({
      x: clamp(px, 0, 100 - placeSize.width),
      y: clamp(py, 0, 100 - placeSize.height),
      width: placeSize.width,
      height: placeSize.height,
    });
  }

  const pageFields = fields.filter((f) => f.page === page);
  // Placement works in editable mode too (handleClick ignores clicks on boxes).
  const placing = !!onPlace;

  return (
    <div ref={wrapRef} className="relative w-full">
      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="relative inline-block w-full">
        <canvas
          ref={canvasRef}
          className="block w-full rounded border border-slate-200 shadow-sm"
        />
        {/* Overlay: field boxes + (optional) click-to-place */}
        <div
          ref={overlayRef}
          onClick={placing ? handleClick : undefined}
          className={`absolute inset-0 ${placing ? "cursor-crosshair" : ""}`}
        >
          {pageFields.map((f) =>
            editable ? (
              <EditableFieldBox
                key={f.id}
                field={f}
                overlayRef={overlayRef}
                placeColor={placeColor}
                active={activeFieldId === f.id}
                onSelect={() => onFieldSelect?.(f.id)}
                onMove={(c) => onFieldMove?.(f.id, c)}
                onResize={(c) => onFieldResize?.(f.id, c)}
                onRemove={() => onFieldRemove?.(f.id)}
              />
            ) : (
              <StaticFieldBox key={f.id} field={f} placeColor={placeColor} />
            ),
          )}
        </div>
      </div>
      {rendering && (
        <p className="mt-2 text-center text-xs text-slate-400">Rendering…</p>
      )}
    </div>
  );
}

// ── Read-only box (with optional signature stamp) ───────────────────────────
function StaticFieldBox({
  field,
  placeColor,
}: {
  field: OverlayField;
  placeColor: string;
}) {
  const color = field.color ?? placeColor;
  return (
    <div
      className="absolute flex items-center justify-center overflow-hidden rounded border-2 text-[10px] font-medium"
      style={{
        left: `${field.x}%`,
        top: `${field.y}%`,
        width: `${field.width}%`,
        height: `${field.height}%`,
        borderColor: field.signed ? "#16a34a" : color,
        backgroundColor: field.signed ? "transparent" : `${color}22`,
        color,
      }}
    >
      {field.signed && (field.signatureImage || field.signatureName) ? (
        <div className="flex h-full w-full flex-col items-center justify-center overflow-hidden">
          {field.signatureImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={field.signatureImage}
              alt="signature"
              className="min-h-0 w-full flex-1 object-contain"
            />
          )}
          {field.signatureName && (
            <span
              className="w-full shrink-0 truncate text-center leading-none text-green-700"
              style={{
                fontFamily: "cursive",
                fontSize: "clamp(7px, 1.4vw, 13px)",
              }}
            >
              {field.signatureName}
            </span>
          )}
        </div>
      ) : (
        field.label ?? "Signature"
      )}
    </div>
  );
}

// ── Editable box (drag / resize / remove) ───────────────────────────────────
function EditableFieldBox({
  field,
  overlayRef,
  placeColor,
  active,
  onSelect,
  onMove,
  onResize,
  onRemove,
}: {
  field: OverlayField;
  overlayRef: React.RefObject<HTMLDivElement | null>;
  placeColor: string;
  active: boolean;
  onSelect: () => void;
  onMove: (coords: { x: number; y: number }) => void;
  onResize: (coords: FieldRect) => void;
  onRemove: () => void;
}) {
  const color = field.color ?? placeColor;

  const startDrag = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onSelect();
      const rect = overlayRef.current?.getBoundingClientRect();
      if (!rect) return;
      const startX = e.clientX;
      const startY = e.clientY;
      const origX = field.x;
      const origY = field.y;

      const onPointerMove = (ev: PointerEvent) => {
        const dx = ((ev.clientX - startX) / rect.width) * 100;
        const dy = ((ev.clientY - startY) / rect.height) * 100;
        onMove({
          x: clamp(origX + dx, 0, 100 - field.width),
          y: clamp(origY + dy, 0, 100 - field.height),
        });
      };
      const onPointerUp = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [field.x, field.y, field.width, field.height, onMove, onSelect, overlayRef],
  );

  const startResize = useCallback(
    (corner: Corner) => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onSelect();
      const rect = overlayRef.current?.getBoundingClientRect();
      if (!rect) return;
      const minW = (MIN_WIDTH_PX / rect.width) * 100;
      const minH = (MIN_HEIGHT_PX / rect.height) * 100;
      const startX = e.clientX;
      const startY = e.clientY;
      const o = {
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
      };

      const onPointerMove = (ev: PointerEvent) => {
        const dx = ((ev.clientX - startX) / rect.width) * 100;
        const dy = ((ev.clientY - startY) / rect.height) * 100;
        let { x, y, width, height } = o;

        if (corner === "se") {
          width = clamp(o.width + dx, minW, 100 - o.x);
          height = clamp(o.height + dy, minH, 100 - o.y);
        } else if (corner === "sw") {
          width = clamp(o.width - dx, minW, o.x + o.width);
          height = clamp(o.height + dy, minH, 100 - o.y);
          x = o.x + o.width - width;
        } else if (corner === "ne") {
          width = clamp(o.width + dx, minW, 100 - o.x);
          height = clamp(o.height - dy, minH, o.y + o.height);
          y = o.y + o.height - height;
        } else {
          // nw
          width = clamp(o.width - dx, minW, o.x + o.width);
          height = clamp(o.height - dy, minH, o.y + o.height);
          x = o.x + o.width - width;
          y = o.y + o.height - height;
        }
        onResize({ x, y, width, height });
      };
      const onPointerUp = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [
      field.x,
      field.y,
      field.width,
      field.height,
      onResize,
      onSelect,
      overlayRef,
    ],
  );

  const handleClasses: Record<Corner, string> = {
    nw: "-left-1 -top-1 cursor-nwse-resize",
    ne: "-right-1 -top-1 cursor-nesw-resize",
    sw: "-left-1 -bottom-1 cursor-nesw-resize",
    se: "-right-1 -bottom-1 cursor-nwse-resize",
  };

  return (
    <div
      onPointerDown={startDrag}
      className="group absolute flex cursor-move items-center justify-center rounded border-2 text-[10px] font-medium select-none touch-none"
      style={{
        left: `${field.x}%`,
        top: `${field.y}%`,
        width: `${field.width}%`,
        height: `${field.height}%`,
        borderColor: color,
        backgroundColor: `${color}22`,
        color,
        boxShadow: active ? `0 0 0 2px ${color}` : undefined,
        zIndex: active ? 20 : 10,
      }}
    >
      <span className="pointer-events-none truncate px-1">
        {field.label ?? "Signature"}
      </span>

      {/* remove */}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] leading-none text-white opacity-0 shadow group-hover:opacity-100"
        title="Remove field"
        aria-label="Remove field"
      >
        ✕
      </button>

      {/* resize handles */}
      {(Object.keys(handleClasses) as Corner[]).map((corner) => (
        <span
          key={corner}
          onPointerDown={startResize(corner)}
          className={`absolute h-2.5 w-2.5 rounded-full border border-white bg-current opacity-0 group-hover:opacity-100 ${handleClasses[corner]}`}
        />
      ))}
    </div>
  );
}
