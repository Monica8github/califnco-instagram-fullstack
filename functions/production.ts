import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { handle } from "./app.js";

const staticRoot = resolve(process.cwd(), "apps/admin/dist");
const port = Number(process.env.PORT || 8787);

const mimeTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

async function serveStatic(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  pathname: string,
) {
  let decodedPath: string;

  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    res.statusCode = 400;
    res.end("Invalid URL");
    return;
  }

  const candidate = resolve(staticRoot, `.${decodedPath}`);

  if (
    candidate !== staticRoot &&
    !candidate.startsWith(staticRoot + sep)
  ) {
    res.statusCode = 403;
    res.end("Forbidden");
    return;
  }

  let target = candidate;
  let info;

  try {
    info = await stat(target);

    if (info.isDirectory()) {
      target = resolve(target, "index.html");
      info = await stat(target);
    }

    if (!info.isFile()) {
      throw new Error("Not a file");
    }
  } catch {
    if (extname(decodedPath)) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }

    target = resolve(staticRoot, "index.html");

    try {
      info = await stat(target);
      if (!info.isFile()) throw new Error("Frontend build missing");
    } catch {
      res.statusCode = 503;
      res.end("Frontend build missing. Run npm run build:admin.");
      return;
    }
  }

  res.statusCode = 200;
  res.setHeader(
    "Content-Type",
    mimeTypes[extname(target).toLowerCase()] ||
      "application/octet-stream",
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader(
    "Cache-Control",
    target.includes(sep + "assets" + sep)
      ? "public, max-age=31536000, immutable"
      : "no-cache",
  );
  res.setHeader("Content-Length", info.size);

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  const stream = createReadStream(target);
  stream.on("error", (error) => {
    console.error("Static file error:", error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end("Internal server error");
    } else {
      res.destroy();
    }
  });
  stream.pipe(res);
}

const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(
      req.url || "/",
      "http://localhost",
    ).pathname;

    if (pathname === "/api" || pathname.startsWith("/api/")) {
      await handle(req, res);
      return;
    }

    if (!["GET", "HEAD"].includes(req.method || "GET")) {
      res.statusCode = 405;
      res.end("Method not allowed");
      return;
    }

    await serveStatic(req, res, pathname);
  } catch (error) {
    console.error("Request failed:", error);

    if (!res.headersSent) {
      res.statusCode = 500;
      res.end("Internal server error");
    } else {
      res.destroy();
    }
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Califnco production server listening on port ${port}`);
});
