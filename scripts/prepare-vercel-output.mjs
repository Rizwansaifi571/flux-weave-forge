import { access, cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const rootDir = process.cwd();
const distDir = resolve(rootDir, "dist");
const outputDir = resolve(rootDir, ".vercel/output");
const staticDir = resolve(outputDir, "static");
const functionsDir = resolve(outputDir, "functions/__server.func");
const serverSourceDir = resolve(distDir, "server");
const clientSourceDir = resolve(distDir, "client");

async function assertExists(path, label) {
  try {
    await access(path);
  } catch {
    throw new Error(`Missing ${label}: ${path}`);
  }
}

await assertExists(distDir, "dist build output");
await assertExists(serverSourceDir, "Nitro server output");
await assertExists(clientSourceDir, "Nitro client output");

const ssrDir = resolve(serverSourceDir, "_ssr");
const ssrEntries = await readdir(ssrDir);
const ssrServerEntry = ssrEntries.find((file) => /^server-.*\.mjs$/.test(file));

if (!ssrServerEntry) {
  throw new Error(`Could not find the Nitro SSR server entry in ${ssrDir}`);
}

await rm(outputDir, { recursive: true, force: true });
await mkdir(staticDir, { recursive: true });
await mkdir(functionsDir, { recursive: true });

// Static assets are served directly from the Vercel filesystem.
await cp(clientSourceDir, staticDir, { recursive: true });

// The server bundle is deployed as a Node.js serverless function.
await cp(serverSourceDir, functionsDir, { recursive: true });

// Nitro's top-level server wrapper only serves the bare template.
// Vercel should enter the actual Start SSR server instead.
await writeFile(
  resolve(functionsDir, "index.mjs"),
  `import { s as server } from "./_ssr/${ssrServerEntry}";\nexport default server.default;\n`,
  "utf8",
);

await writeFile(
  resolve(outputDir, "config.json"),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { handle: "filesystem" },
        { src: "/(.*)", dest: "/__server" },
      ],
      framework: {
        version: "tanstack-start",
      },
    },
    null,
    2,
  ),
  "utf8",
);
