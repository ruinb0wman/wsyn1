# WSync

WSL2 到 Windows 的单向代码同步工具。

## 功能特性

- **默认遵循 `.gitignore`**：自动忽略被 Git 忽略的文件
- **白名单**：即使 `.gitignore` 忽略了，也强制同步特定文件/目录
- **黑名单**：即使 `.gitignore` 没忽略，也强制排除特定文件/目录
- **Prefix 前缀**：支持将文件同步到目标目录的子文件夹下
- **监听模式**：持续监听文件变化，自动同步
- **进度条**：大量文件同步时显示进度
- **试运行**：`--dry-run` 预览同步结果，不实际执行

## 安装

```bash
git clone <repository>
cd wsync
npm install
npm link
```

## 测试

```bash
# 运行所有测试
npm test

# 运行单个测试文件
node --test tests/config.test.js
node --test tests/filter.test.js
node --test tests/scanner.test.js
node --test tests/executor.test.js
```

## 快速开始

### 1. 初始化配置文件

在项目根目录执行：

```bash
wsync config init
```

或快速生成（使用默认值）：

```bash
wsync config init --yes
```

这会在当前目录生成 `.wsync.config.js` 配置文件。

### 2. 执行同步

```bash
# 单次同步
wsync sync run

# 试运行（预览但不执行）
wsync sync run --dry-run

# 详细输出
wsync sync run --verbose
```

### 3. 监听模式

```bash
# 持续监听文件变化，自动同步
wsync sync watch

# 监听 + 详细输出
wsync sync watch --verbose
```

按 `Ctrl+C` 停止监听。

## 配置文件

配置文件名为 `.wsync.config.js`，放置于项目根目录。

```javascript
module.exports = {
  // 源目录: WSL2 中的项目路径 (相对于配置文件)
  source: '.',

  // 目标目录: Windows 路径 (必需)
  // 统一使用 /mnt/c/... 格式
  target: '/mnt/c/Users/xxx/Projects/myproject',

  // 同步到目标目录的子文件夹下 (可选)
  // 例如: prefix: 'src' 会将文件同步到 target/src/ 下
  prefix: '',

  // 白名单: 即使被 .gitignore 忽略，也强制同步
  // 支持 glob 模式: 'dir/', '*.ext', 'path/to/file'
  whitelist: [
    'dist/',
    '*.env.local'
  ],

  // 黑名单: 即使 .gitignore 没忽略，也强制排除
  blacklist: [
    '.env',
    '*.log',
    'tmp/',
    '.DS_Store'
  ],

  // 额外要遵循的 ignore 文件路径 (相对于 source)
  additionalIgnoreFiles: [
    // '.dockerignore'
  ],

  // 同步选项
  options: {
    // 是否删除目标端存在但源端不存在的文件
    delete: true,

    // 试运行: 只显示会做什么，不实际执行
    dryRun: false,

    // 详细日志: 显示每个文件的操作
    verbose: false
  }
};
```

### 配置说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `source` | string | 否 | 源目录，默认当前目录 |
| `target` | string | **是** | Windows 目标路径，格式 `/mnt/c/...` |
| `prefix` | string | 否 | 同步到目标目录的子文件夹 |
| `whitelist` | string[] | 否 | 白名单规则 |
| `blacklist` | string[] | 否 | 黑名单规则 |
| `additionalIgnoreFiles` | string[] | 否 | 额外的 ignore 文件 |
| `options.delete` | boolean | 否 | 删除目标端多余文件 |
| `options.dryRun` | boolean | 否 | 试运行模式 |
| `options.verbose` | boolean | 否 | 详细日志 |

### 过滤规则优先级

```
黑名单 (最高优先级) → .gitignore → 白名单 (覆盖 gitignore)
```

1. **黑名单**：匹配则**强制排除**，不受其他规则影响
2. **白名单**：匹配则**强制同步**，可覆盖 `.gitignore`
3. **`.gitignore`**：默认遵循项目 `.gitignore` 规则

### Glob 模式支持

- `dist/` — 匹配目录及其内容
- `*.log` — 匹配所有 `.log` 文件
- `tmp/` — 匹配 `tmp` 目录
- `path/to/file` — 匹配特定路径

## CLI 命令

```bash
# 查看帮助
wsync --help
```bash
# 初始化配置
wsync config init              # 交互式
wsync config init --yes        # 使用默认值

# 单次同步
wsync sync run
wsync sync run -c ./custom.config.js   # 指定配置文件
wsync sync run -d                      # 试运行
wsync sync run -v                      # 详细输出

# 监听模式
wsync sync watch
wsync sync watch -c ./custom.config.js
wsync sync watch -v
```

### 命令结构

```
wsync
├── config
│   └── init [options]        # 初始化配置文件
├── sync
│   ├── run [options]         # 单次同步
│   └── watch [options]       # 监听同步
└── help [command]            # 查看帮助
```

## 项目结构

```
wsync/
├── bin/
│   └── wsync.js              # CLI 入口
├── src/
│   ├── commands/
│   │   ├── config-init.js    # wsync config init 命令
│   │   └── sync.js           # wsync sync / sync watch 命令
│   ├── config/
│   │   ├── loader.js         # 配置文件查找、加载、验证
│   │   └── template.js       # 配置文件模板
│   ├── filter/
│   │   └── filter.js         # 过滤规则 (gitignore/whitelist/blacklist)
│   ├── sync/
│   │   ├── scanner.js        # 目录扫描、差异计算
│   │   ├── executor.js       # 同步执行 (进度条、统计)
│   │   └── watcher.js        # 文件监听 (chokidar)
│   └── utils/
│       └── path.js           # 路径工具
├── templates/
│   └── config.js             # 配置文件模板
├── package.json
└── README.md
```

## 技术栈

| 组件 | 用途 |
|------|------|
| `commander` | CLI 框架 |
| `ignore` | `.gitignore` 规则解析 |
| `minimatch` | Glob 模式匹配 |
| `chokidar` | 文件监听 |
| `fs-extra` | 文件操作 |
| `ora` | 进度条 |
| `cli-table3` | 统计表格 |
| `inquirer` | 交互式提问 |

## 注意事项

1. **目标路径格式**：统一使用 `/mnt/c/...` 格式，工具在 WSL2 中运行
2. **配置文件查找**：向上递归查找 `.wsync.config.js`，类似 `.git` 的查找方式
3. **时间戳精度**：比较文件修改时间时允许 1 秒误差，避免跨文件系统时间差异
4. **监听模式**：使用防抖处理（500ms），避免批量变更时频繁同步

## License

MIT
