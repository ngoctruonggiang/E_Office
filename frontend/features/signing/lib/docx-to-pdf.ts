"use client";

// Client-side DOCX → PDF. We render the docx with `docx-preview` into an
// offscreen container, rasterise each rendered page with `html2canvas`, and
// assemble a PDF with `jsPDF`. The result feeds the pdf.js viewer /
// field-placement / signing pipeline unchanged. Formatting is approximate.

const DOCX_EXTENSION = /\.docx$/i;

export function isDocx(file: File): boolean {
  return (
    DOCX_EXTENSION.test(file.name) ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

export async function convertDocxToPdf(file: File): Promise<File> {
  const [{ renderAsync }, html2canvasMod, jsPDFMod] = await Promise.all([
    import("docx-preview"),
    import("html2canvas"),
    import("jspdf"),
  ]);
  const html2canvas = html2canvasMod.default;
  const { jsPDF } = jsPDFMod;

  // Offscreen but rendered (html2canvas needs real layout, not display:none).
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.top = "0";
  container.style.left = "-10000px";
  container.style.width = "794px"; // ~A4 width at 96dpi
  container.style.background = "#ffffff";
  document.body.appendChild(container);

  try {
    const buffer = await file.arrayBuffer();
    await renderAsync(buffer, container, undefined, {
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      breakPages: true,
    });

    // docx-preview renders one `section.docx` per page.
    const pages = Array.from(
      container.querySelectorAll<HTMLElement>("section.docx"),
    );
    const targets = pages.length > 0 ? pages : [container];

    const pdf = new jsPDF({ unit: "pt", format: "a4", compress: true });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    for (let i = 0; i < targets.length; i++) {
      const canvas = await html2canvas(targets[i], {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });
      const img = canvas.toDataURL("image/jpeg", 0.92);
      // Fit the page image to the PDF page width, preserving aspect ratio.
      const imgHeight = (canvas.height / canvas.width) * pageWidth;
      const h = Math.min(imgHeight, pageHeight);
      if (i > 0) pdf.addPage();
      pdf.addImage(img, "JPEG", 0, 0, pageWidth, h);
    }

    const blob = pdf.output("blob");
    const pdfName = file.name.replace(DOCX_EXTENSION, "") + ".pdf";
    return new File([blob], pdfName, { type: "application/pdf" });
  } finally {
    document.body.removeChild(container);
  }
}
