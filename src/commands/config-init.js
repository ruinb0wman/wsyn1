import fs from 'fs-extra';
import path from 'path';
import inquirer from 'inquirer';

/**
 * 检测当前项目是否为 ES Module
 * @param {string} baseDir
 * @returns {boolean}
 */
function detectESM(baseDir) {
  try {
    const pkgPath = path.join(baseDir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.type === 'module';
  } catch {
    return false;
  }
}

/**
 * 配置文件初始化命令
 * @param {Object} options - 命令选项
 */
async function configInitCommand(options = {}) {
  const cwd = process.cwd();
  const isESM = detectESM(cwd);
  const configPath = path.join(cwd, '.wsync.config.js');

  // 检查是否已存在
  if (await fs.pathExists(configPath)) {
    const { overwrite } = await inquirer.prompt([{
      type: 'confirm',
      name: 'overwrite',
      message: '.wsync.config.js 已存在，是否覆盖?',
      default: false
    }]);

    if (!overwrite) {
      console.log('已取消');
      return;
    }
  }

  let config;

  if (options.yes) {
    // 使用默认值
    config = generateConfig({
      target: '/mnt/c/temp/wsync-test',
      prefix: '',
      whitelist: [],
      blacklist: ['.env', '*.log', 'tmp/', '.DS_Store'],
      delete: true,
    }, isESM);
  } else {
    // 交互式提问
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'target',
        message: '目标 Windows 路径 (如 /mnt/c/Users/xxx/Projects/myproject):',
        validate: (input) => {
          if (input.trim() === '') return '目标路径不能为空';
          if (!input.startsWith('/mnt/')) return '路径必须以 /mnt/ 开头 (如 /mnt/c/...)';
          return true;
        }
      },
      {
        type: 'input',
        name: 'prefix',
        message: '同步子文件夹前缀 (留空则同步到目标根目录):',
        default: ''
      },
      {
        type: 'input',
        name: 'whitelist',
        message: '白名单规则 (逗号分隔, 如 dist/,*.env.local):',
        default: '',
        filter: (input) => input.split(',').map(s => s.trim()).filter(Boolean)
      },
      {
        type: 'input',
        name: 'blacklist',
        message: '黑名单规则 (逗号分隔, 如 .env,*.log):',
        default: '.env, *.log, tmp/, .DS_Store',
        filter: (input) => input.split(',').map(s => s.trim()).filter(Boolean)
      },
      {
        type: 'confirm',
        name: 'delete',
        message: '是否删除目标端多余文件?',
        default: true
      }
    ]);

    config = generateConfig(answers, isESM);
  }

  // 写入文件
  await fs.writeFile(configPath, config, 'utf8');
  console.log(`\n✓ 配置文件已生成: ${configPath}`);
  console.log('请根据需要编辑 .wsync.config.js 完善配置。');
}

/**
 * 生成配置文件内容
 * @param {Object} answers - 用户输入
 * @param {boolean} isESM - 当前项目是否为 ES Module
 * @returns {string}
 */
function generateConfig(answers, isESM) {
  const whitelistStr = answers.whitelist.length > 0
    ? answers.whitelist.map(s => `    '${s}'`).join(',\n')
    : '    // \'dist/\',';

  const blacklistStr = answers.blacklist.length > 0
    ? answers.blacklist.map(s => `    '${s}'`).join(',\n')
    : '    // \'.env\',';

  if (isESM) {
    return `export default {
  // 源目录: WSL2 中的项目路径 (相对于配置文件)
  source: '.',

  // 目标目录: Windows 路径 (必需)
  // 统一使用 /mnt/c/... 格式
  target: '${answers.target}',

  // 同步到目标目录的子文件夹下 (可选)
  prefix: '${answers.prefix}',

  // 白名单: 即使被 .gitignore 忽略，也强制同步
  whitelist: [
${whitelistStr}
  ],

  // 黑名单: 即使 .gitignore 没忽略，也强制排除
  blacklist: [
${blacklistStr}
  ],

  // 额外要遵循的 ignore 文件
  additionalIgnoreFiles: [],

  // 保留目标端文件/文件夹: 这些路径不会被 wsync 删除或覆盖
  // 以目标目录为根，支持 glob 模式
  keepTarget: [
    // 'node_modules/',
  ],

  // 同步选项
  options: {
    // 删除目标端多余文件
    delete: ${answers.delete},
    // 试运行模式
    dryRun: false,
    // 详细日志
    verbose: false
  }
};
`;
  }

  return `module.exports = {
  // 源目录: WSL2 中的项目路径 (相对于配置文件)
  source: '.',

  // 目标目录: Windows 路径 (必需)
  // 统一使用 /mnt/c/... 格式
  target: '${answers.target}',

  // 同步到目标目录的子文件夹下 (可选)
  prefix: '${answers.prefix}',

  // 白名单: 即使被 .gitignore 忽略，也强制同步
  whitelist: [
${whitelistStr}
  ],

  // 黑名单: 即使 .gitignore 没忽略，也强制排除
  blacklist: [
${blacklistStr}
  ],

  // 额外要遵循的 ignore 文件
  additionalIgnoreFiles: [],

  // 保留目标端文件/文件夹: 这些路径不会被 wsync 删除或覆盖
  // 以目标目录为根，支持 glob 模式
  keepTarget: [
    // 'node_modules/',
  ],

  // 同步选项
  options: {
    // 删除目标端多余文件
    delete: ${answers.delete},
    // 试运行模式
    dryRun: false,
    // 详细日志
    verbose: false
  }
};
`;
}

export default configInitCommand;
