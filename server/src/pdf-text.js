function numeric(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeItemText(value) {
  return String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
}

function itemPosition(item) {
  const transform = Array.isArray(item.transform) ? item.transform : [];
  const scaleX = Math.hypot(numeric(transform[0]), numeric(transform[1]));
  const scaleY = Math.hypot(numeric(transform[2]), numeric(transform[3]));
  const fontSize = Math.max(1, scaleX, scaleY);
  const width = Math.max(0, numeric(item.width));
  const height = Math.max(1, Math.min(fontSize, numeric(item.height, fontSize)));
  return {
    x: numeric(transform[4]), y: numeric(transform[5]), fontSize, width, height,
    rotated: Math.abs(numeric(transform[1])) > Math.abs(numeric(transform[0])),
    oversizedAdvance: numeric(item.height, fontSize) > fontSize * 3
  };
}

function isCjk(value) {
  return /[一-龥々〆ヵヶぁ-んァ-ヴー]/.test(value);
}

function rounded(value) {
  return Math.round(numeric(value) * 100) / 100;
}

function bboxFor(items) {
  const positions = items.map(itemPosition);
  const x = Math.min(...positions.map((position) => position.x));
  const bottom = Math.min(...positions.map((position) => position.y - position.height));
  const right = Math.max(...positions.map((position) => position.x + position.width));
  const top = Math.max(...positions.map((position) => position.y));
  return {
    x: rounded(x), y: rounded(bottom),
    width: rounded(Math.max(0, right - x)),
    height: rounded(Math.max(1, top - bottom))
  };
}

function unionBboxes(left, right) {
  const x = Math.min(left.x, right.x);
  const y = Math.min(left.y, right.y);
  const rightEdge = Math.max(left.x + left.width, right.x + right.width);
  const top = Math.max(left.y + left.height, right.y + right.height);
  return { x: rounded(x), y: rounded(y), width: rounded(rightEdge - x), height: rounded(top - y) };
}

function overlappingDuplicateRelation(left, right) {
  const leftText = normalizeItemText(left.str);
  const rightText = normalizeItemText(right.str);
  if (!leftText || !rightText) return null;
  const a = itemPosition(left);
  const b = itemPosition(right);
  const fontSize = Math.max(a.fontSize, b.fontSize);
  if (a.rotated !== b.rotated || Math.abs(a.y - b.y) > Math.max(1.5, fontSize * 0.4)) return null;
  const horizontalOverlap = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const overlapRatio = horizontalOverlap / Math.max(1, Math.min(a.width, b.width));
  if (leftText === rightText && (
    Math.abs(a.x - b.x) <= Math.max(2, fontSize * 0.55) || overlapRatio >= 0.5
  )) return "right";
  if (leftText.includes(rightText) && overlapRatio >= 0.75) return "right";
  if (rightText.includes(leftText) && overlapRatio >= 0.75) return "left";
  return null;
}

function deduplicateItems(items) {
  const unique = [];
  let duplicateItemsRemoved = 0;
  for (const item of items) {
    let itemIsRedundant = false;
    for (let index = unique.length - 1; index >= 0; index -= 1) {
      const relation = overlappingDuplicateRelation(unique[index], item);
      if (relation === "right") {
        itemIsRedundant = true;
        duplicateItemsRemoved += 1;
        break;
      }
      if (relation === "left") {
        unique.splice(index, 1);
        duplicateItemsRemoved += 1;
      }
    }
    if (!itemIsRedundant) unique.push(item);
  }
  return { items: unique, duplicateItemsRemoved };
}

function shouldJoinItems(previous, current) {
  const a = itemPosition(previous);
  const b = itemPosition(current);
  const gap = b.x - (a.x + a.width);
  const fontSize = Math.max(a.fontSize, b.fontSize);
  if (gap < -fontSize * 0.05) return false;
  if (gap <= Math.max(1, fontSize * 0.22)) return true;
  const previousText = normalizeItemText(previous.str);
  const currentText = normalizeItemText(current.str);
  return gap <= fontSize * 0.55
    && !isCjk(previousText.slice(-1))
    && !isCjk(currentText[0]);
}

function joinRunItems(items) {
  let output = "";
  let previous = null;
  for (const item of items) {
    const text = normalizeItemText(item.str);
    if (!text) continue;
    if (previous) {
      const a = itemPosition(previous);
      const b = itemPosition(item);
      const gap = b.x - (a.x + a.width);
      if (gap > Math.max(a.fontSize, b.fontSize) * 0.18
        && !isCjk(normalizeItemText(previous.str).slice(-1))
        && !isCjk(text[0])) output += " ";
    }
    output += text;
    previous = item;
  }
  return output.trim();
}

function buildLines(items) {
  const lines = [];
  for (const item of items.filter((entry) => !itemPosition(entry).rotated)) {
    const position = itemPosition(item);
    const tolerance = Math.max(1.5, position.fontSize * 0.3);
    let line = lines.find((candidate) => Math.abs(candidate.y - position.y) <= tolerance);
    if (!line) {
      line = { y: position.y, items: [] };
      lines.push(line);
    }
    line.items.push(item);
  }
  return lines.sort((left, right) => right.y - left.y);
}

function splitLineIntoRuns(line) {
  const ordered = [...line.items].sort((left, right) => itemPosition(left).x - itemPosition(right).x);
  const runs = [];
  for (const item of ordered) {
    const current = runs.at(-1);
    if (!current || !shouldJoinItems(current.at(-1), item)) runs.push([item]);
    else current.push(item);
  }
  return runs;
}

function repeatedColumnCount(run, multiRunLines) {
  const x = itemPosition(run[0]).x;
  const fontSize = itemPosition(run[0]).fontSize;
  return multiRunLines.filter((line) => line.runs.some((candidate) => (
    Math.abs(itemPosition(candidate[0]).x - x) <= Math.max(4, fontSize * 0.8)
  ))).length;
}

function splitOversizedFlowItem(item) {
  const text = normalizeItemText(item.str);
  const parts = text.split(/\s+/).filter(Boolean);
  const position = itemPosition(item);
  if (parts.length <= 1 || position.fontSize < 16
    || !parts.every((part) => /^[一-龥々〆ヵヶぁ-んァ-ヴー]+$/.test(part))) return null;
  const totalCharacters = parts.reduce((sum, part) => sum + part.length, 0);
  let x = position.x;
  return parts.map((part) => {
    const width = position.width * part.length / Math.max(1, totalCharacters);
    const segment = {
      type: "flow_label",
      text: part,
      bbox: { x: rounded(x), y: rounded(position.y - position.height), width: rounded(width), height: rounded(position.height) },
      fontSize: rounded(position.fontSize)
    };
    x += width;
    return segment;
  });
}

function shouldJoinTextSegments(previous, current) {
  if (previous.type !== "text" || current.type !== "text") return false;
  if (/[。！？!?：:]$/.test(previous.text) || /^[・●○■□◆◇▶▷※注]/.test(current.text)) return false;
  if (/^(?:第?[0-9０-９]+[.)）．、]|[（(][0-9０-９]+[)）])/.test(current.text)) return false;
  if (previous.text.length + current.text.length > 500) return false;
  if (previous.text.length <= 16
    && current.text.length > previous.text.length * 2
    && previous.bbox.width < current.bbox.width * 0.45) return false;

  const fontSize = Math.max(previous.fontSize, current.fontSize);
  if (Math.abs(previous.fontSize - current.fontSize) > fontSize * 0.2) return false;
  const verticalGap = previous.bbox.y - (current.bbox.y + current.bbox.height);
  if (verticalGap < -fontSize * 0.25 || verticalGap > fontSize * 0.9) return false;

  const horizontalOverlap = Math.max(0,
    Math.min(previous.bbox.x + previous.bbox.width, current.bbox.x + current.bbox.width)
    - Math.max(previous.bbox.x, current.bbox.x));
  const overlapRatio = horizontalOverlap / Math.max(1, Math.min(previous.bbox.width, current.bbox.width));
  const alignedLeft = Math.abs(previous.bbox.x - current.bbox.x) <= fontSize * 1.5;
  return overlapRatio >= 0.65 || alignedLeft;
}

