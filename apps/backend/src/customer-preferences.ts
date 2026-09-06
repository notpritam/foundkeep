import type { Database } from "bun:sqlite";

export const CUSTOMER_PREFERENCE_VERSION = 1;

export type CustomerPreferences = {
  version: 1;
  capture: {
    region: boolean;
    fullPage: boolean;
    highlight: boolean;
    bookmark: boolean;
    image: boolean;
    tweet: boolean;
    note: boolean;
  };
  bookmark: {
    readableText: boolean;
    extendedMetadata: boolean;
    headings: boolean;
  };
  notes: { attachSource: boolean };
  popup: {
    actionOrder: ("bookmark" | "highlight" | "region" | "fullPage")[];
    showRecent: boolean;
    recentCount: number;
  };
  sync: { automatic: boolean };
  organization: { ocr: boolean; summaries: boolean; tags: boolean };
  feedback: { success: boolean };
  contextMenus: boolean;
};

export const DEFAULT_CUSTOMER_PREFERENCES: CustomerPreferences = Object.freeze({
  version: CUSTOMER_PREFERENCE_VERSION,
  capture: Object.freeze({ region: true, fullPage: true, highlight: true, bookmark: true, image: true, tweet: true, note: true }),
  bookmark: Object.freeze({ readableText: true, extendedMetadata: true, headings: true }),
  notes: Object.freeze({ attachSource: true }),
  popup: Object.freeze({ actionOrder: Object.freeze(["bookmark", "highlight", "region", "fullPage"]), showRecent: true, recentCount: 3 }),
  sync: Object.freeze({ automatic: true }),
  organization: Object.freeze({ ocr: true, summaries: true, tags: true }),
  feedback: Object.freeze({ success: true }),
  contextMenus: true,
}) as CustomerPreferences;

export class PreferenceValidationError extends Error {}

type ObjectValue = Record<string, unknown>;

function object(value: unknown, name: string, keys: readonly string[]): ObjectValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new PreferenceValidationError(`${name} must be an object.`);
  const record = value as ObjectValue;
  const unknown = Object.keys(record).find((key) => !keys.includes(key));
  if (unknown) throw new PreferenceValidationError(`${name}.${unknown} is not a supported setting.`);
  const missing = keys.find((key) => !(key in record));
  if (missing) throw new PreferenceValidationError(`${name}.${missing} is required.`);
  return record;
}

function bool(record: ObjectValue, key: string, name: string) {
  if (typeof record[key] !== "boolean") throw new PreferenceValidationError(`${name}.${key} must be true or false.`);
  return record[key] as boolean;
}

export function normalizeCustomerPreferences(input: unknown): CustomerPreferences {
  const root = object(input, "preferences", ["version", "capture", "bookmark", "notes", "popup", "sync", "organization", "feedback", "contextMenus"]);
  if (root.version !== CUSTOMER_PREFERENCE_VERSION) throw new PreferenceValidationError("This preferences version is not supported.");
  const capture = object(root.capture, "capture", ["region", "fullPage", "highlight", "bookmark", "image", "tweet", "note"]);
  const bookmark = object(root.bookmark, "bookmark", ["readableText", "extendedMetadata", "headings"]);
  const notes = object(root.notes, "notes", ["attachSource"]);
  const popup = object(root.popup, "popup", ["actionOrder", "showRecent", "recentCount"]);
  const sync = object(root.sync, "sync", ["automatic"]);
  const organization = object(root.organization, "organization", ["ocr", "summaries", "tags"]);
  const feedback = object(root.feedback, "feedback", ["success"]);
  const actions = ["bookmark", "highlight", "region", "fullPage"] as const;
  if (!Array.isArray(popup.actionOrder) || popup.actionOrder.length !== actions.length ||
      new Set(popup.actionOrder).size !== actions.length ||
      popup.actionOrder.some((action) => !actions.includes(action as typeof actions[number]))) {
    throw new PreferenceValidationError("popup.actionOrder must contain each popup action once.");
  }
  if (!Number.isInteger(popup.recentCount) || (popup.recentCount as number) < 0 || (popup.recentCount as number) > 5) {
    throw new PreferenceValidationError("popup.recentCount must be between 0 and 5.");
  }
  return {
    version: 1,
    capture: {
      region: bool(capture, "region", "capture"),
      fullPage: bool(capture, "fullPage", "capture"),
      highlight: bool(capture, "highlight", "capture"),
      bookmark: bool(capture, "bookmark", "capture"),
      image: bool(capture, "image", "capture"),
      tweet: bool(capture, "tweet", "capture"),
      note: bool(capture, "note", "capture"),
    },
    bookmark: {
      readableText: bool(bookmark, "readableText", "bookmark"),
      extendedMetadata: bool(bookmark, "extendedMetadata", "bookmark"),
      headings: bool(bookmark, "headings", "bookmark"),
    },
    notes: { attachSource: bool(notes, "attachSource", "notes") },
    popup: {
      actionOrder: [...popup.actionOrder] as CustomerPreferences["popup"]["actionOrder"],
      showRecent: bool(popup, "showRecent", "popup"),
      recentCount: popup.recentCount as number,
    },
    sync: { automatic: bool(sync, "automatic", "sync") },
    organization: {
      ocr: bool(organization, "ocr", "organization"),
      summaries: bool(organization, "summaries", "organization"),
      tags: bool(organization, "tags", "organization"),
    },
    feedback: { success: bool(feedback, "success", "feedback") },
    contextMenus: bool(root, "contextMenus", "preferences"),
  };
}

export type CustomerPreferenceEnvelope = {
  preferences: CustomerPreferences;
  revision: number;
  updatedAt: number | null;
};

function cloneDefaults(): CustomerPreferences {
  return JSON.parse(JSON.stringify(DEFAULT_CUSTOMER_PREFERENCES)) as CustomerPreferences;
}

export function readCustomerPreferences(db: Database, accountId: string): CustomerPreferenceEnvelope {
  const row = db.query("SELECT value_json,revision,updated_at FROM customer_preferences WHERE account_id = ?").get(accountId) as { value_json: string; revision: number; updated_at: number } | null;
  if (!row) return { preferences: cloneDefaults(), revision: 0, updatedAt: null };
  try {
    return { preferences: normalizeCustomerPreferences(JSON.parse(row.value_json)), revision: row.revision, updatedAt: row.updated_at };
  } catch {
    return { preferences: cloneDefaults(), revision: 0, updatedAt: null };
  }
}

export function writeCustomerPreferences(db: Database, accountId: string, input: unknown): CustomerPreferenceEnvelope {
  const preferences = normalizeCustomerPreferences(input);
  const updatedAt = Date.now();
  const row = db.query(`INSERT INTO customer_preferences(account_id,value_json,revision,updated_at)
    VALUES(?,?,1,?) ON CONFLICT(account_id) DO UPDATE SET
    value_json=excluded.value_json,revision=customer_preferences.revision+1,updated_at=excluded.updated_at
    RETURNING revision`).get(accountId, JSON.stringify(preferences), updatedAt) as { revision: number };
  return { preferences, revision: row.revision, updatedAt };
}
