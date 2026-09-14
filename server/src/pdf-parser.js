import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDocument, Util } from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  assessPdfPageQuality,
  filterRepeatedPageBoilerplate,
  reconstructPdfPage,
  reconstructPdfPageText
} from "./pdf-text.js";

const pdfJsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../node_modules/pdfjs-dist");

function resourceDirectory(name) {
  return `${path.join(pdfJsRoot, name)}${path.sep}`;
}

function normalizeItemForViewport(item, viewport, style = {}) {
  const matrix = Util.transform(viewport.transform, item.transform);
  const angle = Math.atan2(matrix[1], matrix[0]);
  const advanceX = Math.cos(angle);
  const advanceY = Math.sin(angle);
  const width = Math.max(0, Number(item.width) || 0);
  const height = Math.max(1, Number(item.height) || Math.hypot(matrix[2], matrix[3]) || 1);
  const normalX = advanceY;
  const normalY = -advanceX;
  const corners = [
    [matrix[4], matrix[5]],
    [matrix[4] + advanceX * width, matrix[5] + advanceY * width],
    [matrix[4] + normalX * height, matrix[5] + normalY * height],
    [matrix[4] + advanceX * width + normalX * height, matrix[5] + advanceY * width + normalY * height]
  ];
  const left = Math.min(...corners.map(([x]) => x));
  const right = Math.max(...corners.map(([x]) => x));
  const top = Math.min(...corners.map(([, y]) => y));
  const bottom = Math.max(...corners.map(([, y]) => y));

  return {
    ...item,
    layout: {
      x: left,
      y: viewport.height - bottom,
      width: right - left,
      height: bottom - top,
      fontSize: Math.max(1, Math.hypot(matrix[2], matrix[3])),
      angle,
      rotated: Math.abs(advanceY) > Math.abs(advanceX),
      oversizedAdvance: height > Math.max(1, Math.hypot(matrix[2], matrix[3])) * 3,
      direction: style.vertical ? "ttb" : item.dir ?? "ltr"
    }
  };
}

export async function parsePdfBuffer(buffer) {
  const loadingTask = getDocument({
    data: new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength),
    cMapUrl: resourceDirectory("cmaps"),
    cMapPacked: true,
    standardFontDataUrl: resourceDirectory("standard_fonts"),
    wasmUrl: resourceDirectory("wasm"),
    useSystemFonts: true,
    verbosity: 0
  });

  const document = await loadingTask.promise;
  try {
    const pages = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const pdfPage = await document.getPage(pageNumber);
      const viewport = pdfPage.getViewport({ scale: 1 });
      const content = await pdfPage.getTextContent({
        disableNormalization: false,
        includeMarkedContent: false
      });
      const items = content.items
        .filter((item) => Object.hasOwn(item, "str"))
        .map((item) => normalizeItemForViewport(item, viewport, content.styles?.[item.fontName]));
      pages.push(reconstructPdfPage(items, {
        pageNumber,
        width: viewport.width,
        height: viewport.height,
        rotation: viewport.rotation
      }));
      pdfPage.cleanup();
    }

    const filteredPages = filterRepeatedPageBoilerplate(pages);
    const measuredPages = filteredPages.map((page, index) => assessPdfPageQuality(
      page,
      filteredPages[index - 1],
      filteredPages[index + 1]
    ));
    return {
      pages: measuredPages,
      text: measuredPages.map((page) => reconstructPdfPageText(page.segments)).join("\n")
    };
  } finally {
    await document.destroy();
  }
}
