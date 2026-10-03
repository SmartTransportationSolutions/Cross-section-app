/**
 * Corresponding-source offer (GNU AGPL-3.0 section 13).
 *
 * `GET /services/source` describes the exact version of the application that
 * is running, where its source code can be obtained, and the licenses that
 * apply. The HTML page at `/source` (see app.ts) renders this information
 * for people, and `/source/sts-street-source.tar.gz` serves an archive of the
 * complete corresponding source when one has been built with
 * `npm run source:archive` (done automatically by the Docker image build).
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

import { brand } from '@sts-street/branding'

import type { Request, Response } from 'express'

export const SOURCE_ARCHIVE_DIR = path.resolve(process.cwd(), 'build', 'source')
export const SOURCE_ARCHIVE_NAME = 'sts-street-source.tar.gz'

let cachedCommit: string | null = null

export function getBuildCommit(): string {
  if (cachedCommit) return cachedCommit
  const fromEnv = process.env.SOURCE_COMMIT || process.env.GIT_COMMIT
  if (fromEnv) {
    cachedCommit = fromEnv
    return cachedCommit
  }
  try {
    const file = path.join(SOURCE_ARCHIVE_DIR, 'COMMIT')
    if (fs.existsSync(file)) {
      cachedCommit = fs.readFileSync(file, 'utf8').trim()
      return cachedCommit
    }
  } catch {
    // fall through
  }
  try {
    cachedCommit = execSync('git rev-parse HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
  } catch {
    cachedCommit = 'unknown'
  }
  return cachedCommit
}

export function getSourceInfo() {
  const archivePath = path.join(SOURCE_ARCHIVE_DIR, SOURCE_ARCHIVE_NAME)
  let archive: { available: boolean; url: string; bytes?: number } = {
    available: false,
    url: `/source/${SOURCE_ARCHIVE_NAME}`,
  }
  try {
    const stat = fs.statSync(archivePath)
    archive = { available: true, url: archive.url, bytes: stat.size }
  } catch {
    // no archive built
  }

  return {
    product: brand.productName,
    operator: brand.companyName,
    version: process.env.npm_package_version ?? null,
    commit: getBuildCommit(),
    repository: brand.sourceRepositoryUrl,
    license: 'AGPL-3.0-or-later',
    licenseUrl: 'https://www.gnu.org/licenses/agpl-3.0.html',
    archive,
    upstream: brand.upstream,
    notices: [
      `${brand.productName} is a modified version of Streetmix (${brand.upstream.repositoryUrl}), licensed under the GNU Affero General Public License v3.0 or later.`,
      brand.upstream.copyright,
      'Street illustrations and variant icons are licensed under Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0).',
    ],
  }
}

export function get(_req: Request, res: Response) {
  res.set('Cache-Control', 'public, max-age=300')
  res.json(getSourceInfo())
}
