#!/usr/bin/env node
/**
 * Serves dist-pages/ the way GitHub Pages does, for local testing:
 * - the site lives under APP_BASE_PATH (default "/Cross-section-app"),
 * - "/foo" serves foo.html or foo/index.html,
 * - unknown paths serve 404.html with status 404.
 *
 * Usage: node bin/serve-pages.mjs [port]
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../dist-pages')
const base = (process.env.APP_BASE_PATH ?? '/Cross-section-app').replace(/\/+$/, '')
const port = Number(process.argv[2] ?? process.env.PORT ?? 8080)

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml',
  '.md': 'text/markdown; charset=utf-8',
  '.yaml': 'text/yaml; charset=utf-8',
  '.gz': 'application/gzip',
  '.map': 'application/json',
}

function resolveFile(urlPath) {
  const rel = decodeURIComponent(urlPath).replace(/^\/+/, '')
  const candidate = path.join(root, rel)
  if (!candidate.startsWith(root)) return null
  const options = [candidate, `${candidate}.html`, path.join(candidate, 'index.html')]
  for (const file of options) {
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return file
  }
  return null
}

function send(res, status, file) {
  res.writeHead(status, {
    'Content-Type': types[path.extname(file)] ?? 'application/octet-stream',
  })
  fs.createReadStream(file).pipe(res)
}

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (base && url.pathname === base) {
      res.writeHead(301, { Location: `${base}/` })
      res.end()
      return
    }
    if (base && !url.pathname.startsWith(`${base}/`)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Not found (outside base path)')
      return
    }
    const file = resolveFile(url.pathname.slice(base.length))
    if (file) send(res, 200, file)
    else send(res, 404, path.join(root, '404.html'))
  })
  .listen(port, () => {
    console.log(`Serving ${root} at http://localhost:${port}${base}/`)
  })
