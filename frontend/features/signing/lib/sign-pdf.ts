"use client";

// Stamps the signature overlay onto a copy of the original PDF, entirely in the
// browser — so the "signed" download is assembled here rather than stored on the
// backend (which keeps only the original file + the overlay/sign state).
//
// Field coordinates are stored as percentages of the page with a top-left
// origin (matching the on-screen overlay); pdf-lib uses a bottom-left origin, so
// the y axis is flipped below.

import { PDFDocument, rgb, type PDFFont, type PDFImage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { OverlayField } from "./pdf-canvas";

// pdf-lib's StandardFonts use WinAnsi, which can't encode Vietnamese diacritics
// (e.g. "ấ"). We embed a Unicode TTF (matching the on-screen cursive signature
// look) via fontkit instead. The bytes are fetched once and cached.
const SIGNATURE_FONT_URL = "/fonts/DancingScript.ttf";
let signatureFontBytes: Promise<ArrayBuffer> | null = null;

function loadSignatureFontBytes(): Promise<ArrayBuffer> {
  if (!signatureFontBytes) {
    signatureFontBytes = fetch(SIGNATURE_FONT_URL).then((r) => {
      if (!r.ok) throw new Error(`Failed to load signature font (${r.status})`);
      return r.arrayBuffer();
    });
  }
  return signatureFontBytes;
}

async function embedDataUrl(
  pdf: PDFDocument,
  dataUrl: string,
): Promise<PDFImage | null> {
  try {
    const isPng = dataUrl.startsWith("data:image/png");
    const bytes = await fetch(dataUrl).then((r) => r.arrayBuffer());
    return isPng ? pdf.embedPng(bytes) : pdf.embedJpg(bytes);
  } catch {
    return null;
  }
}

/**
 * Returns a new PDF (original content untouched) with every *signed* field
 * stamped in place. Unsigned fields are skipped, so the result is partial when
 * some approvers haven't signed yet.
 */
export async function buildSignedPdf(
  original: ArrayBuffer,
  fields: OverlayField[],
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(original);
  pdf.registerFontkit(fontkit);

  // Only embed the (Unicode) font when at least one signed field actually needs
  // to draw a name — keeps the output lean for image-only signatures.
  let font: PDFFont | null = null;
  const ensureFont = async (): Promise<PDFFont> => {
    if (!font) {
      const fontBytes = await loadSignatureFontBytes();
      font = await pdf.embedFont(fontBytes, { subset: true });
    }
    return font;
  };

  const pages = pdf.getPages();

  for (const f of fields) {
    if (!f.signed) continue;
    const page = pages[f.page - 1];
    if (!page) continue;

    const { width: pw, height: ph } = page.getSize();
    const boxX = (f.x / 100) * pw;
    const boxW = (f.width / 100) * pw;
    const boxH = (f.height / 100) * ph;
    // Flip the top-left origin to pdf-lib's bottom-left.
    const boxBottom = ph - (f.y / 100) * ph - boxH;

    const hasName = Boolean(f.signatureName);
    // Reserve the lower strip of the box for the signature name (mirrors the
    // on-screen stamp: image on top, cursive-style name underneath).
    const nameH = hasName ? Math.min(boxH * 0.32, 14) : 0;
    const imgArea = {
      x: boxX,
      y: boxBottom + nameH,
      width: boxW,
      height: boxH - nameH,
    };

    if (f.signatureImage) {
      const img = await embedDataUrl(pdf, f.signatureImage);
      if (img) {
        // Fit within the image area preserving aspect ratio (object-contain).
        const scale = Math.min(
          imgArea.width / img.width,
          imgArea.height / img.height,
        );
        const w = img.width * scale;
        const h = img.height * scale;
        page.drawImage(img, {
          x: imgArea.x + (imgArea.width - w) / 2,
          y: imgArea.y + (imgArea.height - h) / 2,
          width: w,
          height: h,
        });
      }
    }

    if (f.signatureName) {
      const font = await ensureFont();
      const size = Math.max(6, Math.min(nameH * 0.9, 12));
      const textW = font.widthOfTextAtSize(f.signatureName, size);
      page.drawText(f.signatureName, {
        x: boxX + Math.max(0, (boxW - textW) / 2),
        y: boxBottom + (nameH - size) / 2 + 1,
        size,
        font,
        color: rgb(0.09, 0.4, 0.16),
      });
    }
  }

  return pdf.save();
}
