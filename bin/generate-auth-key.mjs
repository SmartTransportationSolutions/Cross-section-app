#!/usr/bin/env node
/**
 * Generates an RSA private key for signing STS Street sign-in tokens.
 * Writes ./data/auth-key.pem (or the path given as the first argument) and
 * prints the matching environment variable setting.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const target = path.resolve(process.argv[2] || './data/auth-key.pem')
if (fs.existsSync(target)) {
  console.error(`Refusing to overwrite existing key at ${target}`)
  process.exit(1)
}
const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' })
fs.mkdirSync(path.dirname(target), { recursive: true })
fs.writeFileSync(target, pem, { mode: 0o600 })
console.log(`Wrote ${target}`)
console.log(`Set AUTH_JWT_PRIVATE_KEY_FILE=${path.relative(process.cwd(), target)} in your environment.`)
