import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PassThrough } from "node:stream";

const testDir = path.dirname(fileURLToPath(import.meta.url));

test("Python pipes use streaming UTF-8 decoders before collecting Japanese output", async () => {
  const source = await fs.readFile(path.resolve(testDir, "../src/index.js"), "utf8");

  assert.match(source, /child\.stdout\.setEncoding\("utf8"\)/);
  assert.match(source, /child\.stderr\.setEncoding\("utf8"\)/);
  assert.doesNotMatch(source, /stdout \+= chunk\.toString\(\)/);
});

test("streaming UTF-8 decoding preserves a Japanese character split across chunks", async () => {
  const stream = new PassThrough();
  const bytes = Buffer.from("閉そく指示運転", "utf8");
  let output = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => { output += chunk; });

  stream.write(bytes.subarray(0, 2));
  stream.end(bytes.subarray(2));
  await new Promise((resolve) => stream.on("end", resolve));

  assert.equal(output, "閉そく指示運転");
  assert.ok(!output.includes("�"));
});
