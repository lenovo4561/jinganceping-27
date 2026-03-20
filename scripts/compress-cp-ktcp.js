const fs = require('fs')
const path = require('path')

function resolveSharp() {
  const candidates = [
    () => require('sharp'),
    () => require('../../chengfujibu-26/node_modules/sharp'),
    () => require('../../jijutuku-23/node_modules/sharp'),
    () => require('../../jichengceping-25/node_modules/sharp')
  ]

  for (const getSharp of candidates) {
    try {
      return getSharp()
    } catch (e) {}
  }

  throw new Error('未找到 sharp 模块，请先安装 sharp 或确保兄弟项目已安装')
}

function collectImageFiles(dirPath, result, target) {
  if (!fs.existsSync(dirPath)) return

  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      collectImageFiles(fullPath, result, target)
      continue
    }

    if (!entry.isFile()) continue
    if (!/\.(png|jpg|jpeg|webp)$/i.test(entry.name)) continue

    result.push({ filePath: fullPath, target })
  }
}

async function resizeOne(sharp, filePath, target) {
  const ext = path.extname(filePath).toLowerCase()
  const before = fs.statSync(filePath).size
  const tempPath = `${filePath}.tmp`

  let pipeline = sharp(filePath).resize(target.width, target.height, {
    fit: 'cover',
    position: 'center',
    withoutEnlargement: false
  })

  if (ext === '.png') {
    pipeline = pipeline.png({ quality: 90, compressionLevel: 9 })
  } else if (ext === '.webp') {
    pipeline = pipeline.webp({ quality: 88 })
  } else {
    pipeline = pipeline.jpeg({ quality: 88, mozjpeg: true })
  }

  await pipeline.toFile(tempPath)
  fs.renameSync(tempPath, filePath)

  const after = fs.statSync(filePath).size
  return { before, after }
}

async function run() {
  const sharp = resolveSharp()

  const cpDir = path.join(
    __dirname,
    '..',
    'src',
    'pkg_main',
    'assets',
    'img',
    'cp'
  )
  const ktcpDir = path.join(
    __dirname,
    '..',
    'src',
    'pkg_main',
    'assets',
    'img',
    'ktcp'
  )

  const files = []
  collectImageFiles(cpDir, files, { width: 70, height: 70, label: 'cp' })
  collectImageFiles(ktcpDir, files, { width: 120, height: 90, label: 'ktcp' })

  if (!files.length) {
    console.log('未找到可压缩图片: cp/ktcp')
    return
  }

  let totalBefore = 0
  let totalAfter = 0
  let cpCount = 0
  let ktcpCount = 0

  for (const item of files) {
    const { before, after } = await resizeOne(sharp, item.filePath, item.target)
    totalBefore += before
    totalAfter += after

    if (item.target.label === 'cp') {
      cpCount += 1
    } else if (item.target.label === 'ktcp') {
      ktcpCount += 1
    }
  }

  console.log(`处理完成: ${files.length} 张`)
  console.log(`cp: ${cpCount} 张 (70x70)`)
  console.log(`ktcp: ${ktcpCount} 张 (120x90)`)
  console.log(`压缩前: ${(totalBefore / 1024).toFixed(2)} KB`)
  console.log(`压缩后: ${(totalAfter / 1024).toFixed(2)} KB`)
  console.log(`减少: ${((totalBefore - totalAfter) / 1024).toFixed(2)} KB`)
}

run().catch(err => {
  console.error('批量压缩失败:', err.message || err)
  process.exit(1)
})
