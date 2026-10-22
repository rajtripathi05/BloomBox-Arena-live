import sharp from 'sharp'
import { mkdirSync, writeFileSync } from 'node:fs'
mkdirSync('public/icons', { recursive: true })
const src = 'public/brand/bloombox_kjsce_logo.jpg'
const bg = '#0a0f1e'
async function icon(size, inner, out) {
  const tile = await sharp(src).resize(inner, inner, { fit: 'contain', background: '#ffffff' }).png().toBuffer()
  await sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: tile, gravity: 'center' }]).png().toFile(out)
}
await icon(192, 132, 'public/icons/icon-192.png')
await icon(512, 352, 'public/icons/icon-512.png')
await icon(512, 300, 'public/icons/maskable-512.png')
writeFileSync('public/favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#0a0f1e"/><path d="M16 5l9 5v12l-9 5-9-5V10z" fill="none" stroke="#3b82f6" stroke-width="2.4" stroke-linejoin="round"/><path d="M16 15v12M7 10l9 5 9-5" fill="none" stroke="#3b82f6" stroke-width="2.4" stroke-linejoin="round"/></svg>`)
