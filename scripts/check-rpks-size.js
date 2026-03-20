const fs = require('fs')
const path = require('path')

const SRPK_MAX_SIZE = 2 * 1024 * 1024
const MAIN_SRPK_MAX_SIZE = 40 * 1024

function formatKB(size) {
  return `${(size / 1024).toFixed(2)}KB`
}

function findEocdOffset(buffer) {
  const signature = 0x06054b50
  const minOffset = Math.max(0, buffer.length - 0x10000 - 22)
  for (let i = buffer.length - 22; i >= minOffset; i--) {
    if (buffer.readUInt32LE(i) === signature) {
      return i
    }
  }
  return -1
}

function readZipEntries(zipPath) {
  const buffer = fs.readFileSync(zipPath)
  const eocdOffset = findEocdOffset(buffer)

  if (eocdOffset < 0) {
    throw new Error(`无法解析 zip 文件（未找到 EOCD）：${zipPath}`)
  }

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10)
  const centralDirOffset = buffer.readUInt32LE(eocdOffset + 16)
  const entries = []

  let cursor = centralDirOffset
  for (let i = 0; i < totalEntries; i++) {
    const headerSignature = buffer.readUInt32LE(cursor)
    if (headerSignature !== 0x02014b50) {
      throw new Error(`zip 中央目录头无效：${zipPath}`)
    }

    const uncompressedSize = buffer.readUInt32LE(cursor + 24)
    const fileNameLength = buffer.readUInt16LE(cursor + 28)
    const extraLength = buffer.readUInt16LE(cursor + 30)
    const commentLength = buffer.readUInt16LE(cursor + 32)
    const fileNameStart = cursor + 46
    const fileNameEnd = fileNameStart + fileNameLength
    const fileName = buffer.toString('utf8', fileNameStart, fileNameEnd)

    entries.push({
      fileName,
      size: uncompressedSize
    })

    cursor = fileNameEnd + extraLength + commentLength
  }

  return entries
}

function checkRpksFile(rpksPath) {
  const entries = readZipEntries(rpksPath)
  const srpkEntries = entries.filter(entry => entry.fileName.endsWith('.srpk'))

  if (!srpkEntries.length) {
    throw new Error(`未找到 srpk 分包：${path.basename(rpksPath)}`)
  }

  const failedSrpkEntries = srpkEntries.filter(
    entry => entry.size > SRPK_MAX_SIZE
  )
  if (failedSrpkEntries.length) {
    const detail = failedSrpkEntries
      .map(entry => `${entry.fileName}=${formatKB(entry.size)}`)
      .join(', ')
    throw new Error(
      `${path.basename(rpksPath)} 中 srpk 包超过 2MB 限制：${detail}`
    )
  }

  const mainPackage = srpkEntries.find(entry =>
    entry.fileName.endsWith('.base.srpk')
  )
  if (!mainPackage) {
    throw new Error(`未找到主包（*.base.srpk）：${path.basename(rpksPath)}`)
  }

  if (mainPackage.size > MAIN_SRPK_MAX_SIZE) {
    throw new Error(
      `${path.basename(rpksPath)} 主包 ${mainPackage.fileName} 大小 ${formatKB(
        mainPackage.size
      )}，超过 40KB 限制`
    )
  }

  console.log(
    `[size-check] ${path.basename(rpksPath)} 校验通过: 主包 ${formatKB(
      mainPackage.size
    )}, srpk 最大 ${formatKB(
      Math.max(...srpkEntries.map(entry => entry.size))
    )}`
  )
}

function main() {
  const distDir = path.resolve(__dirname, '../dist')

  if (!fs.existsSync(distDir)) {
    throw new Error(`dist 目录不存在：${distDir}`)
  }

  const allRpksFiles = fs
    .readdirSync(distDir)
    .filter(fileName => fileName.endsWith('.rpks'))
    .map(fileName => path.join(distDir, fileName))

  if (!allRpksFiles.length) {
    throw new Error(`dist 目录下未找到 .rpks 文件：${distDir}`)
  }

  const releaseRpksFiles = allRpksFiles.filter(rpksPath => {
    const name = path.basename(rpksPath).toLowerCase()
    return name.includes('release') || name.includes('production')
  })

  const rpksFiles = releaseRpksFiles.length ? releaseRpksFiles : allRpksFiles
  rpksFiles.forEach(checkRpksFile)
}

try {
  main()
} catch (error) {
  console.error(`[size-check] ${error.message}`)
  process.exit(1)
}
