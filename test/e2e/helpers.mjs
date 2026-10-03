/**
 * Shared helpers for the STS Street browser acceptance journeys.
 * Runs with Playwright against a live server (E2E_BASE_URL) and a real
 * PostgreSQL database; sign-in emails are read from the mail outbox
 * directory (MAIL_OUTBOX_DIR, default ./data/mail-outbox).
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium, firefox, webkit } from 'playwright'

export const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:8000'
export const OUT_DIR = path.resolve(process.env.E2E_OUT_DIR || 'test/e2e/output')
export const OUTBOX_DIR = path.resolve(process.env.MAIL_OUTBOX_DIR || 'data/mail-outbox')
export const BROWSER = process.env.E2E_BROWSER || 'chromium'

export const DEMO_PASSWORD = process.env.SEED_PASSWORD || 'sts-street-demo-2026'

const engines = { chromium, firefox, webkit }

export async function launch() {
  await fs.mkdir(OUT_DIR, { recursive: true })
  const engine = engines[BROWSER]
  if (!engine) throw new Error(`Unknown browser ${BROWSER}`)
  return engine.launch()
}

export async function newPage(browser, options = {}) {
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    acceptDownloads: true,
    ...options,
  })
  const page = await context.newPage()
  page.on('dialog', (dialog) => {
    // Default: accept prompts/confirms with the pending value
    const value = page.__dialogValue
    if (dialog.type() === 'prompt') dialog.accept(value ?? dialog.defaultValue())
    else dialog.accept()
  })
  return { context, page }
}

export function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`
}

export async function shot(page, name) {
  const file = path.join(OUT_DIR, `${name}.png`)
  await page.screenshot({ path: file })
  return file
}

/** Waits for the editor to finish loading (loading overlay gone, street visible). */
export async function waitForEditor(page) {
  await page.waitForSelector('.street-section-outer, .street-section', { timeout: 60000 })
  await page.waitForSelector('[data-testid="segment"]', { timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(500)
}

export async function dismissWelcome(page) {
  const close = page.locator('.welcome-panel .close')
  if (await close.count()) {
    await close.first().click().catch(() => {})
  }
}

export async function getStreetState(page) {
  return page.evaluate(() => {
    const s = window.__STS_STORE__?.getState?.()
    return s ? { street: s.street, user: s.user, settings: s.settings } : null
  })
}

/** Reads the current street through the API (server truth). */
export async function apiGetStreet(request, id) {
  const res = await request.get(`${BASE_URL}/api/v1/streets/${id}`)
  if (!res.ok()) throw new Error(`GET street ${id}: ${res.status()}`)
  return res.json()
}

export async function signUpViaApi(request, { email, password, nickname }) {
  const res = await request.post(`${BASE_URL}/services/auth/signup`, {
    data: { email, password, nickname },
  })
  const body = await res.json()
  if (!res.ok()) throw new Error(`signup failed: ${res.status()} ${JSON.stringify(body)}`)
  return body
}

export async function loginViaApi(request, { email, password }) {
  const res = await request.post(`${BASE_URL}/services/auth/login`, {
    data: { email, password },
  })
  if (!res.ok()) throw new Error(`login failed: ${res.status()}`)
  return res.json()
}

/** Signs in through the UI dialog with email + password. */
export async function signInViaUi(page, email, password) {
  await page.locator('button.menu-sign-in').click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.waitForURL(/\/services\/auth\/just-signed-in|\/$|\/[^/]+\/\d+/, { timeout: 60000 })
  await waitForEditor(page)
  await page.waitForSelector('#menubar-identity', { timeout: 60000 })
}

export async function signUpViaUi(page, email, password, nickname) {
  await page.locator('button.menu-sign-in').click()
  await page.getByText('New here? Create an account').click()
  await page.getByLabel('Email').fill(email)
  if (nickname) await page.getByLabel('Username (optional)').fill(nickname)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.waitForSelector('#menubar-identity', { timeout: 60000 })
  await waitForEditor(page)
}

/** Finds the newest outbox email for a recipient and returns the first link. */
export async function latestOutboxLink(to, pattern = /\/services\/auth\/email\/callback\?token=[^\s"'<>]+/) {
  const files = (await fs.readdir(OUTBOX_DIR)).filter((f) => f.endsWith('.json')).sort()
  for (const file of files.reverse()) {
    const mail = JSON.parse(await fs.readFile(path.join(OUTBOX_DIR, file), 'utf8'))
    if (mail.to.toLowerCase() === to.toLowerCase()) {
      const match = mail.text.match(pattern)
      if (match) return match[0]
    }
  }
  return null
}

export function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`)
}

export function approx(a, b, tolerance = 0.011) {
  return Math.abs(a - b) <= tolerance
}
