#!/usr/bin/env node
/**
 * Test parse-pdf API - requires dev server running (npm run dev)
 * Usage: node scripts/test-parse-pdf.mjs <path-to-pdf>
 * Or with sample: node scripts/test-parse-pdf.mjs (uses a small test PDF from URL)
 */

import { readFileSync } from "fs";
import { createReadStream } from "fs";
import { statSync } from "fs";
import { join } from "path";

const BASE = "http://localhost:3000";

async function testWithFile(filePath) {
  const fullPath = join(process.cwd(), filePath);
  let buffer;
  try {
    buffer = readFileSync(fullPath);
  } catch (e) {
    console.error("Cannot read file:", fullPath, e.message);
    process.exit(1);
  }
  const fileName = filePath.split(/[/\\]/).pop() || "file.pdf";
  const formData = new FormData();
  formData.append("file", new Blob([buffer]), fileName);

  const res = await fetch(`${BASE}/api/parse-pdf`, {
    method: "POST",
    body: formData,
  });
  const data = await res.json();
  if (res.ok) {
    console.log("OK - text length:", data.text?.length || 0);
    console.log("Preview:", (data.text || "").slice(0, 300) + "...");
  } else {
    console.error("FAIL", res.status, data);
  }
}

async function testWithSamplePdf() {
  console.log("No PDF path provided. Usage: node scripts/test-parse-pdf.mjs <path-to-pdf>");
  console.log("Example: node scripts/test-parse-pdf.mjs ./invoice.pdf");
  console.log("Ensure dev server is running: npm run dev");
  process.exit(1);
}

const fileArg = process.argv[2];
if (fileArg) {
  testWithFile(fileArg).catch((e) => {
    console.error(e);
    process.exit(1);
  });
} else {
  testWithSamplePdf().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
