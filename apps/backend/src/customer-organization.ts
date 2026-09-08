import type { Database } from "bun:sqlite";

export class CustomerOrganizationError extends Error {
  constructor(readonly status: 400 | 404 | 409, readonly code: string, message: string) { super(message); }
}
type Folder = { id: string; name: string };
type TaggedCapture = { id: string; manual_tags: string; tags: string };
export const foldName = (value: string) => value.normalize("NFC").toLowerCase();

export function organizationName(value: unknown, max: number, kind: string) {
  if (typeof value !== "string") throw new CustomerOrganizationError(400, "invalid_organization", `${kind} must be text.`);
  const name = value.trim().normalize("NFC");
  if (!name || name.length > max || /[\u0000-\u001f\u007f]/.test(name)) {
    throw new CustomerOrganizationError(400, "invalid_organization", `${kind} must contain 1 to ${max} characters without control characters.`);
  }
  return name;
}
export function folderIdentifier(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(value)) {
    throw new CustomerOrganizationError(400, "invalid_folder", "Use a valid folder identifier.");
  }
  return value;
}
export function requireFolder(db: Database, accountId: string, id: string): Folder {
  const row = db.query("SELECT id,name FROM customer_folders WHERE id=? AND account_id=?").get(id, accountId) as Folder | null;
  if (!row) throw new CustomerOrganizationError(404, "folder_not_found", "Folder not found.");
  return row;
}
function userTags(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 20) throw new CustomerOrganizationError(400, "invalid_organization", "Choose up to 20 personal tags.");
  const names = new Map<string, string>();
  for (const raw of value) {
    const name = organizationName(raw, 40, "A tag");
    if (!names.has(foldName(name))) names.set(foldName(name), name);
  }
  return [...names.values()];
}
export function captureOrganization(db: Database, accountId: string, body: Record<string, unknown>, current?: { folder_id: string | null; manual_tags: string }) {
  const folderId = "folderId" in body ? folderIdentifier(body.folderId) : current?.folder_id ?? null;
  if (folderId) requireFolder(db, accountId, folderId);
  const manualTags = "userTags" in body ? JSON.stringify(userTags(body.userTags)) : current?.manual_tags ?? "[]";
  return { folderId, manualTags };
}
export function organizationBytes(folderId: string | null, manualTags: string) {
  return Buffer.byteLength(folderId || "", "utf8") + (manualTags === "[]" ? 0 : Buffer.byteLength(manualTags, "utf8"));
}
function taggedCaptures(db: Database, accountId: string) {
  return db.query("SELECT id,manual_tags,tags FROM customer_captures WHERE account_id=? ORDER BY created_at,id").all(accountId) as TaggedCapture[];
}
function tags(row: TaggedCapture): string[] {
  return [...JSON.parse(row.manual_tags), ...JSON.parse(row.tags || "[]")];
}
export function capturesWithTag(db: Database, accountId: string, tag: string) {
  const folded = foldName(tag);
  // Accounts hold at most 1,000 captures. Folding this bounded tag projection
  // also handles Unicode consistently; SQLite NOCASE only handles ASCII.
  return taggedCaptures(db, accountId).filter(row => tags(row).some(name => foldName(name) === folded)).map(row => row.id);
}
export function folderDto(db: Database, accountId: string, folder: Folder) {
  const { count } = db.query("SELECT COUNT(*) count FROM customer_captures WHERE account_id=? AND folder_id=?").get(accountId, folder.id) as { count: number };
  return { ...folder, count };
}
export function readOrganization(db: Database, accountId: string) {
  const folders = db.query(`SELECT f.id,f.name,COUNT(c.id) count FROM customer_folders f
    LEFT JOIN customer_captures c ON c.folder_id=f.id AND c.account_id=f.account_id
    WHERE f.account_id=? GROUP BY f.id ORDER BY f.normalized_name,f.id`).all(accountId) as (Folder & { count: number })[];
  const rows = taggedCaptures(db, accountId);
  const preferred = new Map<string, string>();
  for (const row of rows) for (const name of JSON.parse(row.manual_tags) as string[]) {
    if (!preferred.has(foldName(name))) preferred.set(foldName(name), name);
  }
  const counted = new Map<string, { name: string; count: number }>();
  for (const row of rows) {
    const seen = new Set<string>();
    for (const name of tags(row)) {
      const key = foldName(name);
      if (seen.has(key)) continue;
      seen.add(key);
      const item = counted.get(key) || { name: preferred.get(key) || name, count: 0 };
      item.count++;
      counted.set(key, item);
    }
  }
  return {
    folders, tags: [...counted.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    suggestedTags: ["Read later", "Inspiration", "Work", "Personal"], suggestedFolders: ["Reading", "Projects", "Inspiration"],
  };
}
export function createFolder(db: Database, accountId: string, name: string) {
  const normalized = foldName(name);
  const existing = db.query("SELECT id,name FROM customer_folders WHERE account_id=? AND normalized_name=?").get(accountId, normalized) as Folder | null;
  if (existing) return { folder: folderDto(db, accountId, existing), created: false };
  const { count } = db.query("SELECT COUNT(*) count FROM customer_folders WHERE account_id=?").get(accountId) as { count: number };
  if (count >= 100) throw new CustomerOrganizationError(409, "folder_limit", "You can create up to 100 folders.");
  const folder = { id: crypto.randomUUID(), name };
  const now = Date.now();
  db.query("INSERT INTO customer_folders(id,account_id,name,normalized_name,created_at,updated_at) VALUES(?,?,?,?,?,?)").run(folder.id, accountId, name, normalized, now, now);
  return { folder: { ...folder, count: 0 }, created: true };
}
export function renameFolder(db: Database, accountId: string, id: string, name: string) {
  requireFolder(db, accountId, id);
  const duplicate = db.query("SELECT id FROM customer_folders WHERE account_id=? AND normalized_name=? AND id<>?").get(accountId, foldName(name), id);
  if (duplicate) throw new CustomerOrganizationError(409, "folder_exists", "A folder with this name already exists.");
  const now = Date.now();
  db.query("UPDATE customer_folders SET name=?,normalized_name=?,updated_at=MAX(updated_at+1,?) WHERE id=? AND account_id=?").run(name, foldName(name), now, id, accountId);
  db.query("UPDATE customer_captures SET updated_at=MAX(updated_at+1,?) WHERE folder_id=? AND account_id=?").run(now, id, accountId);
  return folderDto(db, accountId, { id, name });
}
export function deleteFolder(db: Database, accountId: string, id: string) {
  requireFolder(db, accountId, id);
  db.query("UPDATE customer_captures SET folder_id=NULL,storage_bytes=storage_bytes-?,updated_at=MAX(updated_at+1,?) WHERE folder_id=? AND account_id=?")
    .run(Buffer.byteLength(id, "utf8"), Date.now(), id, accountId);
  db.query("DELETE FROM customer_folders WHERE id=? AND account_id=?").run(id, accountId);
}
