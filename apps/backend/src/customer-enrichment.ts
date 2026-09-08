import type { Database } from "bun:sqlite";
import { DEFAULT_PROCESSING_OPTIONS, parseStoredJson, type ProcessingOptions } from "./customer-provenance.ts";
import { deliverCaptureNotification } from "./customer-notifications.ts";

type Content = {
  type: string;
  source_title?: string | null;
  source_url?: string | null;
  note_text?: string | null;
  selection_text?: string | null;
  article_text?: string | null;
  ocr_text?: string | null;
};
type Row = Content & {
  id: string; account_id: string; blob_data: Uint8Array | null;
  blob_mime: string | null; enrich_attempts: number;
  processing_options_json: string | null;
};
const STOP = new Set("about after again also always another before being between both could does each from have here into just more most much must only other over same should some such than that their them then there these they this those through under very were what when where which while will with would your http https www com ignore instructions".split(" "));
const TOPICS: [string, RegExp][] = [
  ["design", /\b(design|typography|layout|interface|figma|palette|ux|ui)\b/i],
  ["code", /\b(javascript|typescript|python|code|programming|api|function|react|database|github)\b/i],
  ["reading", /\b(research|study|article|journal|paper|book|reading)\b/i],
  ["travel", /\b(travel|flight|hotel|itinerary|airport|destination)\b/i],
  ["food", /\b(recipe|cooking|ingredient|restaurant|bake|dinner|lunch)\b/i],
];

/** Extractive organization: captured content is data, never executable instructions. */
export function organizeText(row: Content) {
  const body = (row.article_text || row.selection_text || row.note_text || row.ocr_text || "").replace(/\s+/g, " ").trim();
  const text = [row.source_title, body].filter(Boolean).join(" ").slice(0, 100_000);
  const counts = new Map<string, number>();
  for (const word of text.toLowerCase().match(/[\p{L}][\p{L}\p{N}-]{3,29}/gu) || []) {
    if (!STOP.has(word)) counts.set(word, (counts.get(word) || 0) + 1);
  }
  const tags = [...counts].sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0])).slice(0,5).map(([word])=>word);
  const category = TOPICS.find(([,pattern])=>pattern.test(text))?.[0]
    || ({note:"notes",bookmark:"links",selection:"highlights",tweet:"social",image:"images",screenshot:"screenshots"}[row.type] ?? "reference");
  const fallback = row.source_title || (row.source_url ? new URL(row.source_url).hostname : null) || ({image:"Saved image",screenshot:"Saved screenshot",note:"Saved note"}[row.type] ?? "Saved capture");
  const summaryText = body || fallback;
  const summary = summaryText.length > 260 ? summaryText.slice(0,256).replace(/\s+\S*$/, "") + "…" : summaryText;
  return { summary, category, tags };
}

/** Fixed command, no shell, no network, no model/tool access. Enforce CPU, RAM,
 * wall time and output bounds around the image parser; one image runs at a time. */
export async function recognizeImage(bytes: Uint8Array): Promise<string> {
  const binary = Bun.which("tesseract");
  const limiter = Bun.which("prlimit");
  if (!binary || !limiter) throw new Error("OCR runtime unavailable");
  const process = Bun.spawn([
    limiter, "--as=805306368", "--cpu=18", "--fsize=1048576", "--",
    binary, "stdin", "stdout", "-l", "eng", "--psm", "11",
  ], {
    stdin: new Blob([bytes]), stdout: "pipe", stderr: "ignore",
    env: { PATH: "/usr/bin:/bin", LANG: "C.UTF-8", OMP_THREAD_LIMIT: "1" },
  });
  const timeout = setTimeout(() => process.kill(9), 20_000);
  let text = "";
  let total = 0;
  const reader = process.stdout.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      const {done,value} = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 256_000) { process.kill(9); throw new Error("OCR output limit"); }
      text += decoder.decode(value, {stream:true});
    }
    text += decoder.decode();
    if (await process.exited !== 0) throw new Error("OCR did not complete");
    return text.trim().slice(0,100_000);
  } finally {
    clearTimeout(timeout);
    reader.releaseLock();
    // On a read/output error, reap the process before accepting another image.
    if (process.exitCode === null) process.kill(9);
    await process.exited;
  }
}

