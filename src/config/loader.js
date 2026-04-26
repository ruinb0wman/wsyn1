import path from 'path';
import fs from 'fs-extra';

/**
 * 向上递归查找配置文件
 * @param {string} startDir - 开始查找的目录
 * @returns {string|null} 配置文件路径或 null
 */
function findConfig(startDir = process.cwd()) {
  let dir = path.resolve(startDir);
  const root = path.parse(dir).root;

  while (dir !== root) {
    const configPath = path.join(dir, '.wsync.config.js');
    if (fs.existsSync(configPath)) {
      return configPath;
    }
    dir = path.dirname(dir);
  }
  return null;
}

/**
 * 加载配置文件（通过动态 import，支持 CJS 和 ESM 语法）
 * @param {string} configPath - 配置文件路径
 * @returns {Promise<Object>} 配置对象
 */
async function loadConfig(configPath) {
  let module;
  try {
    // import() 可以加载 CJS（module.exports）和 ESM（export default）格式的配置文件
    module = await import(path.resolve(configPath));
  } catch (err) {
    if (err.message && err.message.includes('module is not defined in ES module scope')) {
      console.error('\n错误: 配置文件使用了 CommonJS 语法（module.exports），');
      console.error('但当前项目为 ES Module。请使用 export default 语法，');
      console.error('或运行 "wsync config init" 重新生成配置文件。\n');
    } else {
      console.error('\n错误: 加载配置文件失败');
      console.error(`  路径: ${configPath}`);
      console.error(`  原因: ${err.message}\n`);
    }
    process.exit(1);
  }

  // import() CJS 模块时，module.exports 会作为 default 导出
  const config = module.default || module;

  // 解析为绝对路径
  const configDir = path.dirname(configPath);
  config._configDir = configDir;
  config._configPath = configPath;

  // 解析 source 为绝对路径
  if (config.source) {
    config.source = path.resolve(configDir, config.source);
  } else {
    config.source = configDir;
  }

  // 解析 target 为绝对路径
  if (config.target) {
    config.target = path.resolve(config.target);
  }

  // 解析 additionalIgnoreFiles
  if (config.additionalIgnoreFiles) {
    config.additionalIgnoreFiles = config.additionalIgnoreFiles.map(file =>
      path.resolve(config.source, file)
    );
  }

  // 解析 keepTarget 路径（相对于 target 目录）
  if (config.keepTarget) {
    config.keepTarget = config.keepTarget.map(p =>
      path.resolve(config.target, p)
    );
  }

  return config;
}

/**
 * 验证配置
 * @param {Object} config - 配置对象
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateConfig(config) {
  const errors = [];

  if (!config.target) {
    errors.push('Missing required field: target');
  }

  if (!config.source) {
    errors.push('Missing required field: source');
  } else if (!fs.existsSync(config.source)) {
    errors.push(`Source directory does not exist: ${config.source}`);
  }

  if (config.whitelist && !Array.isArray(config.whitelist)) {
    errors.push('whitelist must be an array');
  }

  if (config.blacklist && !Array.isArray(config.blacklist)) {
    errors.push('blacklist must be an array');
  }

  if (config.additionalIgnoreFiles && !Array.isArray(config.additionalIgnoreFiles)) {
    errors.push('additionalIgnoreFiles must be an array');
  }

  if (config.keepTarget && !Array.isArray(config.keepTarget)) {
    errors.push('keepTarget must be an array');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export { findConfig, loadConfig, validateConfig };
