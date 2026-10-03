/**
 * Street image export (server-side rendering).
 *
 * `GET /api/v1/streets/:street_id/image` renders a PNG of the street with
 * @napi-rs/canvas (packages/export-image). Options are query parameters
 * validated by `StreetImageExportSchema` (transparentSky, labels, streetName,
 * watermark, silhouette, scale, locale).
 *
 * Entitlements are enforced server-side: `watermark=false` and scales above
 * the standard export scale require a signed-in member with the
 * SUBSCRIBER_1 role (the "Plus" tier). Requests without that entitlement are
 * rendered with the watermark and at the standard scale instead of failing,
 * so that shared links never break.
 *
 * Upstream stored thumbnails on Cloudinary; the client-side upload was
 * disabled upstream and STS Street renders on demand instead, with a small
 * on-disk cache keyed by street id, update time and options.
 */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { runTestCanvas, StreetImageExportSchema } from '@streetmix/export-image'

import roles from '../../data/user_roles.json' with { type: 'json' }
import { Street, User } from '../../db/models/index.ts'
import { logger } from '../../lib/logger.ts'

import type { Request, Response } from 'express'

const CACHE_DIR = path.resolve(process.env.IMAGE_CACHE_DIR || './data/image-cache')
const MAX_FREE_SCALE = 2

async function isPlusMember(req: Request): Promise<boolean> {
  if (!req.auth?.sub) return false
  try {
    const user = await User.findOne({ where: { authSubject: req.auth.sub } })
    return Boolean(user?.roles?.includes(roles.SUBSCRIBER_1.value))
  } catch (err) {
    logger.error(err)
    return false
  }
}

export async function get(req: Request, res: Response) {
  const streetId = req.params.street_id
  if (!streetId) {
    res.status(400).json({ status: 400, msg: 'Please provide a street id.' })
    return
  }

  if (streetId === 'DEFAULT_STREET' || streetId === 'EMPTY_STREET') {
    res.status(404).json({ status: 404, msg: 'Could not find street image.' })
    return
  }

  let street
  try {
    street = await Street.findOne({ where: { id: streetId } })
  } catch (error) {
    logger.error(error)
    res.status(500).json({ status: 500, msg: 'Error finding street.' })
    return
  }

  if (!street || street.status === 'DELETED') {
    res.status(404).json({ status: 404, msg: 'Could not find street image.' })
    return
  }

  let params
  try {
    params = StreetImageExportSchema.parse(req.query)
  } catch (error) {
    if (error instanceof z.ZodError) {
      res
        .status(400)
        .json({ status: 400, errors: z.flattenError(error).fieldErrors })
    } else {
      res.status(400).json({ status: 400, msg: 'Bad request.' })
    }
    return
  }

  // Server-side entitlement check for premium export options.
  if (!params.watermark || params.scale > MAX_FREE_SCALE) {
    const plus = await isPlusMember(req)
    if (!plus) {
      params = {
        ...params,
        watermark: true,
        scale: Math.min(params.scale, MAX_FREE_SCALE),
      }
    }
  }

  const cacheKey = crypto
    .createHash('sha1')
    .update(
      JSON.stringify({
        id: street.id,
        updatedAt: street.updatedAt,
        params,
      })
    )
    .digest('hex')
  const cachePath = path.join(CACHE_DIR, `${cacheKey}.png`)

  res.set({
    'Content-Type': 'image/png',
    'Cache-Control': 'public, max-age=300',
    'Access-Control-Allow-Origin': '*',
  })

  try {
    const cached = await fs.readFile(cachePath)
    res.status(200).send(cached)
    return
  } catch {
    // not cached
  }

  try {
    const image = await runTestCanvas(street.dataValues, params)
    res.status(200).send(image)
    fs.mkdir(CACHE_DIR, { recursive: true })
      .then(() => fs.writeFile(cachePath, image))
      .catch((err) => logger.warn(`[image] Could not cache image: ${err}`))
  } catch (error) {
    logger.error(error)
    res.status(500).json({ status: 500, msg: 'Error rendering street image.' })
  }
}
