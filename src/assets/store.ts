import { createReadStream } from "node:fs";
import { mkdir, stat as fsStat, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";

/** Persistence contract for binary artifacts. `put` MINTS the asset URI — callers never
 *  choose paths (that inversion is what keeps the store swappable and traversal-safe).
 *  Local disk now; an S3/Supabase implementation can be added without touching callers. */
export interface AssetMeta {
  /** Logical folder, e.g. "uploads" or a jobId. Sanitized to [a-zA-Z0-9._-]. */
  scope: string;
  /** File extension WITHOUT the dot, e.g. "png", "glb". */
  ext: string;
  contentType: string;
}

export interface AssetStat {
  size: number;
  contentType: string;
}

export interface AssetStore {
  readonly kind: string;
  put(data: Buffer, meta: AssetMeta): Promise<string>; // → "asset://<scope>/<uuid>.<ext>"
  get(assetUri: string): Promise<Readable>;
  stat(assetUri: string): Promise<AssetStat>;
}

export class AssetNotFoundError extends Error {
  constructor(uri: string) {
    super(`asset not found: ${uri}`);
    this.name = "AssetNotFoundError";
  }
}

const SAFE_SEGMENT = /^[a-zA-Z0-9._-]+$/;
const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  mp4: "video/mp4",
  mov: "video/quicktime",
  wav: "audio/wav",
  glb: "model/gltf-binary",
};

export const contentTypeFor = (ext: string): string =>
  CONTENT_TYPES[ext.toLowerCase()] ?? "application/octet-stream";

/** Local-disk implementation rooted at OMNI3D_DATA_DIR (default ./data/assets). */
export class LocalAssetStore implements AssetStore {
  readonly kind = "local";
  private readonly root: string;

  constructor(dataDir = process.env.OMNI3D_DATA_DIR ?? "./data/assets") {
    this.root = resolve(dataDir);
  }

  /** Map asset://<scope>/<file> to a filesystem path INSIDE the root, or throw.
   *  Guard on the RESOLVED path — string checks alone miss encoded traversal. */
  private fsPath(assetUri: string): string {
    const m = /^asset:\/\/(.+)$/.exec(assetUri);
    if (!m) throw new AssetNotFoundError(assetUri);
    const segments = decodeURIComponent(m[1]!).split("/");
    if (segments.length < 2 || !segments.every((s) => SAFE_SEGMENT.test(s))) {
      throw new AssetNotFoundError(assetUri);
    }
    const full = resolve(this.root, ...segments);
    if (full !== this.root && !full.startsWith(this.root + sep)) {
      throw new AssetNotFoundError(assetUri);
    }
    return full;
  }

  async put(data: Buffer, meta: AssetMeta): Promise<string> {
    if (!SAFE_SEGMENT.test(meta.scope) || !SAFE_SEGMENT.test(meta.ext)) {
      throw new Error(`invalid scope/ext: ${meta.scope}/${meta.ext}`);
    }
    const name = `${randomUUID()}.${meta.ext.toLowerCase()}`;
    const uri = `asset://${meta.scope}/${name}`;
    const full = this.fsPath(uri);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, data);
    return uri;
  }

  async get(assetUri: string): Promise<Readable> {
    const full = this.fsPath(assetUri);
    await this.statPath(full, assetUri);
    return createReadStream(full);
  }

  async stat(assetUri: string): Promise<AssetStat> {
    const full = this.fsPath(assetUri);
    const s = await this.statPath(full, assetUri);
    const ext = full.slice(full.lastIndexOf(".") + 1);
    return { size: s.size, contentType: contentTypeFor(ext) };
  }

  private async statPath(full: string, uri: string): Promise<{ size: number }> {
    try {
      const s = await fsStat(full);
      if (!s.isFile()) throw new AssetNotFoundError(uri);
      return s;
    } catch {
      throw new AssetNotFoundError(uri);
    }
  }
}
