import type { Database } from "bun:sqlite";
import { createHash, randomBytes } from "node:crypto";
import { Hono, type Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { config } from "./config.ts";
import {
  PreferenceValidationError,
  readCustomerPreferences,
  writeCustomerPreferences,
} from "./customer-preferences.ts";
import {
  DEFAULT_PROCESSING_OPTIONS,
  ProvenanceValidationError,
  normalizeProcessingOptions,
  normalizeProvenance,
  parseStoredJson,
  type CaptureProvenance,
  type ProcessingOptions,
} from "./customer-provenance.ts";
import {
  CustomerFileError,
  decodeCaptureHeader,
  fileDisposition,
  removeCustomerFile,
  resolveCustomerFile,
  safeFileName,
  writeCustomerFile,
} from "./customer-files.ts";
import { isExpoPushToken } from "./customer-notifications.ts";

const DAY = 86_400_000;
const MAX_BODY = 12 * 1024 * 1024;
const BODY_READ_DEADLINE_MS = 30_000;
const MAX_IMAGE = 8 * 1024 * 1024;
const MAX_CAPTURES = 1000;
const MAX_BYTES = 200 * 1024 * 1024;
const TYPES = new Set(["screenshot", "selection", "bookmark", "image", "note", "tweet", "video", "audio", "document", "file"]);
const CAPTURE_COLUMNS = "id,account_id,client_id,batch_id,type,status,source_url,source_title,selection_text,note_text,article_text,blob_mime,blob_bytes,file_name,file_path,file_mime,file_bytes,storage_bytes,width,height,captured_at,created_at,updated_at,summary,ocr_text,category,tags,enrich_error,enrich_attempts,processing_at,provenance_json,processing_options_json";

interface AccountRow { id: string; email: string; name: string; password_hash: string; recovery_hash: string; created_at: number }
interface ConnectionRow { id: string; account_id: string; name: string; created_at: number; last_seen_at: number | null; expires_at: number }
interface CredentialRow { id: string; account_id: string; expires_at: number }
export interface CustomerCaptureRow {
  id: string; account_id: string; client_id: string; type: string; status: string;
  batch_id: string | null;
  source_url: string | null; source_title: string | null; selection_text: string | null;
  note_text: string | null; article_text: string | null; blob_data?: Uint8Array | null;
  blob_mime: string | null; blob_bytes: number; storage_bytes: number;
  file_name: string | null; file_path: string | null; file_mime: string | null; file_bytes: number;
  width: number | null; height: number | null; captured_at: number; created_at: number; updated_at: number;
  summary: string | null; ocr_text: string | null; category: string | null; tags: string;
  enrich_error: string | null; enrich_attempts: number; processing_at: number | null;
  provenance_json: string | null; processing_options_json: string | null;
}
interface Auth { account: AccountRow; kind: "session" | "connection"; credentialId: string }
type CustomerEnv = { Bindings: { clientIp?: string }; Variables: { customerAuth: Auth } };
type C = Context<CustomerEnv>;
type JsonObject = Record<string, unknown>;
class CustomerError extends Error {
  constructor(readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 429 | 503, readonly code: string, message: string, readonly retryAfter?: number) { super(message); }
}
function fail(status: CustomerError["status"], code: string, message: string): never { throw new CustomerError(status, code, message); }
function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
function secret() { return randomBytes(32).toString("base64url"); }
function mobileCursor(raw: string): { capturedAt: number; id: string } | null {
  if (!raw) return null;
  if (raw.length > 256 || !/^[A-Za-z0-9_-]+$/.test(raw)) fail(400, "invalid_cursor", "Refresh the collection and try again.");
  try {
    const data = Buffer.from(raw, "base64url");
    if (data.toString("base64url") !== raw) throw new Error();
    const value = JSON.parse(data.toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== 2 ||
        !Number.isSafeInteger(value.capturedAt) || value.capturedAt < 0 ||
        typeof value.id !== "string" || !/^[A-Za-z0-9-]{1,80}$/.test(value.id)) throw new Error();
    return value;
  } catch { fail(400, "invalid_cursor", "Refresh the collection and try again."); }
}
function encodeMobileCursor(row: CustomerCaptureRow) {
  return Buffer.from(JSON.stringify({ capturedAt: row.captured_at, id: row.id })).toString("base64url");
}
function accountDto(row: AccountRow) { return { id: row.id, email: row.email, name: row.name, createdAt: row.created_at }; }
function connectionDto(row: ConnectionRow) { return { id: row.id, name: row.name, createdAt: row.created_at, lastSeenAt: row.last_seen_at }; }
export function customerCaptureDto(row: CustomerCaptureRow) {
  return {
    id: row.id, clientId: row.client_id, batchId: row.batch_id, type: row.type, status: row.status,
    sourceUrl: row.source_url, sourceTitle: row.source_title, selectionText: row.selection_text,
    noteText: row.note_text, articleText: row.article_text, summary: row.summary, ocrText: row.ocr_text,
    category: row.category, tags: JSON.parse(row.tags || "[]") as string[],
    blobUrl: row.blob_mime ? `/api/captures/${row.id}/blob` : null,
    fileName: row.file_name, fileMime: row.file_mime, fileBytes: row.file_bytes,
    fileUrl: row.file_path ? `/api/captures/${row.id}/file` : null,
    width: row.width, height: row.height, capturedAt: row.captured_at, createdAt: row.created_at,
    updatedAt: row.updated_at, enrichError: row.enrich_error,
    provenance: parseStoredJson<CaptureProvenance | null>(row.provenance_json, null),
    processingOptions: parseStoredJson<ProcessingOptions>(row.processing_options_json, { ...DEFAULT_PROCESSING_OPTIONS }),
  };
}

function textField(body: JsonObject, key: string, max: number, required = false): string | null {
  const value = body[key];
  if (value === undefined || value === null) {
    if (required) fail(400, "invalid_input", `${key} is required.`);
    return null;
  }
  if (typeof value !== "string" || value.length > max || (required && !value.trim())) fail(400, "invalid_input", `${key} is invalid or too long.`);
  return value;
}
function emailField(body: JsonObject) {
  const email = textField(body, "email", 254, true)!.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, "invalid_email", "Enter a valid email address.");
  return email;
}
function passwordField(body: JsonObject, key = "password", newPassword = true) {
  const password = textField(body, key, 128, true)!;
  if (newPassword && password.length < 12) fail(400, "invalid_password", "Use a password with 12 to 128 characters.");
  return password;
}
async function jsonBody(c: C, max = 16_384): Promise<JsonObject> {
  if (!/^application\/json(?:\s*;|$)/i.test(c.req.header("content-type") || "")) fail(415, "json_required", "Send an application/json request.");
  const declared = c.req.header("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > max)) fail(413, "request_too_large", "This request is too large.");
  const reader = c.req.raw.body?.getReader();
  if (!reader) fail(400, "invalid_json", "Send a JSON object.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  let interrupt!: (reason: CustomerError) => void;
  const interrupted = new Promise<never>((_, reject) => { interrupt = reject; });
  const abort = () => interrupt(new CustomerError(400, "request_aborted", "The upload was interrupted. Please try again."));
  const deadline = setTimeout(() => interrupt(new CustomerError(503, "body_timeout", "The upload took too long. Please try again.", 3)), BODY_READ_DEADLINE_MS);
  const signal = c.req.raw.signal;
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  try {
    while (true) {
      // One deadline covers the whole body; sending another byte cannot reset
      // it and retain an upload slot indefinitely.
      const { value, done } = await Promise.race([interrupted, reader.read()]);
      if (done) break;
      length += value.byteLength;
      if (length > max) fail(413, "request_too_large", "This request is too large.");
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof CustomerError) throw error;
    fail(400, "request_aborted", "The upload was interrupted. Please try again.");
  } finally {
    clearTimeout(deadline);
    signal.removeEventListener("abort", abort);
    // Cancellation must not await an uncooperative stream implementation.
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  let body: unknown;
  try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { fail(400, "invalid_json", "Send a valid JSON object."); }
  if (!body || typeof body !== "object" || Array.isArray(body)) fail(400, "invalid_json", "Send a JSON object.");
  return body as JsonObject;
}

// Fixed windows and a bounded map avoid attacker-controlled unbounded memory.
class RateLimits {
  private entries = new Map<string, { count: number; until: number }>();
  take(key: string, limit: number, windowMs: number) {
    const now = Date.now();
    let row = this.entries.get(key);
    if (!row || row.until <= now) {
      if (this.entries.size >= 10_000) {
        for (const [id, value] of this.entries) if (value.until <= now) this.entries.delete(id);
        if (this.entries.size >= 10_000) fail(429, "rate_limited", "Too many requests. Try again shortly.");
      }
      row = { count: 0, until: now + windowMs };
      this.entries.set(key, row);
    }
    if (++row.count > limit) fail(429, "rate_limited", "Too many attempts. Try again later.");
  }
}
let passwordJobs = 0;
async function passwordWork<T>(work: () => Promise<T>) {
  if (passwordJobs >= 4) fail(503, "auth_busy", "Sign-in is busy. Please try again shortly.");
  passwordJobs++;
  try { return await work(); } finally { passwordJobs--; }
}
const hashPassword = (password: string) => passwordWork(() => Bun.password.hash(password, { algorithm: "argon2id", memoryCost: 19456, timeCost: 2 }));
const verifyPassword = (password: string, stored: string) => passwordWork(() => Bun.password.verify(password, stored));

// Process-wide slots bound retained body buffers before decoding or quota
// checks. Account entries disappear on completion, so this map is bounded too.
let activeUploads = 0;
const accountUploads = new Map<string, number>();
function acquireUpload(accountId: string) {
  const own = accountUploads.get(accountId) || 0;
  if (own >= 2) throw new CustomerError(429, "upload_busy", "Two captures are already uploading. Please try again shortly.", 3);
  if (activeUploads >= 8) throw new CustomerError(503, "upload_busy", "Foundkeep is receiving other captures. Please try again shortly.", 3);
  activeUploads++;
  accountUploads.set(accountId, own + 1);
  return () => {
    activeUploads--;
    const remaining = accountUploads.get(accountId)! - 1;
    if (remaining) accountUploads.set(accountId, remaining);
    else accountUploads.delete(accountId);
  };
}

function decodeImage(raw: unknown): { data: Buffer | null; mime: string | null; bytes: number; width: number | null; height: number | null } {
  if (raw === undefined || raw === null || raw === "") return { data: null, mime: null, bytes: 0, width: null, height: null };
  if (typeof raw !== "string") fail(400, "invalid_image", "Use a PNG, JPEG, or WebP image.");
  // Reject oversized base64 before allocating a decoded buffer.
  if (raw.length > Math.ceil(MAX_IMAGE / 3) * 4 + 32) fail(413, "image_too_large", "Images must be 8 MiB or smaller.");
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(raw);
  if (!match || match[2]!.length % 4 !== 0) fail(400, "invalid_image", "Use a valid PNG, JPEG, or WebP data URL.");
  const data = Buffer.from(match[2]!, "base64");
  if (data.byteLength > MAX_IMAGE) fail(413, "image_too_large", "Images must be 8 MiB or smaller.");
  if (data.toString("base64") !== match[2]) fail(400, "invalid_image", "Image data is malformed.");
  const mime = match[1]!;
  const png = data.length >= 45 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && data.readUInt32BE(8) === 13 && data.toString("ascii", 12, 16) === "IHDR" && data.toString("ascii", data.length - 8, data.length - 4) === "IEND";
  const jpeg = data.length >= 4 && data[0] === 255 && data[1] === 216 && data[2] === 255 && data[data.length - 2] === 255 && data[data.length - 1] === 217;
  const webp = data.length >= 20 && data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP" && ["VP8 ", "VP8L", "VP8X"].includes(data.toString("ascii", 12, 16)) && data.readUInt32LE(4) + 8 === data.length;
  if (!(mime === "image/png" ? png : mime === "image/jpeg" ? jpeg : webp)) fail(400, "invalid_image", "The image does not match its declared format.");
  let width = 0;
  let height = 0;
  if (mime === "image/png") {
    width = data.readUInt32BE(16);
    height = data.readUInt32BE(20);
  } else if (mime === "image/webp") {
    const format = data.toString("ascii", 12, 16);
    if (format === "VP8X" && data.length >= 30) {
      width = 1 + data.readUIntLE(24, 3);
      height = 1 + data.readUIntLE(27, 3);
    } else if (format === "VP8L" && data.length >= 25 && data[20] === 0x2f) {
      width = 1 + (data.readUInt32LE(21) & 0x3fff);
      height = 1 + ((data.readUInt32LE(21) >>> 14) & 0x3fff);
    } else if (format === "VP8 " && data.length >= 30 && data.subarray(23, 26).equals(Buffer.from([0x9d, 1, 0x2a]))) {
      width = data.readUInt16LE(26) & 0x3fff;
      height = data.readUInt16LE(28) & 0x3fff;
    }
  } else {
    // Bound traversal by the 8 MiB input and require a JPEG start-of-frame.
    let offset = 2;
    while (offset + 4 <= data.length) {
      if (data[offset++] !== 255) break;
      while (data[offset] === 255) offset++;
      const marker = data[offset++];
      if (marker === 0xda || marker === 0xd9 || offset + 2 > data.length) break;
      if (marker === 0x01 || (marker! >= 0xd0 && marker! <= 0xd7)) continue;
      const length = data.readUInt16BE(offset);
      if (length < 2 || offset + length > data.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker!) && length >= 8) {
        height = data.readUInt16BE(offset + 3);
        width = data.readUInt16BE(offset + 5);
        break;
      }
      offset += length;
    }
  }
  if (!width || !height || width > 32768 || height > 32768 || width * height > 64_000_000) fail(400, "invalid_dimensions", "Images must have valid dimensions of at most 64 million pixels.");
  return { data, mime, bytes: data.byteLength, width, height };
}

export function customerRoutes(db: Database) {
  const app = new Hono<CustomerEnv>();
  const origin = config.customerOrigin;
  const websiteOrigins = new Set(config.customerOrigins);
  const extensionOrigins = new Set(config.customerExtensionIds.map((id) => `chrome-extension://${id}`));
  const secure = origin.startsWith("https://");
  const cookieName = secure ? "__Host-atlas_session" : "atlas_session";
  const cookieOptions = { httpOnly: true, secure, sameSite: "Lax" as const, path: "/" };
  const rates = new RateLimits();
  const positiveLimit = (value: string | undefined, fallback: number) => value && /^\d+$/.test(value) && Number(value) > 0 ? Number(value) : fallback;
  const globalMaxCaptures = positiveLimit(process.env.ATLAS_CUSTOMER_GLOBAL_MAX_CAPTURES, 10_000);
  const globalMaxBytes = positiveLimit(process.env.ATLAS_CUSTOMER_GLOBAL_MAX_BYTES, 2 * 1024 * 1024 * 1024);

  function website(c: C) {
    if (!websiteOrigins.has(c.req.header("origin") || "")) fail(403, "invalid_origin", "Open Foundkeep on its own website to continue.");
  }
  function account(id: string) { return db.query("SELECT * FROM customer_accounts WHERE id = ?").get(id) as AccountRow | null; }
  function emailAccount(email: string) { return db.query("SELECT * FROM customer_accounts WHERE email = ?").get(email) as AccountRow | null; }
  function accountIntent(c: C, accountId: string) {
    const expected = c.req.header("X-Atlas-Account");
    if (expected !== undefined && expected !== accountId) fail(409, "account_changed", "Your signed-in account changed. Reload Foundkeep to continue.");
  }
  function auth(c: C, cookieOnly = false, countRequest = true): Auth {
    const authorization = c.req.header("authorization");
    const kind = authorization ? "connection" : "session";
    const token = authorization ? /^Bearer ([A-Za-z0-9_-]{43})$/.exec(authorization)?.[1] : getCookie(c, cookieName);
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) fail(401, "unauthorized", "Sign in or reconnect your extension.");
    const table = kind === "session" ? "customer_sessions" : "customer_connections";
    const credential = db.query(`SELECT id, account_id, expires_at FROM ${table} WHERE token_hash = ?`).get(hash(token)) as CredentialRow | null;
    if (!credential || credential.expires_at <= Date.now()) fail(401, "unauthorized", "Your session expired. Sign in or reconnect your extension.");
    const owner = account(credential.account_id);
    if (!owner) fail(401, "unauthorized", "Sign in or reconnect your extension.");
    if (cookieOnly && kind !== "session") fail(403, "website_session_required", "Use your signed-in Foundkeep website for this action.");
    // This optional header expresses the page's existing account context. It
    // can reject a cookie changed in another tab; it never grants authority.
    if (kind === "session") accountIntent(c, owner.id);
    if (kind === "session" && !["GET", "HEAD", "OPTIONS"].includes(c.req.method)) website(c);
    if (kind === "connection") db.query("UPDATE customer_connections SET last_seen_at = ? WHERE id = ?").run(Date.now(), credential.id);
    if (countRequest) rates.take(`account:${owner.id}`, 600, 60_000);
    return { account: owner, kind, credentialId: credential.id };
  }
  function session(c: C, accountId: string) {
    const token = secret();
    const now = Date.now();
    db.query("DELETE FROM customer_sessions WHERE expires_at <= ?").run(now);
    // Keep account credential storage bounded even under repeated successful login.
    db.query("DELETE FROM customer_sessions WHERE account_id = ? AND id NOT IN (SELECT id FROM customer_sessions WHERE account_id = ? ORDER BY created_at DESC LIMIT 19)").run(accountId, accountId);
    db.query("INSERT INTO customer_sessions(id,account_id,token_hash,created_at,expires_at) VALUES(?,?,?,?,?)").run(crypto.randomUUID(), accountId, hash(token), now, now + 30 * DAY);
    setCookie(c, cookieName, token, { ...cookieOptions, maxAge: 30 * 86_400 });
  }
  function mobileDeviceName(body: JsonObject) {
    const device = (textField(body, "deviceName", 72) || "iPhone").trim() || "iPhone";
    return `Foundkeep for ${device}`;
  }
  function issueConnection(accountId: string, name: string) {
    const now = Date.now();
    db.query("DELETE FROM customer_connections WHERE expires_at <= ?").run(now);
    const count = (db.query("SELECT COUNT(*) n FROM customer_connections WHERE account_id = ?").get(accountId) as { n: number }).n;
    if (count >= 20) fail(409, "connection_limit", "Remove an old connected device before connecting another.");
    const token = secret();
    const connection: ConnectionRow = {
      id: crypto.randomUUID(), account_id: accountId, name,
      created_at: now, last_seen_at: null, expires_at: now + 90 * DAY,
    };
    db.query("INSERT INTO customer_connections(id,account_id,name,token_hash,created_at,last_seen_at,expires_at) VALUES(?,?,?,?,?,?,?)")
      .run(connection.id, accountId, name, hash(token), connection.created_at, null, connection.expires_at);
    return { token, connection: connectionDto(connection) };
  }
  async function destroyAccount(c: C, current: Auth) {
    rates.take(`sensitive:${current.account.id}`, 10, 15 * 60_000);
    const body = await jsonBody(c);
    if (!(await verifyPassword(passwordField(body, "password", false), current.account.password_hash))) fail(401, "invalid_credentials", "The password is incorrect.");
    const ownedFiles = db.query("SELECT file_path FROM customer_captures WHERE account_id = ? AND file_path IS NOT NULL").all(current.account.id) as { file_path: string }[];
    db.transaction(() => {
      const latest = auth(c, current.kind === "session");
      if (latest.kind !== current.kind || latest.credentialId !== current.credentialId || latest.account.password_hash !== current.account.password_hash) {
        fail(401, "invalid_credentials", "Your account access changed. Sign in again.");
      }
      revoke(current.account.id);
      db.query("DELETE FROM customer_preferences WHERE account_id = ?").run(current.account.id);
      db.query("DELETE FROM customer_captures WHERE account_id = ?").run(current.account.id);
      db.query("DELETE FROM customer_accounts WHERE id = ?").run(current.account.id);
    })();
    for (const file of ownedFiles) removeCustomerFile(config.dataDir, file.file_path);
  }
  function revoke(accountId: string, keepSession?: string) {
    if (keepSession) db.query("DELETE FROM customer_sessions WHERE account_id = ? AND id != ?").run(accountId, keepSession);
    else db.query("DELETE FROM customer_sessions WHERE account_id = ?").run(accountId);
    db.query("DELETE FROM customer_connections WHERE account_id = ?").run(accountId);
    db.query("DELETE FROM customer_pairings WHERE account_id = ?").run(accountId);
  }
  function usage(accountId: string) {
    const row = db.query("SELECT COUNT(*) captures, COALESCE(SUM(storage_bytes),0) bytes FROM customer_captures WHERE account_id = ?").get(accountId) as { captures: number; bytes: number };
    return { ...row, maxCaptures: MAX_CAPTURES, maxBytes: MAX_BYTES };
  }
  function findCapture(id: string, accountId: string) {
    const row = db.query(`SELECT ${CAPTURE_COLUMNS} FROM customer_captures WHERE id = ? AND account_id = ?`).get(id, accountId) as CustomerCaptureRow | null;
    if (!row) fail(404, "not_found", "Capture not found.");
    return row;
  }
  function publicRate(c: C, action: string, email?: string) {
    // clientIp is injected by the server, never read from a caller-controlled header.
    rates.take(`public:${action}:${c.env?.clientIp || "unknown"}`, action === "pair" ? 30 : 20, 15 * 60_000);
    if (email) rates.take(`email:${action}:${hash(email)}`, 10, 15 * 60_000);
  }

  app.onError((error, c) => {
    if (error instanceof CustomerError) {
      if (error.retryAfter !== undefined) c.header("Retry-After", String(error.retryAfter));
      else if (error.status === 429) c.header("Retry-After", "900");
      return c.json({ error: error.code, message: error.message }, error.status);
    }
    // Captured content and credentials must never be written into error logs.
    return c.json({ error: "internal_error", message: "Foundkeep could not complete the request. Please try again." }, 500);
  });
  app.use("*", async (c, next) => {
    c.header("Cache-Control", "private, no-store");
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Vary", "Origin");
    const requestOrigin = c.req.header("origin");
    const websiteOrigin = websiteOrigins.has(requestOrigin || "");
    const allowed = websiteOrigin || extensionOrigins.has(requestOrigin || "");
    if (allowed) {
      c.header("Access-Control-Allow-Origin", requestOrigin!);
      if (websiteOrigin) c.header("Access-Control-Allow-Credentials", "true");
    }
    if (c.req.method === "OPTIONS") {
      if (allowed) {
        c.header("Access-Control-Allow-Headers", "Authorization, Content-Type" + (websiteOrigin ? ", X-Atlas-Account" : ""));
        c.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        c.header("Access-Control-Max-Age", "600");
      }
      return c.body(null, 204);
    }
    if (!["GET", "HEAD"].includes(c.req.method) && requestOrigin && !allowed) fail(403, "invalid_origin", "This website cannot change your Foundkeep account.");
    await next();
  });

  app.post("/mobile/register", async (c) => {
    publicRate(c, "mobile-register");
    const body = await jsonBody(c);
    const email = emailField(body);
    const password = passwordField(body);
    const name = textField(body, "name", 100, true)!.trim();
    const deviceName = mobileDeviceName(body);
    if (emailAccount(email)) fail(409, "email_in_use", "An account with this email already exists. Sign in or use your recovery code.");
    const passwordHash = await hashPassword(password);
    const recoveryCode = secret();
    const id = crypto.randomUUID();
    const connection = db.transaction(() => {
      if (emailAccount(email)) fail(409, "email_in_use", "An account with this email already exists.");
      db.query("INSERT INTO customer_accounts(id,email,name,password_hash,recovery_hash,created_at) VALUES(?,?,?,?,?,?)")
        .run(id, email, name, passwordHash, hash(recoveryCode), Date.now());
      return issueConnection(id, deviceName);
    })();
    return c.json({ account: accountDto(account(id)!), recoveryCode, ...connection }, 201);
  });

  app.post("/mobile/login", async (c) => {
    publicRate(c, "mobile-login");
    const body = await jsonBody(c);
    const email = emailField(body);
    rates.take(`email:mobile-login:${hash(email)}`, 10, 15 * 60_000);
    const password = passwordField(body, "password", false);
    const deviceName = mobileDeviceName(body);
    const owner = emailAccount(email);
    if (!owner || !(await verifyPassword(password, owner.password_hash))) fail(401, "invalid_credentials", "Email or password is incorrect.");
    const result = db.transaction(() => {
      const current = account(owner.id);
      if (!current || current.password_hash !== owner.password_hash) fail(401, "invalid_credentials", "Sign in again with your current password.");
      return { account: accountDto(current), ...issueConnection(current.id, deviceName) };
    })();
    return c.json(result);
  });

  app.post("/mobile/recover", async (c) => {
    publicRate(c, "mobile-recover");
    const body = await jsonBody(c);
    const email = emailField(body);
    rates.take(`email:mobile-recover:${hash(email)}`, 10, 15 * 60_000);
    const recovery = textField(body, "recoveryCode", 128, true)!.trim();
    const password = passwordField(body);
    const deviceName = mobileDeviceName(body);
    const owner = emailAccount(email);
    if (!owner || hash(recovery) !== owner.recovery_hash) fail(401, "invalid_credentials", "Email or recovery code is incorrect.");
    const passwordHash = await hashPassword(password);
    const recoveryCode = secret();
    const result = db.transaction(() => {
      const updated = db.query("UPDATE customer_accounts SET password_hash = ?, recovery_hash = ? WHERE id = ? AND recovery_hash = ?")
        .run(passwordHash, hash(recoveryCode), owner.id, owner.recovery_hash);
      if (!updated.changes) fail(401, "invalid_credentials", "This recovery code has already been used.");
      revoke(owner.id);
      return { account: accountDto(account(owner.id)!), recoveryCode, ...issueConnection(owner.id, deviceName) };
    })();
    return c.json(result);
  });

  app.get("/mobile/me", (c) => {
    const current = auth(c);
    if (current.kind !== "connection") fail(403, "mobile_connection_required", "Connect Foundkeep on this device to continue.");
    return c.json({ account: accountDto(current.account), connectionId: current.credentialId, usage: usage(current.account.id) });
  });

  app.get("/mobile/notifications", (c) => {
    const current = auth(c);
    if (current.kind !== "connection") fail(403, "mobile_connection_required", "Connect Foundkeep on this device to continue.");
    const row = db.query("SELECT enabled FROM customer_push_devices WHERE connection_id=? AND account_id=?")
      .get(current.credentialId, current.account.id) as { enabled: number } | null;
    return c.json({ enabled: row?.enabled === 1 });
  });

  app.post("/mobile/notifications", async (c) => {
    const body = await jsonBody(c);
    const expoPushToken = body.expoPushToken;
    if (!isExpoPushToken(expoPushToken)) fail(400, "invalid_push_token", "Foundkeep could not register notifications on this device.");
    const current = auth(c);
    if (current.kind !== "connection") fail(403, "mobile_connection_required", "Connect Foundkeep on this device to continue.");
    const now = Date.now();
    db.transaction(() => {
      // A token can move when its physical device signs into another account.
      db.query("DELETE FROM customer_push_devices WHERE expo_push_token=? AND connection_id!=?")
        .run(expoPushToken, current.credentialId);
      db.query(`INSERT INTO customer_push_devices(connection_id,account_id,expo_push_token,enabled,created_at,updated_at)
        VALUES(?,?,?,?,?,?) ON CONFLICT(connection_id) DO UPDATE SET
        account_id=excluded.account_id,expo_push_token=excluded.expo_push_token,enabled=1,updated_at=excluded.updated_at`)
        .run(current.credentialId, current.account.id, expoPushToken, 1, now, now);
    })();
    return c.json({ ok: true });
  });

  app.delete("/mobile/notifications", (c) => {
    const current = auth(c);
    if (current.kind !== "connection") fail(403, "mobile_connection_required", "Connect Foundkeep on this device to continue.");
    db.query("DELETE FROM customer_push_devices WHERE connection_id=? AND account_id=?")
      .run(current.credentialId, current.account.id);
    return c.json({ ok: true });
  });

  app.post("/mobile/logout", (c) => {
    const current = auth(c);
    if (current.kind !== "connection") fail(403, "mobile_connection_required", "Connect Foundkeep on this device to continue.");
    db.query("DELETE FROM customer_connections WHERE id = ? AND account_id = ?").run(current.credentialId, current.account.id);
    return c.json({ ok: true });
  });

  app.delete("/mobile/account", async (c) => {
    const current = auth(c);
    if (current.kind !== "connection") fail(403, "mobile_connection_required", "Connect Foundkeep on this device to continue.");
    await destroyAccount(c, current);
    return c.json({ ok: true });
  });

  app.post("/auth/register", async (c) => {
    website(c);
    publicRate(c, "register");
    const body = await jsonBody(c);
    const email = emailField(body);
    const password = passwordField(body);
    const name = textField(body, "name", 100, true)!.trim();
    if (emailAccount(email)) fail(409, "email_in_use", "An account with this email already exists. Sign in or use your recovery code.");
    const passwordHash = await hashPassword(password);
    const recoveryCode = secret();
    const id = crypto.randomUUID();
    db.transaction(() => {
      if (emailAccount(email)) fail(409, "email_in_use", "An account with this email already exists.");
      db.query("INSERT INTO customer_accounts(id,email,name,password_hash,recovery_hash,created_at) VALUES(?,?,?,?,?,?)").run(id, email, name, passwordHash, hash(recoveryCode), Date.now());
      session(c, id);
    })();
    return c.json({ account: accountDto(account(id)!), recoveryCode }, 201);
  });

  app.post("/auth/login", async (c) => {
    website(c);
    publicRate(c, "login");
    const body = await jsonBody(c);
    const email = emailField(body);
    rates.take(`email:login:${hash(email)}`, 10, 15 * 60_000);
    const password = passwordField(body, "password", false);
    const owner = emailAccount(email);
    if (!owner || !(await verifyPassword(password, owner.password_hash))) fail(401, "invalid_credentials", "Email or password is incorrect.");
    const current = account(owner.id);
    if (!current || current.password_hash !== owner.password_hash) fail(401, "invalid_credentials", "Sign in again with your current password.");
    session(c, owner.id);
    return c.json({ account: accountDto(current) });
  });

  app.post("/auth/recover", async (c) => {
    website(c);
    publicRate(c, "recover");
    const body = await jsonBody(c);
    const email = emailField(body);
    rates.take(`email:recover:${hash(email)}`, 10, 15 * 60_000);
    const recovery = textField(body, "recoveryCode", 128, true)!.trim();
    const password = passwordField(body);
    const owner = emailAccount(email);
    if (!owner || hash(recovery) !== owner.recovery_hash) fail(401, "invalid_credentials", "Email or recovery code is incorrect.");
    const passwordHash = await hashPassword(password);
    const recoveryCode = secret();
    db.transaction(() => {
      const result = db.query("UPDATE customer_accounts SET password_hash = ?, recovery_hash = ? WHERE id = ? AND recovery_hash = ?").run(passwordHash, hash(recoveryCode), owner.id, owner.recovery_hash);
      if (!result.changes) fail(401, "invalid_credentials", "This recovery code has already been used.");
      revoke(owner.id);
      session(c, owner.id);
    })();
    return c.json({ account: accountDto(owner), recoveryCode });
  });

  app.post("/auth/logout", (c) => {
    website(c);
    // Expired or already revoked sessions can still clear their browser cookie.
    const token = getCookie(c, cookieName);
    if (token) {
      const current = db.query("SELECT account_id FROM customer_sessions WHERE token_hash = ? AND expires_at > ?").get(hash(token), Date.now()) as { account_id: string } | null;
      if (current && account(current.account_id)) accountIntent(c, current.account_id);
      db.query("DELETE FROM customer_sessions WHERE token_hash = ?").run(hash(token));
    }
    deleteCookie(c, cookieName, cookieOptions);
    return c.json({ ok: true });
  });

  app.get("/me", (c) => {
    const { account: owner } = auth(c, true);
    const connections = db.query("SELECT id,account_id,name,created_at,last_seen_at,expires_at FROM customer_connections WHERE account_id = ? AND expires_at > ? ORDER BY created_at DESC").all(owner.id, Date.now()) as ConnectionRow[];
    return c.json({ account: accountDto(owner), connections: connections.map(connectionDto), usage: usage(owner.id) });
  });

  app.post("/auth/password", async (c) => {
    const current = auth(c, true);
    rates.take(`sensitive:${current.account.id}`, 10, 15 * 60_000);
    const body = await jsonBody(c);
    const old = passwordField(body, "currentPassword", false);
    const password = passwordField(body);
    if (!(await verifyPassword(old, current.account.password_hash))) fail(401, "invalid_credentials", "The current password is incorrect.");
    const passwordHash = await hashPassword(password);
    const recoveryCode = secret();
    db.transaction(() => {
      // The authenticated session may have been revoked while Argon2 was running.
      const latest = auth(c, true);
      if (latest.account.password_hash !== current.account.password_hash) fail(401, "invalid_credentials", "Your password changed. Sign in again.");
      db.query("UPDATE customer_accounts SET password_hash = ?, recovery_hash = ? WHERE id = ?").run(passwordHash, hash(recoveryCode), current.account.id);
      revoke(current.account.id, current.credentialId);
    })();
    return c.json({ ok: true, recoveryCode });
  });

  app.delete("/account", async (c) => {
    const current = auth(c, true);
    await destroyAccount(c, current);
    deleteCookie(c, cookieName, cookieOptions);
    return c.json({ ok: true });
  });

  app.get("/account/export", (c) => {
    const current = auth(c, true);
    rates.take(`export:${current.account.id}`, 3, 60_000);
    const ids = db.query("SELECT id FROM customer_captures WHERE account_id = ? ORDER BY captured_at DESC,id DESC").all(current.account.id) as { id: string }[];
    const preferenceState = readCustomerPreferences(db, current.account.id);
    // Only one image/record is materialized at a time; a quota-sized export must
    // not multiply its entire image footprint in memory.
    const encoder = new TextEncoder();
    let index = 0;
    let started = false;
    let first = true;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        try {
          auth(c, true, false);
          if (!started) {
            started = true;
            controller.enqueue(encoder.encode(JSON.stringify({ account: accountDto(current.account), exportedAt: Date.now(), preferences: preferenceState.preferences, preferenceRevision: preferenceState.revision, preferencesUpdatedAt: preferenceState.updatedAt }).slice(0, -1) + ',"captures":['));
            return;
          }
          while (index < ids.length) {
            const row = db.query("SELECT * FROM customer_captures WHERE id = ? AND account_id = ?").get(ids[index++]!.id, current.account.id) as CustomerCaptureRow | null;
            if (!row) continue;
            const dataUrl = row.blob_data && row.blob_mime ? `data:${row.blob_mime};base64,${Buffer.from(row.blob_data).toString("base64")}` : null;
            controller.enqueue(encoder.encode((first ? "" : ",") + JSON.stringify({ ...customerCaptureDto(row), dataUrl })));
            first = false;
            return;
          }
          controller.enqueue(encoder.encode("]}"));
          controller.close();
        } catch { controller.error(new Error("Export interrupted. Sign in and try again.")); }
      },
    });
    c.header("Content-Type", "application/json; charset=utf-8");
    c.header("Content-Disposition", 'attachment; filename="atlas-export.json"');
    return c.body(stream);
  });

  app.post("/pairing", (c) => {
    const current = auth(c, true);
    rates.take(`pairing:${current.account.id}`, 20, 15 * 60_000);
    const code = secret();
    const now = Date.now();
    const expiresAt = now + 5 * 60_000;
    db.transaction(() => {
      db.query("DELETE FROM customer_pairings WHERE account_id = ? OR expires_at <= ?").run(current.account.id, now);
      db.query("INSERT INTO customer_pairings(id,account_id,code_hash,created_at,expires_at) VALUES(?,?,?,?,?)").run(crypto.randomUUID(), current.account.id, hash(code), now, expiresAt);
    })();
    return c.json({ code, expiresAt });
  });

  app.post("/pairing/claim", async (c) => {
    publicRate(c, "pair");
    const body = await jsonBody(c);
    const code = textField(body, "code", 128, true)!;
    const name = (textField(body, "name", 100) || "Chrome browser").trim() || "Chrome browser";
    const result = db.transaction(() => {
      const pair = db.query("SELECT * FROM customer_pairings WHERE code_hash = ? AND expires_at > ?").get(hash(code), Date.now()) as CredentialRow | null;
      if (!pair) fail(401, "invalid_pairing", "This connection code expired or was already used. Try connecting again.");
      const owner = account(pair.account_id);
      if (!owner) fail(401, "invalid_pairing", "This connection code is no longer valid.");
      db.query("DELETE FROM customer_pairings WHERE id = ?").run(pair.id);
      return { account: accountDto(owner), ...issueConnection(owner.id, name) };
    })();
    return c.json(result, 201);
  });

  app.post("/connections/disconnect", (c) => {
    const current = auth(c);
    if (current.kind !== "connection") fail(403, "browser_connection_required", "Disconnect using the connected browser, or remove it in your account settings.");
    // Caller-supplied IDs are never used: a browser can only revoke the
    // credential that authorized this request, including during replacement.
    db.query("DELETE FROM customer_connections WHERE id = ? AND account_id = ?").run(current.credentialId, current.account.id);
    return c.json({ ok: true });
  });

  app.delete("/connections/:id", (c) => {
    const current = auth(c, true);
    const result = db.query("DELETE FROM customer_connections WHERE id = ? AND account_id = ?").run(c.req.param("id"), current.account.id);
    if (!result.changes) fail(404, "not_found", "Browser connection not found.");
    return c.json({ ok: true });
  });

  app.get("/preferences", (c) => {
    const current = auth(c);
    return c.json(readCustomerPreferences(db, current.account.id));
  });

  app.put("/preferences", async (c) => {
    const current = auth(c, true);
    const body = await jsonBody(c);
    try {
      const result = db.transaction(() => {
        const verified = auth(c, true, false);
        if (verified.account.id !== current.account.id || verified.credentialId !== current.credentialId) {
          fail(401, "unauthorized", "Your session expired. Sign in again.");
        }
        return writeCustomerPreferences(db, current.account.id, body);
      })();
      return c.json(result);
    } catch (error) {
      if (error instanceof PreferenceValidationError) fail(400, "invalid_preferences", error.message);
      throw error;
    }
  });

  app.get("/captures", (c) => {
    const current = auth(c, true);
    const search = c.req.query("q") || "";
    const type = c.req.query("type") || "";
    if (search.length > 200 || (type && !TYPES.has(type))) fail(400, "invalid_filter", "Choose a valid capture type or a shorter search.");
    const rawLimit = c.req.query("limit") || "60";
    if (!/^\d+$/.test(rawLimit) || Number(rawLimit) < 1) fail(400, "invalid_limit", "Use a positive result limit.");
    const limit = Math.min(100, Number(rawLimit));
    const where = ["account_id = ?"];
    const args: (string | number)[] = [current.account.id];
    if (type) { where.push("type = ?"); args.push(type); }
    if (search) {
      const like = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
      where.push("(source_title LIKE ? ESCAPE '\\' OR note_text LIKE ? ESCAPE '\\' OR selection_text LIKE ? ESCAPE '\\' OR article_text LIKE ? ESCAPE '\\' OR summary LIKE ? ESCAPE '\\' OR ocr_text LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\')");
      args.push(...Array(7).fill(like));
    }
    const total = (db.query(`SELECT COUNT(*) n FROM customer_captures WHERE ${where.join(" AND ")}`).get(...args) as { n: number }).n;
    const cursor = c.req.query("cursor");
    if (cursor) {
      let value: unknown;
      try { if (cursor.length > 300) throw new Error(); value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")); } catch { fail(400, "invalid_cursor", "This page cursor is invalid."); }
      if (!Array.isArray(value) || value.length !== 2 || !Number.isSafeInteger(value[0]) || typeof value[1] !== "string" || value[1].length > 64) fail(400, "invalid_cursor", "This page cursor is invalid.");
      where.push("(captured_at < ? OR (captured_at = ? AND id < ?))");
      args.push(value[0], value[0], value[1]);
    }
    const rows = db.query(`SELECT ${CAPTURE_COLUMNS} FROM customer_captures WHERE ${where.join(" AND ")} ORDER BY captured_at DESC, id DESC LIMIT ?`).all(...args, limit + 1) as CustomerCaptureRow[];
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    const nextCursor = hasMore && last ? Buffer.from(JSON.stringify([last.captured_at, last.id])).toString("base64url") : null;
    return c.json({ captures: page.map(customerCaptureDto), nextCursor, total });
  });

  app.post("/captures", async (c) => {
    const current = auth(c);
    rates.take(`upload:${current.account.id}`, 120, 60_000);
    const release = acquireUpload(current.account.id);
    try {
    const body = await jsonBody(c, MAX_BODY);
    const clientId = textField(body, "clientId", 128, true)!;
    const type = textField(body, "type", 20, true)!;
    if (!TYPES.has(type)) fail(400, "invalid_type", "Choose a supported capture type.");
    const batchId = textField(body, "batchId", 64);
    if (batchId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(batchId)) fail(400, "invalid_batch", "The shared collection identifier is invalid.");
    const sourceUrl = textField(body, "sourceUrl", 4096);
    if (sourceUrl) {
      let url: URL;
      try { url = new URL(sourceUrl); } catch { fail(400, "invalid_url", "Use an http or https source URL."); }
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) fail(400, "invalid_url", "Use an http or https source URL without credentials.");
    }
    const sourceTitle = textField(body, "sourceTitle", 1000);
    const selectionText = textField(body, "selectionText", 50_000);
    const noteText = textField(body, "noteText", 50_000);
    const articleText = textField(body, "articleText", 500_000);
    const image = decodeImage(body.dataUrl);
    function dimension(key: string) {
      const value = body[key];
      if (value === undefined || value === null) return null;
      if (!Number.isInteger(value) || (value as number) <= 0 || (value as number) > 32768) fail(400, "invalid_dimensions", "Image dimensions must be positive and at most 32768 pixels.");
      return value as number;
    }
    const width = image.width ?? dimension("width");
    const height = image.height ?? dimension("height");
    const capturedAt = body.capturedAt ?? Date.now();
    if (!Number.isSafeInteger(capturedAt) || (capturedAt as number) < 0 || (capturedAt as number) > Date.now() + DAY) fail(400, "invalid_date", "Use a valid capture timestamp in milliseconds.");
    let provenance, processingOptions;
    try {
      provenance = normalizeProvenance(body.provenance, capturedAt as number);
      processingOptions = normalizeProcessingOptions(body.processingOptions);
    } catch (error) {
      if (error instanceof ProvenanceValidationError) fail(400, "invalid_capture_context", error.message);
      throw error;
    }
    const provenanceJson = provenance ? JSON.stringify(provenance) : null;
    const processingOptionsJson = JSON.stringify(processingOptions);
    const storageBytes = image.bytes + [sourceUrl, sourceTitle, selectionText, noteText, articleText, clientId, batchId, provenanceJson, processingOptionsJson].reduce((sum, text) => sum + Buffer.byteLength(text || "", "utf8"), 0);
    const result = db.transaction(() => {
      // Authentication must still hold after the streamed body was received.
      auth(c);
      const existing = db.query(`SELECT ${CAPTURE_COLUMNS} FROM customer_captures WHERE account_id = ? AND client_id = ?`).get(current.account.id, clientId) as CustomerCaptureRow | null;
      if (existing) return { capture: customerCaptureDto(existing), duplicate: true };
      const used = usage(current.account.id);
      if (used.captures >= MAX_CAPTURES || used.bytes + storageBytes > MAX_BYTES) fail(409, "quota_exceeded", "Your Foundkeep storage is full. Export or delete some captures to continue.");
      const global = db.query("SELECT COUNT(*) captures, COALESCE(SUM(storage_bytes),0) bytes FROM customer_captures").get() as { captures: number; bytes: number };
      if (global.captures >= globalMaxCaptures || global.bytes + storageBytes > globalMaxBytes) fail(503, "storage_unavailable", "Foundkeep storage is temporarily full. Your extension will keep this capture locally.");
      const id = crypto.randomUUID();
      const now = Date.now();
      db.query("INSERT INTO customer_captures(id,account_id,client_id,batch_id,type,source_url,source_title,selection_text,note_text,article_text,blob_data,blob_mime,blob_bytes,storage_bytes,width,height,captured_at,created_at,updated_at,provenance_json,processing_options_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(id, current.account.id, clientId, batchId, type, sourceUrl, sourceTitle, selectionText, noteText, articleText, image.data, image.mime, image.bytes, storageBytes, width, height, capturedAt as number, now, now, provenanceJson, processingOptionsJson);
      return { capture: customerCaptureDto(findCapture(id, current.account.id)), duplicate: false };
    })();
    return c.json(result, result.duplicate ? 200 : 201);
    } finally { release(); }
  });

  app.post("/mobile/captures/file", async (c) => {
    const current = auth(c);
    if (current.kind !== "connection") fail(403, "mobile_connection_required", "Connect Foundkeep on this device to continue.");
    rates.take(`upload:${current.account.id}`, 120, 60_000);
    let body: JsonObject;
    try { body = decodeCaptureHeader(c.req.header("x-foundkeep-capture") || null); }
    catch (error) {
      if (error instanceof CustomerFileError) fail(error.status, error.code, error.message);
      throw error;
    }
    const clientId = textField(body, "clientId", 128, true)!;
    const type = textField(body, "type", 20, true)!;
    if (!["image", "video", "audio", "document", "file"].includes(type)) fail(400, "invalid_type", "Choose a supported file type.");
    const batchId = textField(body, "batchId", 64);
    if (batchId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(batchId)) fail(400, "invalid_batch", "The shared collection identifier is invalid.");
    const existing = db.query(`SELECT ${CAPTURE_COLUMNS} FROM customer_captures WHERE account_id=? AND client_id=?`).get(current.account.id, clientId) as CustomerCaptureRow | null;
    if (existing) {
      void c.req.raw.body?.cancel();
      return c.json({ capture: customerCaptureDto(existing), duplicate: true });
    }
    const sourceUrl = textField(body, "sourceUrl", 4096);
    if (sourceUrl) {
      try {
        const url = new URL(sourceUrl);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
      } catch { fail(400, "invalid_url", "Use an http or https source URL without credentials."); }
    }
    const sourceTitle = textField(body, "sourceTitle", 1000);
    const noteText = textField(body, "noteText", 50_000);
    const fileName = safeFileName(textField(body, "fileName", 500) || "Shared file");
    const capturedAt = body.capturedAt ?? Date.now();
    if (!Number.isSafeInteger(capturedAt) || (capturedAt as number) < 0 || (capturedAt as number) > Date.now() + DAY) fail(400, "invalid_date", "Use a valid capture timestamp in milliseconds.");
    let provenance, processingOptions;
    try {
      provenance = normalizeProvenance(body.provenance, capturedAt as number);
      processingOptions = normalizeProcessingOptions(body.processingOptions);
    } catch (error) {
      if (error instanceof ProvenanceValidationError) fail(400, "invalid_capture_context", error.message);
      throw error;
    }
    const provenanceJson = provenance ? JSON.stringify(provenance) : null;
    const processingOptionsJson = JSON.stringify(processingOptions);
    const release = acquireUpload(current.account.id);
    let stored: Awaited<ReturnType<typeof writeCustomerFile>> | null = null;
    try {
      try { stored = await writeCustomerFile(c.req.raw, { root: config.dataDir }); }
      catch (error) {
        if (error instanceof CustomerFileError) fail(error.status, error.code, error.message);
        throw error;
      }
      if (type === "image" && !stored.mime.startsWith("image/")) fail(415, "invalid_file_type", "The shared image data is invalid.");
      if (provenance?.contentHash && provenance.contentHash !== stored.sha256) fail(400, "content_hash_mismatch", "The shared file does not match its source record.");
      const storageBytes = stored.bytes + [clientId, batchId, sourceUrl, sourceTitle, noteText, fileName, provenanceJson, processingOptionsJson]
        .reduce((sum, value) => sum + Buffer.byteLength(value || "", "utf8"), 0);
      const result = db.transaction(() => {
        auth(c);
        const duplicate = db.query(`SELECT ${CAPTURE_COLUMNS} FROM customer_captures WHERE account_id=? AND client_id=?`).get(current.account.id, clientId) as CustomerCaptureRow | null;
        if (duplicate) return { capture: customerCaptureDto(duplicate), duplicate: true };
        const used = usage(current.account.id);
        if (used.captures >= MAX_CAPTURES || used.bytes + storageBytes > MAX_BYTES) fail(409, "quota_exceeded", "Your Foundkeep storage is full. Export or delete some captures to continue.");
        const global = db.query("SELECT COUNT(*) captures, COALESCE(SUM(storage_bytes),0) bytes FROM customer_captures").get() as { captures: number; bytes: number };
        if (global.captures >= globalMaxCaptures || global.bytes + storageBytes > globalMaxBytes) fail(503, "storage_unavailable", "Foundkeep storage is temporarily full. Your device will keep this capture queued.");
        const id = crypto.randomUUID();
        const now = Date.now();
        db.query(`INSERT INTO customer_captures(
          id,account_id,client_id,batch_id,type,source_url,source_title,note_text,
          storage_bytes,captured_at,created_at,updated_at,provenance_json,processing_options_json,
          file_name,file_path,file_mime,file_bytes
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
          id,current.account.id,clientId,batchId,type,sourceUrl,sourceTitle,noteText,
          storageBytes,capturedAt as number,now,now,provenanceJson,processingOptionsJson,
          fileName,stored!.relativePath,stored!.mime,stored!.bytes,
        );
        return { capture: customerCaptureDto(findCapture(id, current.account.id)), duplicate: false };
      })();
      if (result.duplicate) removeCustomerFile(config.dataDir, stored.relativePath);
      else stored = null;
      return c.json(result, result.duplicate ? 200 : 201);
    } finally {
      if (stored) removeCustomerFile(config.dataDir, stored.relativePath);
      release();
    }
  });

  app.get("/mobile/captures", (c) => {
    const current = auth(c);
    if (current.kind !== "connection") fail(403, "mobile_connection_required", "Connect Foundkeep on this device to continue.");
    const search = c.req.query("q") || "";
    const type = c.req.query("type") || "";
    const cursor = mobileCursor(c.req.query("cursor") || "");
    if (search.length > 200 || (type && !TYPES.has(type))) fail(400, "invalid_filter", "Choose a valid capture type or a shorter search.");
    const where = ["account_id = ?"];
    const args: (string | number)[] = [current.account.id];
    if (type) { where.push("type = ?"); args.push(type); }
    if (search) {
      const like = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
      where.push("(source_title LIKE ? ESCAPE '\\' OR note_text LIKE ? ESCAPE '\\' OR selection_text LIKE ? ESCAPE '\\' OR article_text LIKE ? ESCAPE '\\' OR summary LIKE ? ESCAPE '\\' OR ocr_text LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\')");
      args.push(...Array(7).fill(like));
    }
    const total = (db.query(`SELECT COUNT(*) count FROM customer_captures WHERE ${where.join(" AND ")}`).get(...args) as { count: number }).count;
    if (cursor) {
      where.push("(captured_at < ? OR (captured_at = ? AND id < ?))");
      args.push(cursor.capturedAt, cursor.capturedAt, cursor.id);
    }
    const rows = db.query(`SELECT ${CAPTURE_COLUMNS} FROM customer_captures WHERE ${where.join(" AND ")} ORDER BY captured_at DESC,id DESC LIMIT 51`).all(...args) as CustomerCaptureRow[];
    const page = rows.slice(0, 50);
    return c.json({ captures: page.map(customerCaptureDto), nextCursor: rows.length > 50 ? encodeMobileCursor(page.at(-1)!) : null, total });
  });

  function serveCustomerFile(c: C, cookieOnly: boolean) {
    const current = auth(c, cookieOnly);
    const row = db.query("SELECT file_path,file_name,file_mime FROM customer_captures WHERE id=? AND account_id=?").get(c.req.param("id"), current.account.id) as { file_path: string | null; file_name: string | null; file_mime: string | null } | null;
    if (!row?.file_path || !row.file_mime) fail(404, "not_found", "File not found.");
    let path: string;
    try { path = resolveCustomerFile(config.dataDir, row.file_path); } catch { fail(404, "not_found", "File not found."); }
    const file = Bun.file(path);
    if (!file.size) fail(404, "not_found", "File not found.");
    c.header("Content-Type", row.file_mime);
    c.header("Content-Disposition", fileDisposition(row.file_mime, row.file_name || "Shared file"));
    c.header("Content-Security-Policy", "default-src 'none'; sandbox");
    c.header("Cross-Origin-Resource-Policy", "same-origin");
    return c.body(file.stream());
  }

  app.get("/captures/:id/file", (c) => serveCustomerFile(c, true));
  app.get("/mobile/captures/:id/file", (c) => serveCustomerFile(c, false));
  app.get("/mobile/captures/:id", (c) => {
    const current = auth(c);
    return c.json({ capture: customerCaptureDto(findCapture(c.req.param("id"), current.account.id)) });
  });
  app.delete("/mobile/captures/:id", (c) => {
    const current = auth(c);
    const row = db.query("SELECT file_path FROM customer_captures WHERE id=? AND account_id=?").get(c.req.param("id"), current.account.id) as { file_path: string | null } | null;
    if (!row) fail(404, "not_found", "Capture not found.");
    db.query("DELETE FROM customer_captures WHERE id=? AND account_id=?").run(c.req.param("id"), current.account.id);
    removeCustomerFile(config.dataDir, row.file_path);
    return c.json({ ok: true });
  });

  app.get("/captures/:id/blob", (c) => {
    const current = auth(c, true);
    const row = db.query("SELECT blob_data,blob_mime FROM customer_captures WHERE id = ? AND account_id = ?").get(c.req.param("id"), current.account.id) as { blob_data: Uint8Array | null; blob_mime: string | null } | null;
    if (!row?.blob_data || !row.blob_mime || !["image/png", "image/jpeg", "image/webp"].includes(row.blob_mime)) fail(404, "not_found", "Image not found.");
    c.header("Content-Type", row.blob_mime);
    c.header("Content-Security-Policy", "default-src 'none'; sandbox");
    c.header("Cross-Origin-Resource-Policy", "same-origin");
    return c.body(new Uint8Array(row.blob_data).buffer);
  });

  app.get("/captures/:id", (c) => {
    const current = auth(c, true);
    return c.json({ capture: customerCaptureDto(findCapture(c.req.param("id"), current.account.id)) });
  });
  app.delete("/captures/:id", (c) => {
    const current = auth(c, true);
    const row = db.query("SELECT file_path FROM customer_captures WHERE id = ? AND account_id = ?").get(c.req.param("id"), current.account.id) as { file_path: string | null } | null;
    if (!row) fail(404, "not_found", "Capture not found.");
    const deleted = db.query("DELETE FROM customer_captures WHERE id = ? AND account_id = ?").run(c.req.param("id"), current.account.id);
    if (!deleted.changes) fail(404, "not_found", "Capture not found.");
    removeCustomerFile(config.dataDir, row.file_path);
    return c.json({ ok: true });
  });
  app.all("*", (c) => c.json({ error: "not_found", message: "API route not found." }, 404));
  return app;
}
