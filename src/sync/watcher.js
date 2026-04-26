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

  // 首次同步，显示 keepTarget 警告
  await runSync(config, filter, verbose, 'stream', true);

  // 设置监听
  const watcher = chokidar.watch(source, {
    ignored: (filePath, stats) => {
      if (stats?.isDirectory()) {
        return !filter.shouldSync(filePath);
      }
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
      await runSync(config, filter, verbose, 'stream', false);
      console.log('继续监听...');
    }, 500);
  };

  watcher
    .on('add', triggerSync)
    .on('change', triggerSync)
    .on('unlink', triggerSync)
    .on('addDir', triggerSync)
    .on('unlinkDir', triggerSync)
    .on('error', error => console.error('监听错误:', error));

  return new Promise(() => {});
}

/**
 * 执行一次同步
 * @param {Object} config - 配置对象
 * @param {Object} filter - 过滤管理器 (可选)
 * @param {boolean} verbose - 是否详细输出
 * @param {string} output - 输出模式: 'table' | 'stream'
 * @param {boolean} showKeepTargetWarnings - 是否显示 keepTarget 冲突警告
 */
async function runSync(config, filter = null, verbose = false, output = 'table', showKeepTargetWarnings = true) {
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

  // 应用 keepTarget
  if (config.keepTarget && config.keepTarget.length > 0) {
    const keepPaths = config.keepTarget.map(p => {
      const resolved = path.resolve(p);
      return resolved.endsWith(path.sep) ? resolved : resolved;
    });

    if (showKeepTargetWarnings) {
      for (const keepPath of config.keepTarget) {
        const relativeKeep = path.relative(config.target, keepPath);
        const sourcePath = path.join(config.source, relativeKeep);
        if (fs.existsSync(sourcePath)) {
          console.warn(`\n⚠️  keepTarget 路径 "${relativeKeep}" 在源端也存在，将保留目标端版本，不会覆盖`);
        }
      }
    }

    function isKeepTarget(filePath) {
      const resolved = path.resolve(filePath);
      return keepPaths.some(kp => resolved === kp || resolved.startsWith(kp + path.sep));
    }

    diff.toDelete = diff.toDelete.filter(item => !isKeepTarget(item.target));
    diff.toUpdate = diff.toUpdate.filter(item => !isKeepTarget(item.target));
  }

  return executeSync(diff, {
    dryRun: config.options?.dryRun || false,
    verbose,
    delete: config.options?.delete !== false,
    output
  });
}

export { startWatcher, runSync };
