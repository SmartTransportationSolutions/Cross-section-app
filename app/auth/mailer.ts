/**
 * Outbound email for the STS identity service (magic links, password resets)
 * and other operational mail.
 *
 * Transport selection (MAIL_TRANSPORT):
 *   - "smtp"   : nodemailer SMTP using SMTP_URL, or SMTP_HOST/PORT/USER/PASS.
 *   - "outbox" : writes each message as a JSON file into MAIL_OUTBOX_DIR
 *                (default ./data/mail-outbox). Used for local development and
 *                automated tests; refused in production.
 *   - "none"   : email delivery disabled; flows that need email report 503.
 *
 * Default: "smtp" when SMTP settings are present, otherwise "outbox" outside
 * production and "none" in production.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import nodemailer, { type Transporter } from 'nodemailer'

import { brand } from '@sts-street/branding'
import { logger } from '../lib/logger.ts'

export interface MailMessage {
  to: string
  subject: string
  text: string
  html?: string
}

type TransportKind = 'smtp' | 'outbox' | 'none'

function hasSmtpConfig(): boolean {
  return Boolean(process.env.SMTP_URL || process.env.SMTP_HOST)
}

export function getTransportKind(): TransportKind {
  const configured = process.env.MAIL_TRANSPORT as TransportKind | undefined
  if (configured === 'smtp' || configured === 'outbox' || configured === 'none') {
    if (configured === 'outbox' && process.env.NODE_ENV === 'production') {
      logger.error(
        '[mail] MAIL_TRANSPORT=outbox is not allowed in production; email delivery disabled.'
      )
      return 'none'
    }
    return configured
  }
  if (hasSmtpConfig()) return 'smtp'
  return process.env.NODE_ENV === 'production' ? 'none' : 'outbox'
}

export function isMailAvailable(): boolean {
  return getTransportKind() !== 'none'
}

export function getMailFrom(): string {
  return process.env.MAIL_FROM || `${brand.productName} <no-reply@localhost>`
}

export function getOutboxDir(): string {
  return path.resolve(process.env.MAIL_OUTBOX_DIR || './data/mail-outbox')
}

let smtpTransport: Transporter | null = null

function getSmtpTransport(): Transporter {
  if (smtpTransport) return smtpTransport
  if (process.env.SMTP_URL) {
    smtpTransport = nodemailer.createTransport(process.env.SMTP_URL)
  } else {
    smtpTransport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    })
  }
  return smtpTransport
}

export class MailUnavailableError extends Error {
  name = 'MailUnavailableError'
}

export async function sendMail(message: MailMessage): Promise<void> {
  const kind = getTransportKind()

  switch (kind) {
    case 'smtp': {
      await getSmtpTransport().sendMail({ from: getMailFrom(), ...message })
      logger.info(`[mail] Sent "${message.subject}" to ${message.to} via SMTP`)
      return
    }
    case 'outbox': {
      const dir = getOutboxDir()
      await fs.mkdir(dir, { recursive: true })
      const id = `${Date.now()}-${crypto.randomUUID()}`
      const file = path.join(dir, `${id}.json`)
      await fs.writeFile(
        file,
        JSON.stringify(
          { id, from: getMailFrom(), sentAt: new Date().toISOString(), ...message },
          null,
          2
        )
      )
      logger.info(
        `[mail] (outbox) "${message.subject}" to ${message.to} written to ${file}`
      )
      return
    }
    default:
      throw new MailUnavailableError('Email delivery is not configured.')
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Simple branded HTML wrapper for transactional emails. */
export function renderEmailHtml(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f3f5f8;font-family:Arial,Helvetica,sans-serif;color:#1d2a3a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;border:1px solid #dfe5ec;">
      <tr><td style="padding:20px 28px;border-bottom:4px solid ${brand.themeColor};">
        <strong style="font-size:18px;color:${brand.themeColor};">${escapeHtml(brand.productName)}</strong>
      </td></tr>
      <tr><td style="padding:28px;">
        <h1 style="font-size:20px;margin:0 0 16px;">${escapeHtml(title)}</h1>
        ${bodyHtml}
      </td></tr>
      <tr><td style="padding:16px 28px;border-top:1px solid #dfe5ec;font-size:12px;color:#5b6b7c;">
        ${escapeHtml(brand.companyName)} · <a href="${brand.companyUrl}" style="color:${brand.themeColor};">${escapeHtml(brand.companyUrl)}</a>
      </td></tr>
    </table>
  </body>
</html>`
}
