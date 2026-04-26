import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';

/**
 * 扫描源目录，获取所有需要同步的文件
 * @param {Object} filter - 过滤管理器
 * @param {string} sourceDir - 源目录
 * @returns {Map<string, FileInfo>} 文件路径 -> 文件信息
 */
async function scanSource(filter, sourceDir) {
  const files = new Map();

  async function scanDir(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // 检查目录是否应该被同步（用于决定是否递归）
        if (filter.shouldSync(absolutePath)) {
          await scanDir(absolutePath);
        }
      } else if (entry.isFile()) {
        if (filter.shouldSync(absolutePath)) {
          const stat = await fs.stat(absolutePath);
          files.set(absolutePath, {
            size: stat.size,
            mtime: stat.mtime.getTime(),
            // 可选: 计算 md5 用于精确比较
            // md5: await computeMd5(absolutePath)
          });
        }
      }
    }
  }

  await scanDir(sourceDir);
  return files;
}

/**
 * 扫描目标目录，获取现有文件
 * @param {string} targetDir - 目标目录
 * @param {Object|null} filter - 过滤管理器 (可选)
 * @param {string|null} sourceDir - 源目录 (与 filter 配合使用，将目标路径映射到源路径再检查)
 * @returns {Map<string, FileInfo>} 文件路径 -> 文件信息
 */
async function scanTarget(targetDir, filter = null, sourceDir = null) {
  const files = new Map();

  if (!await fs.pathExists(targetDir)) {
    return files;
  }

  async function scanDir(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(dir, entry.name);

      // 如果传入了 filter，将目标路径映射到对应的源路径后检查过滤规则
      if (filter && sourceDir) {
        const relativeToTarget = path.relative(targetDir, absolutePath);
        const sourceCheckPath = path.join(sourceDir, relativeToTarget);
        if (!filter.shouldSync(sourceCheckPath)) {
          continue;
        }
      }

      if (entry.isDirectory()) {
        await scanDir(absolutePath);
      } else if (entry.isFile()) {
        const stat = await fs.stat(absolutePath);
        files.set(absolutePath, {
          size: stat.size,
          mtime: stat.mtime.getTime()
        });
      }
    }
  }

  await scanDir(targetDir);
  return files;
}

/**
 * 计算文件 MD5
 * @param {string} filePath
 * @returns {string}
 */
async function computeMd5(filePath) {
  const content = await fs.readFile(filePath);
  return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * 计算文件差异
 * @param {Map} sourceFiles - 源文件列表
 * @param {Map} targetFiles - 目标文件列表
 * @param {string} sourceDir - 源目录
 * @param {string} targetDir - 目标目录
 * @param {string} prefix - 前缀
 * @returns {Object} { toAdd: [], toUpdate: [], toDelete: [] }
 */
function computeDiff(sourceFiles, targetFiles, sourceDir, targetDir, prefix = '') {
  const toAdd = [];
  const toUpdate = [];
  const toDelete = [];

  // 计算目标路径前缀
  const targetBase = prefix ? path.join(targetDir, prefix) : targetDir;

  // 检查需要添加或更新的文件
  for (const [sourcePath, sourceInfo] of sourceFiles) {
    const relativePath = path.relative(sourceDir, sourcePath);
    const targetPath = path.join(targetBase, relativePath);

    if (!targetFiles.has(targetPath)) {
      toAdd.push({
        source: sourcePath,
        target: targetPath,
        relative: relativePath
      });
    } else {
      const targetInfo = targetFiles.get(targetPath);
      // 比较大小和修改时间（允许1秒误差）
      const timeDiff = Math.abs(sourceInfo.mtime - targetInfo.mtime);
      if (sourceInfo.size !== targetInfo.size || timeDiff > 1000) {
        toUpdate.push({
          source: sourcePath,
          target: targetPath,
          relative: relativePath
        });
      }
    }
  }

  // 检查需要删除的文件
  for (const [targetPath] of targetFiles) {
    // 只处理在当前 prefix 范围内的文件
    if (!targetPath.startsWith(targetBase)) continue;

    const relativePath = path.relative(targetBase, targetPath);
    const sourcePath = path.join(sourceDir, relativePath);

    if (!sourceFiles.has(sourcePath)) {
      toDelete.push({
        target: targetPath,
        relative: relativePath
      });
    }
  }

  return { toAdd, toUpdate, toDelete };
}

export { scanSource, scanTarget, computeDiff, computeMd5 };
