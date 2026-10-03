#!/usr/bin/env node
/**
 * Polls a URL until it responds with HTTP 200 (or the timeout elapses).
 * Usage: node bin/wait-for-server.mjs http://localhost:8000/healthz [timeoutMs]
 */
const [, , url = 'http://localhost:8000/healthz', timeoutArg = '120000'] = process.argv
const deadline = Date.now() + Number(timeoutArg)

while (Date.now() < deadline) {
  try {
    const response = await fetch(url)
    if (response.ok) {
      console.log(`${url} is up`)
      process.exit(0)
    }
  } catch {
    // not up yet
  }
  await new Promise((resolve) => setTimeout(resolve, 1000))
}
console.error(`Timed out waiting for ${url}`)
process.exit(1)
