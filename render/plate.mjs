import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFile, mkdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const MIME = {
  ".html": "text/html",
  ".mjs": "text/javascript",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
};

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
].filter(Boolean);

function resolveChrome() {
  const found = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
  if (!found) throw new Error("No Chrome binary found for plate rendering");
  return found;
}

function startServer(root, params) {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (url.pathname === "/params.json") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(params));
      return;
    }
    const target = join(root, normalize(url.pathname).replace(/^(\.\.[/\\])+/, ""));
    try {
      const body = await readFile(target);
      response.writeHead(200, {
        "Content-Type": MIME[extname(target)] || "application/octet-stream",
      });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end("not found");
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

export async function renderPlate(params, outputPath = ".cache/plate.png") {
  await mkdir(".cache", { recursive: true });
  if (existsSync(outputPath)) await unlink(outputPath);

  const server = await startServer(process.cwd(), params);
  const { port } = server.address();
  const chrome = resolveChrome();

  const args = [
    "--headless",
    "--disable-gpu",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--hide-scrollbars",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--force-device-scale-factor=1",
    "--window-size=1000,600",
    "--virtual-time-budget=12000",
    `--screenshot=${outputPath}`,
    `http://127.0.0.1:${port}/render/plate.html`,
  ];

  try {
    await new Promise((resolve, reject) => {
      const child = spawn(chrome, args, { stdio: "ignore" });
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error("plate render timed out"));
      }, 90000);
      child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  } finally {
    server.close();
  }

  if (!existsSync(outputPath)) throw new Error("plate render produced no file");
  const bytes = await readFile(outputPath);
  if (bytes.length < 5000) throw new Error(`plate render too small: ${bytes.length}b`);
  return bytes;
}
