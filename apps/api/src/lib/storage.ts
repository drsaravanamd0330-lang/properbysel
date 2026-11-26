import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
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

export function createStorage(cfg: Config): Storage {
  if (cfg.STORAGE_PROVIDER === "local") return new LocalStorage(cfg.LOCAL_STORAGE_DIR);
  throw new Error("S3 storage adapter needs bucket credentials; see docs/DEPLOYMENT.md");
}
