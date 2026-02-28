const sharp = require('sharp')
const toIco = require('to-ico')
const path = require('path')
const fs = require('fs')

const size = 512
const blue = '#1A56DB'
const white = '#FFFFFF'

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" fill="${white}"/>
  <g fill="${blue}">
    <rect x="${size/2 - 30}" y="${size*0.15}" width="60" height="${size*0.7}" rx="8"/>
    <rect x="${size*0.15}" y="${size/2 - 30}" width="${size*0.7}" height="60" rx="8"/>
  </g>
</svg>
`

const publicDir = path.join(__dirname, '..', 'public')
const pngPath = path.join(publicDir, 'icon.png')
const icoPath = path.join(publicDir, 'icon.ico')

const buffer = Buffer.from(svg)

Promise.all([
  sharp(buffer).png().resize(size, size).toFile(pngPath),
  sharp(buffer).png().resize(256, 256).toBuffer().then((png256) => toIco([png256])).then((ico) => fs.promises.writeFile(icoPath, ico))
])
  .then(() => {
    console.log('Created', pngPath, 'and', icoPath)
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
