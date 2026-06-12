import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { spawnSync } from "node:child_process";

const assetsDir = "public/assets";
const bucketName = "newleafhearing-staging-media";
const databaseName = "newleafhearing-staging-db";
const authorId = "01KTSHKN1ZR75B71KNWTXM7F6G";
const sqlPath = ".emdash-media-import.sql";

const mimeTypes = new Map([
  [".webp", "image/webp"],
  [".mp4", "video/mp4"],
]);

function sqlString(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlNumber(value) {
  return Number.isFinite(value) ? String(value) : "NULL";
}

function titleFromFilename(filename) {
  return basename(filename, extname(filename))
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function readUInt24LE(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function getWebpDimensions(buffer) {
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") {
    return { width: null, height: null };
  }

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkType = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;

    if (chunkType === "VP8X" && dataOffset + 10 <= buffer.length) {
      return {
        width: readUInt24LE(buffer, dataOffset + 4) + 1,
        height: readUInt24LE(buffer, dataOffset + 7) + 1,
      };
    }

    if (chunkType === "VP8L" && dataOffset + 5 <= buffer.length) {
      const bits = buffer.readUInt32LE(dataOffset + 1);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }

    if (chunkType === "VP8 " && dataOffset + 10 <= buffer.length) {
      return {
        width: buffer.readUInt16LE(dataOffset + 6) & 0x3fff,
        height: buffer.readUInt16LE(dataOffset + 8) & 0x3fff,
      };
    }

    offset = dataOffset + chunkSize + (chunkSize % 2);
  }

  return { width: null, height: null };
}

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: "pipe",
    shell: true,
    env: { ...process.env },
  });

  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
}

const files = readdirSync(assetsDir)
  .filter((file) => mimeTypes.has(extname(file).toLowerCase()))
  .sort((a, b) => a.localeCompare(b));

if (files.length === 0) {
  console.log("No importable media files found.");
  process.exit(0);
}

const rows = [];

for (const filename of files) {
  const ext = extname(filename).toLowerCase();
  const mimeType = mimeTypes.get(ext);
  const filePath = join(assetsDir, filename);
  const buffer = readFileSync(filePath);
  const size = statSync(filePath).size;
  const hash = createHash("sha256").update(buffer).digest("hex");
  const id = `asset_${createHash("sha1").update(filename).digest("hex").slice(0, 26)}`;
  const storageKey = filename;
  const dimensions = ext === ".webp" ? getWebpDimensions(buffer) : { width: null, height: null };
  const alt = titleFromFilename(filename);

  if (process.env.SKIP_UPLOAD !== "1") {
    console.log(`Uploading ${filename}...`);
    run("npx", [
      "wrangler",
      "r2",
      "object",
      "put",
      `${bucketName}/${storageKey}`,
      "--file",
      filePath,
      "--content-type",
      mimeType,
      "--remote",
      "--force",
    ]);
  }

  rows.push({
    id,
    filename,
    mimeType,
    size,
    width: dimensions.width,
    height: dimensions.height,
    alt,
    storageKey,
    contentHash: hash,
  });
}

const now = new Date().toISOString();
const statements = rows.map((row) => `INSERT INTO media (
  id, filename, mime_type, size, width, height, alt, caption, storage_key,
  content_hash, created_at, author_id, status, blurhash, dominant_color
) VALUES (
  ${sqlString(row.id)}, ${sqlString(row.filename)}, ${sqlString(row.mimeType)}, ${sqlNumber(row.size)},
  ${sqlNumber(row.width)}, ${sqlNumber(row.height)}, ${sqlString(row.alt)}, NULL,
  ${sqlString(row.storageKey)}, ${sqlString(row.contentHash)}, ${sqlString(now)},
  ${sqlString(authorId)}, 'ready', NULL, NULL
) ON CONFLICT(id) DO UPDATE SET
  filename = excluded.filename,
  mime_type = excluded.mime_type,
  size = excluded.size,
  width = excluded.width,
  height = excluded.height,
  alt = excluded.alt,
  storage_key = excluded.storage_key,
  content_hash = excluded.content_hash,
  author_id = excluded.author_id,
  status = 'ready';`);

writeFileSync(sqlPath, [...statements, ""].join("\n"));

console.log(`Writing ${rows.length} media records to ${databaseName}...`);
run("npx", ["wrangler", "d1", "execute", databaseName, "--remote", "--file", sqlPath]);

console.log(`Imported ${rows.length} media items.`);