function mergeWrappedTextSegments(segments) {
  const merged = [];
  let wrappedLinesJoined = 0;
  for (const segment of segments) {
    const previous = merged.at(-1);
    if (previous && shouldJoinTextSegments(previous, segment)) {
      const separator = isCjk(previous.text.slice(-1)) || isCjk(segment.text[0]) ? "" : " ";
      previous.text = `${previous.text}${separator}${segment.text}`;
      previous.bbox = unionBboxes(previous.bbox, segment.bbox);
      wrappedLinesJoined += 1;
    } else {
      merged.push({ ...segment, bbox: { ...segment.bbox } });
    }
  }
  return { segments: merged, wrappedLinesJoined };
}

function boilerplateKey(segment) {
  return normalizeItemText(segment.text).replace(/[0-9０-９]+/g, "#");
}

function isPageEdgeSegment(segment, page) {
  if (!page.height) return false;
  const centerY = segment.bbox.y + segment.bbox.height / 2;
  return centerY <= page.height * 0.1 || centerY >= page.height * 0.9;
}

export function filterRepeatedPageBoilerplate(pages = []) {
  if (pages.length < 3) return pages;
  const pagesByKey = new Map();
  for (const page of pages) {
    for (const segment of page.segments ?? []) {
      const key = boilerplateKey(segment);
      if (!key || key.length > 80 || !isPageEdgeSegment(segment, page)) continue;
      if (!pagesByKey.has(key)) pagesByKey.set(key, new Set());
      pagesByKey.get(key).add(page.page);
    }
  }
  const minimumPages = Math.max(3, Math.ceil(pages.length * 0.2));
  const repeated = new Set([...pagesByKey]
    .filter(([, pageNumbers]) => pageNumbers.size >= minimumPages)
    .map(([key]) => key));

  return pages.map((page) => {
    let repeatedBoilerplateRemoved = 0;
    const segments = (page.segments ?? []).filter((segment) => {
      const remove = isPageEdgeSegment(segment, page) && repeated.has(boilerplateKey(segment));
      if (remove) repeatedBoilerplateRemoved += 1;
      return !remove;
    });
    return {
      ...page,
      segments,
      diagnostics: { ...page.diagnostics, repeatedBoilerplateRemoved }
    };
  });
}

