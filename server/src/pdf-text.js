function numeric(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function itemPosition(item) {
  const transform = Array.isArray(item.transform) ? item.transform : [];
  const scaleX = Math.hypot(numeric(transform[0]), numeric(transform[1]));
  const scaleY = Math.hypot(numeric(transform[2]), numeric(transform[3]));
  return {
    x: numeric(transform[4]),
    y: numeric(transform[5]),
    // pdf.js item.height is the full advance for rotated text in some PDFs
    // (for example 120 for a 10 pt vertical label). Matrix scale is the font
    // size that must be used for line and gap tolerances.
    fontSize: Math.max(1, scaleX, scaleY),
    width: Math.max(0, numeric(item.width)),
    rotated: Math.abs(numeric(transform[1])) > Math.abs(numeric(transform[0]))
  };
}

function isCjk(value) {
  return /[一-龥々〆ヵヶぁ-んァ-ヴー]/.test(value);
}

function joinLineItems(items) {
  const ordered = [...items].sort((left, right) => itemPosition(left).x - itemPosition(right).x);
  let output = "";
  let previous = null;

  for (const item of ordered) {
    const text = String(item.str ?? "");
    if (!text) continue;
    if (previous) {
      const previousPosition = itemPosition(previous);
      const currentPosition = itemPosition(item);
      const gap = currentPosition.x - (previousPosition.x + previousPosition.width);
      const fontSize = Math.max(previousPosition.fontSize, currentPosition.fontSize);
      if (gap > fontSize * 1.25) {
        // A large visual gap is usually a table/column boundary. The pipe keeps
        // GiNZA from merging unrelated cells into one candidate.
        output += " | ";
      } else if (
        gap > fontSize * 0.18
        && !isCjk(String(previous.str ?? "").slice(-1))
        && !isCjk(text[0])
      ) {
        output += " ";
      }
    }
    output += text;
    previous = item;
  }
  return output.trim();
}

export function reconstructPdfPageText(items = []) {
  const lines = [];
  const rotatedBlocks = [];
  const textItems = items.filter((entry) => String(entry.str ?? "").trim());
  for (const item of textItems) {
    const position = itemPosition(item);
    if (position.rotated) {
      // A rotated PDF text item is usually an independent label in a diagram.
      // Never merge it with horizontal text that happens to share its baseline.
      rotatedBlocks.push({
        x: position.x,
        y: position.y,
        text: String(item.str ?? "").trim()
      });
      continue;
    }
    const tolerance = Math.max(1.5, position.fontSize * 0.3);
    let line = lines.find((candidate) => Math.abs(candidate.y - position.y) <= tolerance);
    if (!line) {
      line = { x: position.x, y: position.y, fontSize: position.fontSize, items: [] };
      lines.push(line);
    }
    line.items.push(item);
    line.x = Math.min(line.x, position.x);
    line.fontSize = Math.max(line.fontSize, position.fontSize);
  }

  const blocks = [
    ...lines.map((line) => ({ ...line, text: joinLineItems(line.items) })),
    ...rotatedBlocks
  ]
    .filter((block) => block.text)
    .sort((left, right) => right.y - left.y || left.x - right.x);

  // Several rotated labels are a strong, deterministic signal for a flowchart
  // or wiring diagram. Explicit boundaries stop the Python line-wrap repair
  // from joining independent nodes back into one fake sentence.
  const complexLayout = rotatedBlocks.length >= 4;
  return blocks.map((block) => block.text).join(complexLayout ? "\n[[BLOCK]]\n" : "\n");
}
