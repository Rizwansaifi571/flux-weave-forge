import { cp, mkdir, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const rootDir = process.cwd();
const distClientDir = resolve(rootDir, "dist/client");
const distClientAssetsDir = join(distClientDir, "assets");
const vercelStaticDir = resolve(rootDir, ".vercel/output/static");
const vercelAssetsDir = join(vercelStaticDir, "assets");

const manifestFiles = await readdir(resolve(rootDir, "dist/server"));
const manifestFile = manifestFiles.find((file) => file.startsWith("_tanstack-start-manifest_") && file.endsWith(".mjs"));

if (!manifestFile) {
  throw new Error("Could not find TanStack Start manifest in dist/server.");
}

const manifestModule = await import(pathToFileURL(resolve(rootDir, "dist/server", manifestFile)).href);
const manifest = manifestModule.tsrStartManifest();
const rootScripts = manifest.routes?.__root__?.scripts ?? [];
const rootScriptSrc = rootScripts[0]?.attrs?.src;

if (!rootScriptSrc) {
  throw new Error("Could not find root client script in TanStack Start manifest.");
}

const assetFiles = await readdir(distClientAssetsDir);
const stylesFile = assetFiles.find((file) => file.startsWith("styles-") && file.endsWith(".css"));

if (!stylesFile) {
  throw new Error("Could not find built stylesheet in dist/client/assets.");
}

await mkdir(vercelAssetsDir, { recursive: true });
await cp(distClientAssetsDir, vercelAssetsDir, { recursive: true });

const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Flux Weave Forge</title>
    <link rel="stylesheet" href="/assets/${stylesFile}" />
    <script type="module" async src="${rootScriptSrc}"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;

await mkdir(dirname(join(vercelStaticDir, "index.html")), { recursive: true });
await writeFile(join(vercelStaticDir, "index.html"), html, "utf8");
