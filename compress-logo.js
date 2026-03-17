const fs = require('fs')
const path = require('path')

function resolveSharp() {
  const candidates = [
    () => require('sharp'),
    () => require('../jijutuku-23/node_modules/sharp'),
    () => require('../jichengceping-25/node_modules/sharp')
  ]

  for (const getSharp of candidates) {
    try {
      return getSharp()
    } catch (e) {}
  }

  throw new Error('未找到 sharp 模块，请先安装 sharp 或确保兄弟项目已安装')
}

async function run() {
  const sharp = resolveSharp()
  const logoPath = path.join(__dirname, 'src', 'assets', 'images', 'logo.png')

  if (!fs.existsSync(logoPath)) {
    throw new Error('logo 文件不存在: ' + logoPath)
  }

  const before = fs.statSync(logoPath).size

  const output = await sharp(logoPath)
    .resize(192, 192, { fit: 'cover', position: 'center' })
    .png({ quality: 90, compressionLevel: 9 })
    .toBuffer()

  fs.writeFileSync(logoPath, output)

  const after = fs.statSync(logoPath).size
  console.log('logo 压缩完成: 192x192')
  console.log('压缩前: ' + (before / 1024).toFixed(2) + ' KB')
  console.log('压缩后: ' + (after / 1024).toFixed(2) + ' KB')
}

run().catch(err => {
  console.error('logo 压缩失败:', err.message || err)
  process.exit(1)
})
