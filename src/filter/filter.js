import ignore from 'ignore';
import { minimatch } from 'minimatch';
import fs from 'fs-extra';
import path from 'path';

/**
 * 创建过滤管理器
 * @param {Object} config - 配置对象
 * @returns {Object} 过滤管理器
 */
function createFilter(config) {
  const source = config.source;

  // 加载 .gitignore 规则
  const gitignoreRules = loadGitignoreRules(source, config.additionalIgnoreFiles || []);
  const ig = ignore().add(gitignoreRules);

  // 白名单和黑名单
  const whitelist = config.whitelist || [];
  const blacklist = config.blacklist || [];

  /**
   * 检查路径是否匹配 glob 列表
   * @param {string} relativePath - 相对于 source 的路径
   * @param {string[]} patterns - glob 模式列表
   * @returns {boolean}
   */
  function matchesAny(relativePath, patterns) {
    return patterns.some(pattern => {
      // 支持目录匹配 (如 'dist/' 匹配 'dist/' 和 'dist/*')
      const isDirPattern = pattern.endsWith('/');
      const cleanPattern = isDirPattern ? pattern.slice(0, -1) : pattern;

      // 直接匹配
      if (minimatch(relativePath, pattern, { matchBase: true })) {
        return true;
      }

      // 目录内容匹配
      if (isDirPattern && relativePath.startsWith(cleanPattern + '/')) {
        return true;
      }

      // 使用 matchBase 匹配文件名
      if (minimatch(path.basename(relativePath), cleanPattern)) {
        return true;
      }

      return false;
    });
  }

  /**
   * 判断文件是否应该被同步
   * @param {string} absolutePath - 绝对路径
   * @returns {boolean}
   */
  function shouldSync(absolutePath) {
    if (!absolutePath || absolutePath === source) {
      return true; // 根目录始终同步
    }

    const relativePath = path.relative(source, absolutePath);
    const relativePosix = relativePath.split(path.sep).join('/');

    // 1. 最高优先级: 黑名单检查
    if (matchesAny(relativePosix, blacklist)) {
      return false;
    }

    // 2. 白名单检查
    if (matchesAny(relativePosix, whitelist)) {
      return true;
    }

    // 3. 默认: 遵循 .gitignore
    if (ig.ignores(relativePosix)) {
      return false;
    }

    return true;
  }

  return {
    shouldSync,
    matchesAny
  };
}

/**
 * 加载 .gitignore 规则
 * @param {string} sourceDir - 源目录
 * @param {string[]} additionalFiles - 额外的 ignore 文件
 * @returns {string[]} 合并后的规则
 */
function loadGitignoreRules(sourceDir, additionalFiles = []) {
  const rules = [];

  // 加载主 .gitignore
  const mainGitignore = path.join(sourceDir, '.gitignore');
  if (fs.existsSync(mainGitignore)) {
    const content = fs.readFileSync(mainGitignore, 'utf8');
    rules.push(...content.split('\n').filter(line => line.trim() && !line.startsWith('#')));
  }

  // 加载额外的 ignore 文件，将其锚定规则转换为相对于项目根目录
  for (const file of additionalFiles) {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      // 子 .gitignore 所在目录相对于项目根目录的路径
      const relDir = path.relative(sourceDir, path.dirname(file));
      const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));

      for (const line of lines) {
        if (line.startsWith('/')) {
          // 锚定规则: /target/ → src-tauri/target/
          // 子 .gitignore 中的 /target/ 表示"该目录下的 target/"
          // 转换为相对于项目根目录的路径
          rules.push(relDir + line);
        } else if (line.startsWith('!') && line[1] === '/') {
          // 锚定取反规则: !/target/ → !src-tauri/target/
          rules.push('!' + relDir + line.slice(1));
        } else {
          // 非锚定规则（如 *.log、node_modules/）在所有层级都生效，保持原样
          rules.push(line);
        }
      }
    }
  }

  return rules;
}

export { createFilter };
