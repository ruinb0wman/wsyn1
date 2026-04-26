import { findConfig, loadConfig, validateConfig } from '../config/loader.js';
import { startWatcher, runSync } from '../sync/watcher.js';

/**
 * 同步命令
 * @param {Object} options - 命令选项
 */
async function syncCommand(options = {}) {
  try {
    // 1. 查找配置文件
    const configPath = options.config || findConfig();

    if (!configPath) {
      console.error('错误: 找不到 .wsync.config.js 或 .wsync.config.cjs 配置文件');
      console.error('请在项目目录运行，或使用 -c 指定配置文件');
      console.error('\n提示: 运行 "wsync config init" 初始化配置文件');
      process.exit(1);
    }

    // 2. 加载配置
    const config = await loadConfig(configPath);

    // 命令行选项覆盖配置文件
    if (options.dryRun) {
      config.options = config.options || {};
      config.options.dryRun = true;
    }
    if (options.verbose) {
      config.options = config.options || {};
      config.options.verbose = true;
    }

    // 3. 验证配置
    const validation = validateConfig(config);
    if (!validation.valid) {
      console.error('配置错误:');
      validation.errors.forEach(err => console.error(`  ✗ ${err}`));
      process.exit(1);
    }

    // 4. 显示配置信息
    console.log('\n配置信息:');
    console.log(`  源目录: ${config.source}`);
    console.log(`  目标目录: ${config.target}`);
    if (config.prefix) {
      console.log(`  前缀: ${config.prefix}`);
    }
    console.log(`  配置文件: ${config._configPath}\n`);

    // 5. 执行同步或监听
    if (options.watch) {
      await startWatcher(config, options.verbose);
    } else {
      await runSync(config, null, options.verbose);
    }

  } catch (err) {
    console.error('\n错误:', err.message);
    if (options.verbose) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

export default syncCommand;