export function reconstructPdfPage(items = [], pageInfo = {}) {
  const textItems = items.filter((entry) => normalizeItemText(entry.str));
  const deduplicated = deduplicateItems(textItems);
  const lines = buildLines(deduplicated.items).map((line) => ({ ...line, runs: splitLineIntoRuns(line) }));
  const multiRunLines = lines.filter((line) => line.runs.length > 1);
  const rawSegments = [];

  for (const line of lines) {
    for (const run of line.runs) {
      const splitFlowSegments = run.length === 1 && itemPosition(run[0]).oversizedAdvance
        ? splitOversizedFlowItem(run[0])
        : null;
      if (splitFlowSegments) {
        rawSegments.push(...splitFlowSegments);
        continue;
      }
      const repeatedColumns = repeatedColumnCount(run, multiRunLines);
      rawSegments.push({
        type: line.runs.length > 1
          ? repeatedColumns >= 3 ? "table_cell" : "flow_label"
          : "text",
        text: joinRunItems(run),
        bbox: bboxFor(run),
        fontSize: rounded(Math.max(...run.map((item) => itemPosition(item).fontSize)))
      });
    }
  }

  for (const item of deduplicated.items.filter((entry) => itemPosition(entry).rotated)) {
    rawSegments.push({
      type: "flow_label", text: normalizeItemText(item.str),
      bbox: bboxFor([item]), fontSize: rounded(itemPosition(item).fontSize)
    });
  }

  rawSegments.sort((left, right) => (
    (right.bbox.y + right.bbox.height) - (left.bbox.y + left.bbox.height)
    || left.bbox.x - right.bbox.x
  ));
  const merged = mergeWrappedTextSegments(rawSegments);
  const pageNumber = Number.isInteger(pageInfo.pageNumber) ? pageInfo.pageNumber : null;
  const prefix = pageNumber ? `p${pageNumber}` : "p";
  const segments = merged.segments.map((segment, index) => ({ id: `${prefix}-s${index + 1}`, ...segment }));

  return {
    page: pageNumber,
    width: rounded(pageInfo.width),
    height: rounded(pageInfo.height),
    segments,
    diagnostics: {
      inputItems: textItems.length,
      duplicateItemsRemoved: deduplicated.duplicateItemsRemoved,
      segmentCount: segments.length,
      tableCells: segments.filter((segment) => segment.type === "table_cell").length,
      flowLabels: segments.filter((segment) => segment.type === "flow_label").length,
      wrappedLinesJoined: merged.wrappedLinesJoined,
      repeatedBoilerplateRemoved: 0
    }
  };
}

export function reconstructPdfPageText(itemsOrSegments = []) {
  const segments = itemsOrSegments.some((entry) => Object.hasOwn(entry, "str"))
    ? reconstructPdfPage(itemsOrSegments).segments
    : itemsOrSegments;
  return segments.map((segment) => normalizeItemText(segment.text)).filter(Boolean).join("\n");
}
