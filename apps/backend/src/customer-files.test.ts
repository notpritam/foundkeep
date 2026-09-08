import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  decodeCaptureHeader,
  fileDisposition,
  resolveCustomerFile,
  safeFileName,
  writeCustomerFile,
} from "./customer-files.ts";

const roots: string[] = [];
afterEach(() => { while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true }); });
function root() { const value = mkdtempSync(join(tmpdir(), "foundkeep-files-")); roots.push(value); return value; }

describe("customer file storage", () => {
  test("decodes bounded base64url metadata and normalizes display names", () => {
    const encoded = Buffer.from(JSON.stringify({ clientId: "ios-1", type: "document" })).toString("base64url");
    expect(decodeCaptureHeader(encoded)).toEqual({ clientId: "ios-1", type: "document" });
    expect(() => decodeCaptureHeader("!bad!" )).toThrow("metadata");
    expect(() => decodeCaptureHeader("a".repeat(22_000))).toThrow("metadata");
    expect(safeFileName("../../Reports/Quarter\u0000.pdf")).toBe("Quarter.pdf");
    expect(safeFileName("   ")).toBe("Shared file");
  });

  test("streams a PDF to an owned random path and records its hash", async () => {
    const data = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n");
    const request = new Request("https://foundkeep.app/api/mobile/captures/file", {
      method: "POST", headers: { "content-type": "application/pdf", "content-length": String(data.length) }, body: data,
    });
    const saved = await writeCustomerFile(request, { root: root(), maxBytes: 1024 });
    expect(saved.bytes).toBe(data.length);
    expect(saved.mime).toBe("application/pdf");
    expect(saved.sha256).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(readFileSync(saved.absolutePath)).toEqual(data);
    expect(resolveCustomerFile(saved.root, saved.relativePath)).toBe(saved.absolutePath);
    expect(() => resolveCustomerFile(saved.root, "../secret")).toThrow("path");
  });

  test("rejects oversized, truncated and mismatched safe formats without retaining a file", async () => {
    const storage = root();
    const oversized = new Request("https://foundkeep.app/upload", {
      method: "POST", headers: { "content-type": "application/pdf", "content-length": "5" }, body: "12345",
    });
    await expect(writeCustomerFile(oversized, { root: storage, maxBytes: 4 })).rejects.toThrow("50 MiB");
    const truncated = new Request("https://foundkeep.app/upload", {
      method: "POST", headers: { "content-type": "application/pdf", "content-length": "99" }, body: "%PDF-x",
    });
    await expect(writeCustomerFile(truncated, { root: storage, maxBytes: 1024 })).rejects.toThrow("length");
    const fakePdf = new Request("https://foundkeep.app/upload", {
      method: "POST", headers: { "content-type": "application/pdf", "content-length": "4" }, body: "nope",
    });
    const generic = await writeCustomerFile(fakePdf, { root: storage, maxBytes: 1024 });
    expect(generic.mime).toBe("application/octet-stream");
  });

  test("serves only known media inline and encodes download filenames", () => {
    expect(fileDisposition("application/pdf", "A report.pdf")).toStartWith("inline;");
    expect(fileDisposition("video/mp4", "clip.mp4")).toStartWith("inline;");
    expect(fileDisposition("application/octet-stream", "résumé.exe")).toBe("attachment; filename*=UTF-8''r%C3%A9sum%C3%A9.exe");
  });
});
