/**
 * First-party newsletter subscription list.
 *
 * Upstream posted subscriber emails directly from the browser to a
 * third-party mailing list service. STS Street stores subscriptions in its
 * own database so that no user data leaves STS infrastructure. Export the
 * list with `npm run sts:admin -- newsletter-export`.
 */
import crypto from 'node:crypto'
import { z } from 'zod'

import { isValidEmail, normalizeEmail } from '../../auth/identity.ts'
import { NewsletterSubscription } from '../../db/models/index.ts'
import { logger } from '../../lib/logger.ts'

import type { Request, Response } from 'express'

const schema = z.object({
  email: z.string().trim().max(254).refine(isValidEmail, {
    message: 'Invalid email address.',
  }),
  locale: z.string().trim().max(16).optional(),
  tag: z.string().trim().max(64).optional(),
})

export async function post(req: Request, res: Response) {
  const parsed = schema.safeParse(req.body ?? {})
  if (!parsed.success) {
    res.status(400).json({ status: 400, msg: 'Please provide a valid email address.' })
    return
  }

  const email = normalizeEmail(parsed.data.email)

  try {
    const existing = await NewsletterSubscription.findOne({ where: { email } })
    if (existing) {
      if (existing.unsubscribedAt) {
        await existing.update({ unsubscribedAt: null, locale: parsed.data.locale ?? existing.locale })
      }
    } else {
      await NewsletterSubscription.create({
        id: crypto.randomUUID(),
        email,
        source: parsed.data.tag ?? 'via app',
        locale: parsed.data.locale ?? null,
      })
    }
    res.status(200).json({ status: 200, msg: 'Subscribed.' })
  } catch (err) {
    logger.error(err)
    res.status(500).json({ status: 500, msg: 'Could not subscribe.' })
  }
}
