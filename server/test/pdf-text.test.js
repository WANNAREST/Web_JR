import test from "node:test";
import assert from "node:assert/strict";
import { reconstructPdfPageText } from "../src/pdf-text.js";

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
  const text = reconstructPdfPageText([
    item("信号扱い", 10, 100, 40),
    item("券売機", 120, 100, 30),
    item("運転状況", 10, 80, 40)
  ]);
  assert.equal(text, "信号扱い | 券売機\n運転状況");
});

test("flowchart labels with rotated text stay in separate spatial blocks", () => {
  const text = reconstructPdfPageText([
    item("通常の本文", 10, 200, 50),
    rotatedItem("戸閉制御ＮＦＢ", 100, 180),
    rotatedItem("戸閉電磁弁ＮＦＢ", 130, 180),
    rotatedItem("鎖錠ピン", 160, 180),
    rotatedItem("一斉Ｄコック", 190, 180)
  ]);

  assert.ok(text.includes("[[BLOCK]]"));
  assert.ok(!text.includes("戸閉制御ＮＦＢ戸閉電磁弁ＮＦＢ"));
  assert.equal(
    text.split("\n[[BLOCK]]\n").filter((value) => value.includes("ＮＦＢ")).length,
    2
  );
});
