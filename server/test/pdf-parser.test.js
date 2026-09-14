import test from "node:test";
import assert from "node:assert/strict";
import { parsePdfBuffer } from "../src/pdf-parser.js";

function minimalRotatedPdf() {
  const stream = "BT /F1 12 Tf 20 30 Td (Native parser) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 100] /Rotate 90 /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf);
}

test("modern PDF.js parser returns normalized page structure and diagnostics", async () => {
  const result = await parsePdfBuffer(minimalRotatedPdf());

  assert.equal(result.pages.length, 1);
  assert.equal(result.pages[0].rotation, 90);
  assert.equal(result.pages[0].width, 100);
  assert.equal(result.pages[0].height, 200);
  assert.equal(result.pages[0].segments[0].text, "Native parser");
  assert.ok(result.pages[0].segments[0].bbox.width > 0);
  assert.equal(result.pages[0].diagnostics.nativeSource, "pdfjs");
  assert.match(result.text, /Native parser/);
});