type Notification = { accountId: string; captureId: string; status: "done" | "failed" };
type Options = {
  ocr?: (bytes: Uint8Array) => Promise<string>;
  batchSize?: number;
  now?: () => number;
  notify?: (value: Notification) => Promise<unknown>;
};
const RETRY_MS = 120_000;
const LEASE_MS = 120_000;
const ACCOUNT_MAX_BYTES = 200 * 1024 * 1024;
const RECOGNITION_ERROR = "Saved safely. Text recognition could not finish. Search by the page title or source.";
const STORAGE_ERROR = "Saved safely. Some searchable text was omitted because storage is full.";

type Derived = { summary: string | null; ocr_text: string | null; category: string | null; tags: string };
function derivedBytes(value: Derived) {
  // Empty tags and fixed bookkeeping (status, error message) are metadata, as
  // they are on initial ingest. All generated customer content counts as data.
  return Buffer.byteLength(value.summary || "", "utf8")
    + Buffer.byteLength(value.ocr_text || "", "utf8")
    + Buffer.byteLength(value.category || "", "utf8")
    + (value.tags && value.tags !== "[]" ? Buffer.byteLength(value.tags, "utf8") : 0);
}

function fitDerived(wanted: Derived, budget: number): Derived {
  let remaining = Math.max(0, Math.floor(budget));
  function takeText(text: string | null) {
    if (!text || !remaining) return null;
    const bytes = Buffer.from(text, "utf8");
    let end = Math.min(bytes.length, remaining);
    // A truncated multibyte character must not become replacement text or
    // consume more bytes than the remaining quota permits.
    while (end > 0 && end < bytes.length && (bytes[end]! & 0xc0) === 0x80) end--;
    const kept = bytes.subarray(0, end).toString("utf8");
    remaining -= end;
    return kept || null;
  }
  const summary = takeText(wanted.summary);
  let category: string | null = null;
  if (wanted.category && Buffer.byteLength(wanted.category, "utf8") <= remaining) category = takeText(wanted.category);
  const keptTags: string[] = [];
  for (const tag of JSON.parse(wanted.tags) as string[]) {
    const candidate = [...keptTags, tag];
    if (Buffer.byteLength(JSON.stringify(candidate), "utf8") <= remaining) keptTags.push(tag);
  }
  const tags = JSON.stringify(keptTags);
  if (keptTags.length) remaining -= Buffer.byteLength(tags, "utf8");
  const ocr_text = takeText(wanted.ocr_text);
  return { summary, category, tags, ocr_text };
}

function finalizeCapture(db: Database, row: Row, stamp: number, updatedAt: number, status: "done" | "failed", wanted: Derived) {
  return db.transaction(() => {
    // OCR yields to uploads, deletes, account recovery and other workers. Read
    // ownership, lease and current usage together only when ready to commit.
    const current = db.query(`SELECT summary,ocr_text,category,tags,storage_bytes
      FROM customer_captures WHERE id=? AND account_id=? AND status='processing'
        AND processing_at=? AND EXISTS(SELECT 1 FROM customer_accounts WHERE id=?)`)
      .get(row.id,row.account_id,stamp,row.account_id) as (Derived & { storage_bytes: number }) | null;
    if (!current) return false;
    const used = db.query(`SELECT COALESCE(SUM(storage_bytes),0) total,
      COALESCE(SUM(CASE WHEN account_id=? THEN storage_bytes ELSE 0 END),0) owner
      FROM customer_captures`).get(row.account_id) as { total: number; owner: number };
    const configured = process.env.ATLAS_CUSTOMER_GLOBAL_MAX_BYTES;
    const globalMax = configured && /^\d+$/.test(configured) && Number(configured) > 0
      ? Number(configured) : 2 * 1024 * 1024 * 1024;
    const previousBytes = derivedBytes(current);
    const baseBytes = Math.max(0,current.storage_bytes - previousBytes);
    const available = Math.max(0,Math.min(ACCOUNT_MAX_BYTES-used.owner,globalMax-used.total)+previousBytes);
    const kept = fitDerived(wanted,available);
    const omitted = kept.summary !== wanted.summary || kept.ocr_text !== wanted.ocr_text
      || kept.category !== wanted.category || kept.tags !== wanted.tags;
    // Edits can advance the revision while OCR awaits. Every worker write must
    // advance the stored value too, including within the same clock tick.
    const result = db.query(`UPDATE customer_captures SET status=?,summary=?,ocr_text=?,category=?,tags=?,
      storage_bytes=?,enrich_error=?,processing_at=NULL,updated_at=MAX(updated_at+1,?)
      WHERE id=? AND account_id=? AND status='processing' AND processing_at=?`)
      .run(status,kept.summary,kept.ocr_text,kept.category,kept.tags,baseBytes+derivedBytes(kept),
        status === "failed" ? RECOGNITION_ERROR : omitted ? STORAGE_ERROR : null,
        updatedAt,row.id,row.account_id,stamp);
    return result.changes === 1;
  }).immediate();
}

