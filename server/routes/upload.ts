import { Hono } from "hono";
import crypto from "crypto";
import sharp from "sharp";
import { db } from "../db";
import { uploadLimiter } from "../middleware/rate-limiter";
import { sessionMiddleware } from "../middleware/session";

const CHUNK_SIZE = 64 * 1024;
const INLINE_LIMIT = 100 * 1024;

export function registerUploadRoutes(app: Hono) {
  app.post("/api/upload", sessionMiddleware, uploadLimiter, async (c) => {
    try {
      const formData = await c.req.parseBody();
      const file = formData["file"];
      if (!file || !(file instanceof File)) {
        return c.json({ error: "No file uploaded. Send as 'file' field in multipart/form-data." }, 400);
      }

      const arrayBuffer = await file.arrayBuffer();
      let buffer = Buffer.from(arrayBuffer as any);
      let detectedMime = file.type;
      if (!detectedMime) {
        const ext = file.name?.split('.').pop()?.toLowerCase();
        if (ext === 'mp4') detectedMime = 'video/mp4';
        else if (ext === 'webm') detectedMime = 'video/webm';
        else if (ext === 'mov' || ext === 'quicktime') detectedMime = 'video/quicktime';
        else if (ext === 'jpg' || ext === 'jpeg') detectedMime = 'image/jpeg';
        else if (ext === 'png') detectedMime = 'image/png';
        else if (ext === 'gif') detectedMime = 'image/gif';
        else if (ext === 'webp') detectedMime = 'image/webp';
        else detectedMime = 'image/jpeg';
      }

      if (detectedMime.startsWith('image/') && detectedMime !== 'image/gif') {
        try {
          const image = sharp(buffer);
          const metadata = await image.metadata();
          if (metadata.width && metadata.height) {
            const targetAspect = 9 / 16;
            const imgAspect = metadata.width / metadata.height;
            let cropWidth = metadata.width;
            let cropHeight = metadata.height;

            if (Math.abs(imgAspect - targetAspect) > 0.01) {
              if (imgAspect > targetAspect) {
                cropHeight = metadata.height;
                cropWidth = Math.round(cropHeight * targetAspect);
              } else {
                cropWidth = metadata.width;
                cropHeight = Math.round(cropWidth / targetAspect);
              }
              const left = Math.max(0, Math.min(Math.round((metadata.width - cropWidth) / 2), metadata.width - cropWidth));
              const top = Math.max(0, Math.min(Math.round((metadata.height - cropHeight) / 2), metadata.height - cropHeight));
              buffer = await image
                .extract({ left, top, width: cropWidth, height: cropHeight })
                .resize(1080, 1920, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 92 })
                .toBuffer();
              detectedMime = 'image/jpeg';
            } else {
              buffer = await image
                .resize(1080, 1920, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 92 })
                .toBuffer();
              detectedMime = 'image/jpeg';
            }
          }
        } catch (imgErr) {
          console.warn("Server image processing failed, storing raw upload:", imgErr);
        }
      }

      const mediaId = "media_" + Date.now() + "_" + crypto.randomBytes(4).toString("hex");
      const now = new Date().toISOString();

      if (buffer.length > INLINE_LIMIT) {
        await db.execute({
          sql: "INSERT INTO media (ID, Data, MimeType, FileName, CreatedAt) VALUES (?, NULL, ?, ?, ?)",
          args: [mediaId, detectedMime, file.name || "untitled", now],
        });
        const chunkCount = Math.ceil(buffer.length / CHUNK_SIZE);
        for (let i = 0; i < chunkCount; i++) {
          const chunk = buffer.subarray(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          await db.execute({
            sql: "INSERT INTO media_chunks (MediaID, ChunkIndex, Data) VALUES (?, ?, ?)",
            args: [mediaId, i, chunk],
          });
        }
        console.log(`[upload] ${mediaId}: ${(buffer.length / 1024).toFixed(1)}KB in ${chunkCount} chunks`);
      } else {
        await db.execute({
          sql: "INSERT INTO media (ID, Data, MimeType, FileName, CreatedAt) VALUES (?, ?, ?, ?, ?)",
          args: [mediaId, buffer, detectedMime, file.name || "untitled", now],
        });
      }

      return c.json({ id: mediaId, url: `/api/media/${mediaId}` });
    } catch (e: any) {
      console.error("Upload failed:", e);
      return c.json({ error: e.message || "Upload failed" }, 500);
    }
  });

  const mediaCache = new Map<string, { data: Uint8Array; mime: string }>();
  const MAX_CACHE_ENTRIES = 20;
  function cacheMedia(id: string, data: Uint8Array, mime: string) {
    if (mediaCache.size >= MAX_CACHE_ENTRIES) {
      const oldest = mediaCache.keys().next().value;
      if (oldest) mediaCache.delete(oldest);
    }
    mediaCache.set(id, { data, mime });
  }

  app.get("/api/media/:id", async (c) => {
    const id = c.req.param("id");
    const cached = mediaCache.get(id);
    if (cached) {
      return serveMedia(c, cached.data, cached.mime);
    }

    const meta = await db.execute({ sql: "SELECT Data, MimeType FROM media WHERE ID = ?", args: [id] });
    const row = meta.rows[0] as any;
    if (!row) return c.json({ error: "Media not found" }, 404);

    const mime = row.MimeType || "image/jpeg";
    if (row.Data !== null && row.Data !== undefined) {
      const u8 = toUint8Array(row.Data);
      if (!u8) return c.json({ error: "Invalid media data" }, 500);
      cacheMedia(id, u8, mime);
      return serveMedia(c, u8, mime);
    }

    const needsFull = c.req.header("range") !== undefined;
    if (needsFull) {
      const chunks = await db.execute({
        sql: "SELECT Data FROM media_chunks WHERE MediaID = ? ORDER BY ChunkIndex",
        args: [id],
      });
      const full = assembleChunks(chunks.rows, id);
      cacheMedia(id, full, mime);
      return serveMedia(c, full, mime);
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const all: Uint8Array[] = [];
          let total = 0;
          let idx = 0;
          for (;;) {
            const r = await db.execute({
              sql: "SELECT Data FROM media_chunks WHERE MediaID = ? AND ChunkIndex = ?",
              args: [id, idx],
            });
            if (r.rows.length === 0) break;
            const piece = toUint8Array(r.rows[0].Data);
            if (!piece) break;
            all.push(piece);
            total += piece.byteLength;
            controller.enqueue(piece);
            idx++;
          }
          controller.close();
          const full = new Uint8Array(total);
          let pos = 0;
          for (const p of all) { full.set(p, pos); pos += p.byteLength; }
          cacheMedia(id, full, mime);
        } catch (e) {
          controller.error(e);
        }
      },
    });

    return c.newResponse(stream, {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Accept-Ranges": "bytes",
      },
    });
  });
}

