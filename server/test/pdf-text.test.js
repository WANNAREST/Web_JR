import test from "node:test";
import assert from "node:assert/strict";
import { filterRepeatedPageBoilerplate, reconstructPdfPage, reconstructPdfPageText } from "../src/pdf-text.js";

function item(str, x, y, width = 10, height = 10) {
  return { str, width, height, transform: [height, 0, 0, height, x, y] };
}

function rotatedItem(str, x, y, width = 50, height = 10) {
  return { str, width, height: width, transform: [0, height, -height, 0, x, y] };
}

test("PDF text reconstruction joins adjacent Japanese glyphs", () => {
  const text = reconstructPdfPageText([
    item("輸送サー", 10, 100, 40),
    item("ビス", 50, 100, 20)
  ]);
  assert.equal(text, "輸送サービス");
});

test("PDF text reconstruction preserves line and column boundaries", () => {
  const page = reconstructPdfPage([
    item("信号扱い", 10, 100, 40),
    item("券売機", 120, 100, 30),
    item("運転状況", 10, 80, 40)
  ], { pageNumber: 3, width: 200, height: 120 });

  assert.equal(page.page, 3);
  assert.deepEqual(page.segments.map((segment) => segment.text), ["信号扱い", "券売機", "運転状況"]);
  assert.ok(page.segments.every((segment) => segment.bbox.width > 0));
  assert.equal(reconstructPdfPageText(page.segments), "信号扱い\n券売機\n運転状況");
});

test("overlapping duplicate PDF items are emitted once", () => {
  const page = reconstructPdfPage([
    item("その後の", 437, 100, 48, 12),
    item("その後の", 441.5, 100, 48, 12),
    item("処置", 437, 82, 24, 12),
    item("処置", 439, 82, 24, 12)
  ]);

  assert.deepEqual(page.segments.map((segment) => segment.text), ["その後の処置"]);
  assert.equal(page.diagnostics.duplicateItemsRemoved, 2);
  assert.equal(page.diagnostics.wrappedLinesJoined, 1);
});

test("a shorter overlay contained in a larger PDF text item is removed", () => {
  const page = reconstructPdfPage([
    item("状況の確認 通告受領  運転再開", 195, 100, 315, 19),
    item("運転再開", 404, 99, 78, 19)
  ]);

  assert.deepEqual(page.segments.map((segment) => segment.text), ["状況の確認 通告受領 運転再開"]);
  assert.equal(page.diagnostics.duplicateItemsRemoved, 1);
});

test("repeated spatial columns are emitted as independent table cells", () => {
  const page = reconstructPdfPage([
    item("点検箇所", 10, 100, 40), item("点検標準", 100, 100, 40),
    item("気笛", 10, 80, 20), item("音響", 100, 80, 20),
    item("ブレーキ", 10, 60, 40), item("作用", 100, 60, 20)
  ]);

  assert.equal(page.segments.length, 6);
  assert.ok(page.segments.every((segment) => segment.type === "table_cell"));
  assert.ok(!page.segments.some((segment) => segment.text.includes("|")));
});

test("flowchart labels with rotated text stay in separate spatial blocks", () => {
  const page = reconstructPdfPage([
    item("通常の本文", 10, 200, 50),
    rotatedItem("戸閉制御ＮＦＢ", 100, 180),
    rotatedItem("戸閉電磁弁ＮＦＢ", 130, 180),
    rotatedItem("鎖錠ピン", 160, 180),
    rotatedItem("一斉Ｄコック", 190, 180)
  ]);

  assert.ok(page.segments.filter((segment) => segment.type === "flow_label").length >= 4);
  assert.ok(!page.segments.some((segment) => segment.text.includes("戸閉制御ＮＦＢ戸閉電磁弁ＮＦＢ")));
});

test("oversized PDF advances are treated as independent flowchart layers", () => {
  const page = reconstructPdfPage([
    { str: "列車の停止 状況の確認", width: 210, height: 377, transform: [19, 0, 0, 19, 81, 750] },
    { str: "事態の収拾", width: 96, height: 377, transform: [19, 0, 0, 19, 254, 750] },
    { str: "運転再開", width: 78, height: 377, transform: [19, 0, 0, 19, 433, 750] }
  ]);

  assert.deepEqual(page.segments.map((segment) => segment.text), [
    "列車の停止", "状況の確認", "事態の収拾", "運転再開"
  ]);
  assert.ok(page.segments.every((segment) => segment.type === "flow_label"));
});

test("wrapped lines join only inside the same text region", () => {
  const page = reconstructPdfPage([
    item("輸送サー", 10, 100, 50),
    item("ビスを提供する。", 10, 82, 90),
    item("別の列", 150, 60, 40)
  ], { pageNumber: 4, width: 220, height: 140 });

  assert.ok(page.segments.some((segment) => segment.text === "輸送サービスを提供する。"));
  assert.ok(page.segments.some((segment) => segment.text === "別の列"));
  assert.ok(!page.segments.some((segment) => segment.text.includes("提供する。別の列")));
});

test("a short heading is not merged into a substantially wider paragraph", () => {
  const page = reconstructPdfPage([
    item("防護無線発報", 10, 100, 60),
    item("お客様が線路上に避難した場合は停止手配を行う。", 10, 82, 280)
  ], { pageNumber: 8, width: 320, height: 140 });

  assert.deepEqual(page.segments.map((segment) => segment.text), [
    "防護無線発報",
    "お客様が線路上に避難した場合は停止手配を行う。"
  ]);
});

test("repeated page-edge boilerplate is removed without touching body text", () => {
  const pages = [1, 2, 3].map((pageNumber) => ({
    page: pageNumber,
    width: 200,
    height: 100,
    segments: [
      { id: `p${pageNumber}-s1`, type: "text", text: "乗務員作業標準", bbox: { x: 10, y: 92, width: 80, height: 8 } },
      { id: `p${pageNumber}-s2`, type: "text", text: `本文${pageNumber}`, bbox: { x: 10, y: 40, width: 50, height: 8 } }
    ],
    diagnostics: {}
  }));
  const filtered = filterRepeatedPageBoilerplate(pages);

  assert.ok(filtered.every((page) => page.segments.length === 1));
  assert.deepEqual(filtered.map((page) => page.segments[0].text), ["本文1", "本文2", "本文3"]);
  assert.ok(filtered.every((page) => page.diagnostics.repeatedBoilerplateRemoved === 1));
});
