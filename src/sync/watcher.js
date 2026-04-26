import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs-extra';
import { scanSource, scanTarget, computeDiff } from './scanner.js';
import { executeSync } from './executor.js';
import { createFilter } from '../filter/filter.js';

/**
 * 启动文件监听
 * @param {Object} config - 配置对象
 * @param {boolean} verbose - 是否详细输出
 */
async function startWatcher(config, verbose = false) {
  const source = config.source;
  const target = config.target;
  const prefix = config.prefix || '';

  const filter = createFilter(config);

  console.log(`\n开始监听: ${source}`);
  console.log(`目标目录: ${prefix ? path.join(target, prefix) : target}`);
  console.log('按 Ctrl+C 停止监听\n');

  // 首次同步
  await runSync(config, filter, verbose);

  // 设置监听
  const watcher = chokidar.watch(source, {
    ignored: (filePath, stats) => {
      // 如果是目录，检查是否应该被忽略
      if (stats?.isDirectory()) {
        return !filter.shouldSync(filePath);
      }
      // 文件则直接检查
      return !filter.shouldSync(filePath);
    },
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100
    }
  });

  // 防抖处理
  let syncTimeout = null;

  const triggerSync = () => {
    if (syncTimeout) {
      clearTimeout(syncTimeout);
    }
    syncTimeout = setTimeout(async () => {
      console.log('\n检测到文件变化，开始同步...');
      await runSync(config, filter, verbose);
      console.log('\n继续监听...');
    }, 500);
  };

  watcher
    .on('add', triggerSync)
    .on('change', triggerSync)
    .on('unlink', triggerSync)
    .on('addDir', triggerSync)
    .on('unlinkDir', triggerSync)
    .on('error', error => console.error('监听错误:', error));

  // 保持进程运行
  return new Promise(() => {});
}

/**
 * 执行一次同步
 * @param {Object} config - 配置对象
 * @param {Object} filter - 过滤管理器 (可选)
 * @param {boolean} verbose - 是否详细输出
 */
async function runSync(config, filter = null, verbose = false) {
  if (!filter) {
    filter = createFilter(config);
  }

  const sourceFiles = await scanSource(filter, config.source);
  const targetFiles = await scanTarget(
    config.prefix ? path.join(config.target, config.prefix) : config.target,
    filter,
    config.source
  );

  const diff = computeDiff(
    sourceFiles,
    targetFiles,
    config.source,
    config.target,
    config.prefix
  );

  // 应用 keepTarget: 保护目标端指定路径不被删除或覆盖
  if (config.keepTarget && config.keepTarget.length > 0) {
    // 规范化 keepTarget 路径，确保以 / 结尾的目录匹配
    const keepPaths = config.keepTarget.map(p => {
      const resolved = path.resolve(p);
      return resolved.endsWith(path.sep) ? resolved : resolved;
    });

    // 检查冲突: keepTarget 中的路径是否在源端也存在
    for (const keepPath of config.keepTarget) {
      const relativeKeep = path.relative(config.target, keepPath);
      const sourcePath = path.join(config.source, relativeKeep);
      if (fs.existsSync(sourcePath)) {
        console.warn(`\n⚠️  keepTarget 路径 "${relativeKeep}" 在源端也存在，将保留目标端版本，不会覆盖`);
      }
    }

    // 判断一个目标文件路径是否应被保留
    function isKeepTarget(filePath) {
      const resolved = path.resolve(filePath);
      return keepPaths.some(kp => resolved === kp || resolved.startsWith(kp + path.sep));
    }

    // 从删除列表中移除 keepTarget 路径及其子文件
    const deletedCount = diff.toDelete.length;
    diff.toDelete = diff.toDelete.filter(item => !isKeepTarget(item.target));
    const protectedDeletes = deletedCount - diff.toDelete.length;

    // 从更新列表中移除 keepTarget 路径及其子文件
    const updateCount = diff.toUpdate.length;
    diff.toUpdate = diff.toUpdate.filter(item => !isKeepTarget(item.target));
    const protectedUpdates = updateCount - diff.toUpdate.length;

    if (protectedDeletes > 0 || protectedUpdates > 0) {
      console.log(`  keepTarget: 已保护 ${config.keepTarget.length} 个路径（${protectedDeletes} 删除 + ${protectedUpdates} 更新）`);
    }
  }

  return executeSync(diff, {
    dryRun: config.options?.dryRun || false,
    verbose,
    delete: config.options?.delete !== false
  });
}

export { startWatcher, runSync };
