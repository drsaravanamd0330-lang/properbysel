import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import type { Config } from "../config";

export interface Storage {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

/** Local disk storage for development. Keys are generated server-side, never from user input. */
export class LocalStorage implements Storage {
  private root: string;
  constructor(dir: string) { this.root = resolve(dir); }
  private path(key: string) {
    const p = resolve(join(this.root, key));
    if (!p.startsWith(this.root)) throw new Error("Invalid storage key");
    return p;
  }
  async put(key: string, data: Buffer) { const p = this.path(key); await mkdir(dirname(p), { recursive: true }); await writeFile(p, data); }
  async get(key: string) { return readFile(this.path(key)); }
  async remove(key: string) { await unlink(this.path(key)).catch(() => undefined); }
}

/** Minimal client shape so tests can supply a fake. */
export interface S3Like { send(cmd: unknown): Promise<unknown> }

/**
 * S3-compatible object storage (AWS S3, Cloudflare R2, DigitalOcean Spaces, MinIO). All objects are private;
 * photos and documents are always served through the API, which applies access rules and signed links.
 */
export class S3Storage implements Storage {
  constructor(private client: S3Like, private bucket: string) {}
  async put(key: string, data: Buffer) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ServerSideEncryption: "AES256" }));
  }
  async get(key: string) {
    const r = (await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }))) as { Body?: { transformToByteArray(): Promise<Uint8Array> } };
    if (!r.Body) throw new Error("Object not found");
    return Buffer.from(await r.Body.transformToByteArray());
  }
  async remove(key: string) { await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key })).catch(() => undefined); }
}

export function createStorage(cfg: Config): Storage {
  if (cfg.STORAGE_PROVIDER === "local") return new LocalStorage(cfg.LOCAL_STORAGE_DIR);
  if (!cfg.S3_BUCKET_PRIVATE || !cfg.S3_ACCESS_KEY_ID || !cfg.S3_SECRET_ACCESS_KEY) throw new Error("S3 storage needs S3_BUCKET_PRIVATE, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY");
  const client = new S3Client({
    region: cfg.S3_REGION, endpoint: cfg.S3_ENDPOINT || undefined, forcePathStyle: !!cfg.S3_ENDPOINT,
    credentials: { accessKeyId: cfg.S3_ACCESS_KEY_ID, secretAccessKey: cfg.S3_SECRET_ACCESS_KEY },
  });
  return new S3Storage(client, cfg.S3_BUCKET_PRIVATE);
}
