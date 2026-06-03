import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const rootDir = process.cwd();
const previewShimPath = resolve(rootDir, "dist/server/server.js");
const previewShimSource =
  'export { default } from "../../.vercel/output/functions/__server.func/index.mjs";\n';

await mkdir(dirname(previewShimPath), { recursive: true });
await writeFile(previewShimPath, previewShimSource, "utf8");

