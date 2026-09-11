import { Client } from "minio";
import { createHash } from "crypto";

let client: Client | null = null;

function getClient(): Client {
  if (client) return client;
  const endpoint = process.env.STORAGE_ENDPOINT;
  const bucket = process.env.STORAGE_BUCKET;
  const accessKey = process.env.STORAGE_ACCESS_KEY;
  const secretKey = process.env.STORAGE_SECRET_KEY;

  if (!endpoint || !bucket || !accessKey || !secretKey) {
    throw new Error("STORAGE_NOT_CONFIGURED");
  }

  const url = new URL(endpoint.includes("://") ? endpoint : `https://${endpoint}`);
  client = new Client({
    endPoint: url.hostname,
    port: url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80,
    useSSL: url.protocol === "https:",
    accessKey,
    secretKey,
  });
  return client;
}

export function getBucket(): string {
  const bucket = process.env.STORAGE_BUCKET;
  if (!bucket) throw new Error("STORAGE_NOT_CONFIGURED");
  return bucket;
}

export async function ensureBucket(): Promise<void> {
  const c = getClient();
  const bucket = getBucket();
  const exists = await c.bucketExists(bucket);
  if (!exists) {
    await c.makeBucket(bucket, "");
  }
}

export async function uploadFile(
  keyPrefix: string,
  filename: string,
  buffer: Buffer,
  contentType: string
): Promise<{ url: string; key: string }> {
  const c = getClient();
  const bucket = getBucket();
  await ensureBucket();

  const sanitizedName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const hash = createHash("sha1").update(filename + Date.now()).digest("hex").slice(0, 8);
  const key = `${keyPrefix}/${hash}_${sanitizedName}`;

  await c.putObject(bucket, key, buffer, buffer.length, {
    "Content-Type": contentType,
  });

  const publicEndpoint = process.env.STORAGE_PUBLIC_ENDPOINT?.replace(/\/$/, "");
  const url = publicEndpoint
    ? `${publicEndpoint}/${key}`
    : `${process.env.STORAGE_ENDPOINT?.replace(/\/$/, "") ?? ""}/${bucket}/${key}`;
  return { url, key };
}

export async function deleteFile(key: string): Promise<void> {
  const c = getClient();
  const bucket = getBucket();
  try {
    await c.removeObject(bucket, key);
  } catch (e) {
    // ignore, file may not exist
  }
}

export function getPublicUrl(key: string): string {
  const publicEndpoint = process.env.STORAGE_PUBLIC_ENDPOINT?.replace(/\/$/, "");
  if (publicEndpoint) return `${publicEndpoint}/${key}`;
  return `${process.env.STORAGE_ENDPOINT?.replace(/\/$/, "") ?? ""}/${getBucket()}/${key}`;
}

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
]);

const ALLOWED_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "pdf",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function validateFileForReceipt(
  mimeType: string | undefined,
  filename: string,
  size: number
): { ok: true } | { ok: false; error: string } {
  if (size > MAX_FILE_SIZE) {
    return { ok: false, error: "FILE_TOO_LARGE" };
  }
  if (!mimeType) {
    return { ok: false, error: "INVALID_MIME_TYPE" };
  }
  if (mimeType === "application/octet-stream") {
    // Heuristic check on extension
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    if (ALLOWED_EXTENSIONS.has(ext) && !ext.startsWith("exe") && !ext.startsWith("bat") && !ext.startsWith("sh")) {
      return { ok: true };
    }
    return { ok: false, error: "INVALID_FILE_TYPE" };
  }
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return { ok: false, error: "INVALID_MIME_TYPE" };
  }
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { ok: false, error: "INVALID_EXTENSION" };
  }
  return { ok: true };
}