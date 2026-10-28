import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

export async function GET() {
  const worker = await readFile(
    join(
      process.cwd(),
      "node_modules",
      "maplibre-gl",
      "dist",
      "maplibre-gl-worker.mjs",
    ),
    "utf8",
  );

  return new Response(worker, {
    headers: {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Content-Type": "text/javascript; charset=utf-8",
    },
  });
}
