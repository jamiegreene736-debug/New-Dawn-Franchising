import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { injectShell } from "./inject-shell";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath, { index: false }));

  // fall through to index.html with SSR shell injection
  app.use("/{*path}", async (req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    let html = fs.readFileSync(indexPath, "utf-8");
    const pathname = req.path.split("?")[0].split("#")[0];
    html = await injectShell(html, pathname);
    res.status(200).set({ "Content-Type": "text/html" }).end(html);
  });
}
