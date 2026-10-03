#!/usr/bin/env node
/**
 * Generates raster brand assets (favicons, app icons, social preview image)
 * from the SVG sources in client/images. Run with `npm run brand:assets`
 * whenever the logo changes. Output goes to public/.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { createCanvas, loadImage } from '@napi-rs/canvas'

const root = path.resolve(import.meta.dirname, '..')
const publicDir = path.join(root, 'public')
const iconSvg = path.join(root, 'client/images/logo_icon.svg')
const logoSvg = path.join(root, 'client/images/logo_horizontal.svg')

const THEME = '#143a66'
const ACCENT = '#f2a900'

async function renderIcon(size, file) {
  const img = await loadImage(await fs.readFile(iconSvg))
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, size, size)
  await fs.writeFile(path.join(publicDir, file), await canvas.encode('png'))
  console.log('wrote', file)
}

async function renderSocialPreview() {
  const width = 1200
  const height = 630
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

  // Background: sky gradient to ground
  const sky = ctx.createLinearGradient(0, 0, 0, height)
  sky.addColorStop(0, '#dbeaf7')
  sky.addColorStop(0.72, '#f3f7fb')
  sky.addColorStop(0.72, '#3a3a3a')
  sky.addColorStop(1, '#2b2b2b')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, width, height)

  // Stylised cross-section: sidewalks, bike lanes, drive lanes
  const groundY = height * 0.72
  const lanes = [
    { w: 150, color: '#c9ced6' },
    { w: 90, color: '#4cc38a' },
    { w: 240, color: '#4d4d4d' },
    { w: 240, color: '#4d4d4d' },
    { w: 90, color: '#4cc38a' },
    { w: 150, color: '#c9ced6' },
  ]
  const total = lanes.reduce((a, l) => a + l.w, 0)
  let x = (width - total) / 2
  for (const lane of lanes) {
    ctx.fillStyle = lane.color
    ctx.fillRect(x, groundY - 14, lane.w, 14)
    x += lane.w
  }
  // Centre line
  ctx.fillStyle = ACCENT
  ctx.fillRect(width / 2 - 2, groundY - 14, 4, 14)

  // Logo
  const logo = await loadImage(await fs.readFile(logoSvg))
  const logoW = 620
  const logoH = (logoW / 880) * 175
  ctx.drawImage(logo, (width - logoW) / 2, 150, logoW, logoH)

  // Tagline
  ctx.fillStyle = THEME
  ctx.font = '600 34px Arial, Helvetica, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Design, remix and share street cross-sections', width / 2, 330)
  ctx.fillStyle = '#5b6b7c'
  ctx.font = '400 26px Arial, Helvetica, sans-serif'
  ctx.fillText('by Smart Transportation Solutions', width / 2, 372)

  await fs.writeFile(path.join(publicDir, 'images/social-preview.png'), await canvas.encode('png'))
  console.log('wrote images/social-preview.png')
}

async function writeIco() {
  // Minimal ICO container with a single 32x32 PNG entry.
  const png = await fs.readFile(path.join(publicDir, 'favicon-32x32.png'))
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(1, 4) // count
  const entry = Buffer.alloc(16)
  entry.writeUInt8(32, 0) // width
  entry.writeUInt8(32, 1) // height
  entry.writeUInt8(0, 2) // palette
  entry.writeUInt8(0, 3) // reserved
  entry.writeUInt16LE(1, 4) // planes
  entry.writeUInt16LE(32, 6) // bpp
  entry.writeUInt32LE(png.length, 8)
  entry.writeUInt32LE(22, 12) // offset
  await fs.writeFile(path.join(publicDir, 'favicon.ico'), Buffer.concat([header, entry, png]))
  console.log('wrote favicon.ico')
}

await renderIcon(16, 'favicon-16x16.png')
await renderIcon(32, 'favicon-32x32.png')
await renderIcon(180, 'apple-touch-icon.png')
await renderIcon(150, 'mstile-150x150.png')
await renderIcon(192, 'android-chrome-192x192.png')
await renderIcon(512, 'android-chrome-512x512.png')
await writeIco()
await renderSocialPreview()
