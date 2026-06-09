import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const files = [
  "docs/theorems/README.md",
  "docs/theorems/existence.md",
  "docs/theorems/uniqueness.md",
  "docs/theorems/stability.md",
  "docs/theorems/functoriality.md"
];

test("theorem interface files exist", () => {
  for (const file of files) {
    assert.ok(fs.existsSync(path.resolve(process.cwd(), file)), `${file} missing`);
  }
});