export async function processCustomerQueue(db: Database, options: Options = {}): Promise<number> {
  const now = options.now || Date.now;
  let processed = 0;
  for (let index=0; index<(options.batchSize || 4); index++) {
    const stamp = now();
    const row = db.query(`UPDATE customer_captures SET status='processing',
      processing_at=?, enrich_attempts=enrich_attempts+1, updated_at=MAX(updated_at+1,?)
      WHERE id=(SELECT id FROM customer_captures WHERE enrich_attempts<3 AND
        (status='pending' OR (status='failed' AND updated_at<?) OR
         (status='processing' AND COALESCE(processing_at,0)<?))
        ORDER BY created_at,id LIMIT 1)
      RETURNING id,account_id,type,source_title,source_url,note_text,selection_text,
        article_text,ocr_text,blob_data,blob_mime,enrich_attempts,processing_options_json`).get(stamp,stamp,stamp-RETRY_MS,stamp-LEASE_MS) as Row | null;
    if (!row) break;
    const processing = parseStoredJson<ProcessingOptions>(row.processing_options_json, { ...DEFAULT_PROCESSING_OPTIONS });
    let finalized = false;
    let finalStatus: "done" | "failed" = "done";
    try {
      const ocrText = processing.ocr && row.blob_data ? (await (options.ocr || recognizeImage)(row.blob_data)).slice(0,100_000) || null : row.ocr_text || null;
      const result = organizeText({...row,ocr_text:ocrText});
      finalized = finalizeCapture(db,row,stamp,now(),"done",{
        summary: processing.summaries ? result.summary : null,
        ocr_text: processing.ocr ? ocrText : null,
        category: result.category,
        tags: processing.tags ? JSON.stringify(result.tags) : "[]",
      });
    } catch {
      const result = organizeText(row);
      finalStatus = "failed";
      finalized = finalizeCapture(db,row,stamp,now(),"failed",{
        summary: processing.summaries ? result.summary : null,
        ocr_text: processing.ocr ? row.ocr_text || null : null,
        category: result.category,
        tags: processing.tags ? JSON.stringify(result.tags) : "[]",
      });
    }
    if (finalized && options.notify && (finalStatus === "done" || row.enrich_attempts >= 3)) {
      try { await options.notify({ accountId: row.account_id, captureId: row.id, status: finalStatus }); } catch {}
    }
    processed++;
  }
  // A crash on the last attempt must not leave a permanent processing indicator.
  db.query(`UPDATE customer_captures SET status='failed',processing_at=NULL,
    enrich_error='Saved safely. Text recognition could not finish.',updated_at=MAX(updated_at+1,?)
    WHERE status='processing' AND enrich_attempts>=3 AND COALESCE(processing_at,0)<?`)
    .run(now(),now()-LEASE_MS);
  return processed;
}

export function startCustomerWorker(db: Database): () => void {
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try { await processCustomerQueue(db, { notify: value => deliverCaptureNotification(db, value) }); }
    catch { console.error("Customer organization queue unavailable; will retry."); }
    finally { busy = false; }
  };
  const timer = setInterval(tick, 2_000);
  void tick();
  return () => clearInterval(timer);
}