function assembleChunks(rows: any[], id: string): Uint8Array {
  const pieces: Uint8Array[] = [];
  let total = 0;
  for (const r of rows) {
    const p = toUint8Array(r.Data);
    if (p) { pieces.push(p); total += p.byteLength; }
  }
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of pieces) { out.set(p, pos); pos += p.byteLength; }
  console.log(`[media] Assembled ${id}: ${(total / 1024).toFixed(1)}KB in ${pieces.length} chunks`);
  return out;
}

function toUint8Array(raw: any): Uint8Array | null {
  if (raw instanceof Uint8Array) return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
  if (raw?.buffer instanceof ArrayBuffer) return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
  if (typeof raw === "string") {
    const bin = atob(raw);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  if (raw?.type === "Buffer" && Array.isArray(raw.data)) return new Uint8Array(raw.data);
  if (raw?.type === "Uint8Array" && Array.isArray(raw.data)) return new Uint8Array(raw.data);
  return null;
}

function serveMedia(c: any, data: Uint8Array, mime: string): Response {
  const totalSize = data.byteLength;
  const rangeHeader = c.req.header("range");

  c.header("Content-Type", mime);
  c.header("Cache-Control", "public, max-age=31536000, immutable");
  c.header("Accept-Ranges", "bytes");

  if (rangeHeader) {
    const parts = rangeHeader.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
    const chunk = data.subarray(start, end + 1);
    c.header("Content-Range", `bytes ${start}-${end}/${totalSize}`);
    c.header("Content-Length", String(chunk.byteLength));
    return c.newResponse(chunk, 206);
  }

  c.header("Content-Length", String(totalSize));
  return c.newResponse(data, 200);
}
