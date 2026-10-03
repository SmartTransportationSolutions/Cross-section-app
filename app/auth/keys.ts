/**
 * Signing keys for the STS identity service.
 *
 * Tokens are RS256-signed JWTs. The private key is provided through the
 * `AUTH_JWT_PRIVATE_KEY` environment variable (PEM, PKCS#8; newlines may be
 * escaped as `\n`) or through `AUTH_JWT_PRIVATE_KEY_FILE`.
 *
 * In development and test, if no key is configured, an ephemeral key pair is
 * generated at startup. This is refused in production because tokens would
 * become invalid on every restart and could not be verified across replicas.
 *
 * Generate a key with: `npm run auth:generate-key`
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import { exportJWK, calculateJwkThumbprint, type JWK } from 'jose'

import { logger } from '../lib/logger.ts'

export interface SigningKeys {
  privateKey: crypto.KeyObject
  publicKey: crypto.KeyObject
  publicJwk: JWK
  kid: string
}

let keys: SigningKeys | null = null
let loading: Promise<SigningKeys> | null = null

function readConfiguredPrivateKey(): string | null {
  const file = process.env.AUTH_JWT_PRIVATE_KEY_FILE
  if (file) {
    return fs.readFileSync(file, 'utf8')
  }
  const inline = process.env.AUTH_JWT_PRIVATE_KEY
  if (inline) {
    return inline.replace(/\\n/g, '\n')
  }
  return null
}

export function generatePrivateKeyPem(): string {
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
  })
  return privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
}

async function buildKeys(privateKeyPem: string): Promise<SigningKeys> {
  const privateKey = crypto.createPrivateKey(privateKeyPem)
  const publicKey = crypto.createPublicKey(privateKey)
  const publicJwk = await exportJWK(publicKey)
  const kid = await calculateJwkThumbprint(publicJwk)
  publicJwk.kid = kid
  publicJwk.alg = 'RS256'
  publicJwk.use = 'sig'
  return { privateKey, publicKey, publicJwk, kid }
}

export async function getSigningKeys(): Promise<SigningKeys> {
  if (keys) return keys
  if (loading) return loading

  loading = (async () => {
    let pem = readConfiguredPrivateKey()
    if (!pem) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          'AUTH_JWT_PRIVATE_KEY (or AUTH_JWT_PRIVATE_KEY_FILE) must be set in production. Run `npm run auth:generate-key`.'
        )
      }
      logger.warn(
        '[auth] No AUTH_JWT_PRIVATE_KEY configured; using an ephemeral signing key. Sessions will not survive a restart.'
      )
      pem = generatePrivateKeyPem()
    }
    keys = await buildKeys(pem)
    return keys
  })()

  return loading
}

/** Test helper: reset cached keys so a new key pair is generated. */
export function resetSigningKeysForTests(): void {
  keys = null
  loading = null
}

export async function getPublicJwks(): Promise<{ keys: JWK[] }> {
  const { publicJwk } = await getSigningKeys()
  return { keys: [publicJwk] }
}
