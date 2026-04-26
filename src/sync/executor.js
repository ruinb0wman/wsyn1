import fs from 'fs-extra';
import path from 'path';
import ora from 'ora';
import Table from 'cli-table3';

/**
 * 执行同步操作
 * @param {Object} diff - 差异结果 { toAdd, toUpdate, toDelete }
 * @param {Object} options - 选项 { dryRun, verbose, delete: deleteExtra, output }
 */
async function executeSync(diff, options = {}) {
  const {
    dryRun = false,
    verbose = false,
    delete: deleteExtra = true,
    output = 'table'  // 'table' | 'stream'
  } = options;

  const stats = {
    added: 0,
    updated: 0,
    deleted: 0,
    errors: []
  };

  const total = diff.toAdd.length + diff.toUpdate.length + (deleteExtra ? diff.toDelete.length : 0);

  if (total === 0) {
    console.log('✓ 所有文件已是最新，无需同步');
    return stats;
  }

  // table 模式: 显示同步计划
  if (output === 'table' && (dryRun || verbose)) {
    showSyncPlan(diff, deleteExtra);
  }

  if (dryRun) {
    if (output === 'table') {
      console.log('\n[试运行模式] 未执行任何操作');
    }
    return stats;
  }

  // 执行同步
  const spinner = output === 'table' ? ora('正在同步...').start() : null;

  try {
    // 1. 添加新文件
    for (const item of diff.toAdd) {
      try {
        await fs.ensureDir(path.dirname(item.target));
        await fs.copy(item.source, item.target, { preserveTimestamps: true });
        stats.added++;
        if (output === 'stream') {
          console.log(`新增: ${item.relative}`);
        } else if (verbose && spinner) {
          spinner.text = `添加: ${item.relative}`;
        }
      } catch (err) {
        stats.errors.push({ action: 'add', file: item.relative, error: err.message });
      }
    }

    // 2. 更新文件
    for (const item of diff.toUpdate) {
      try {
        await fs.copy(item.source, item.target, { overwrite: true, preserveTimestamps: true });
        stats.updated++;
        if (output === 'stream') {
          console.log(`更新: ${item.relative}`);
        } else if (verbose && spinner) {
          spinner.text = `更新: ${item.relative}`;
        }
      } catch (err) {
        stats.errors.push({ action: 'update', file: item.relative, error: err.message });
      }
    }

    // 3. 删除多余文件
    if (deleteExtra) {
      for (const item of diff.toDelete) {
        try {
          await fs.remove(item.target);
          stats.deleted++;
          if (output === 'stream') {
            console.log(`删除: ${item.relative}`);
          } else if (verbose && spinner) {
            spinner.text = `删除: ${item.relative}`;
          }
        } catch (err) {
          stats.errors.push({ action: 'delete', file: item.relative, error: err.message });
        }
      }
    }

    // 完成提示
    if (spinner) {
      spinner.succeed('同步完成');
    }

    // 输出汇总
    if (output === 'table') {
      showStats(stats);
    } else if (stats.errors.length > 0) {
      // stream 模式: 只显示错误
      console.log('');
      stats.errors.forEach(err => {
        console.log(`  ✗ ${err.action} ${err.file}: ${err.error}`);
      });
    }

    return stats;
  } catch (err) {
    if (spinner) spinner.fail('同步失败');
    throw err;
  }
}

/**
 * 显示同步计划
 */
function showSyncPlan(diff, deleteExtra) {
  console.log('\n同步计划:');
  console.log('─'.repeat(50));

  if (diff.toAdd.length > 0) {
    console.log(`\n新增 (${diff.toAdd.length}):`);
    diff.toAdd.forEach(item => console.log(`  + ${item.relative}`));
  }

  if (diff.toUpdate.length > 0) {
    console.log(`\n更新 (${diff.toUpdate.length}):`);
    diff.toUpdate.forEach(item => console.log(`  ~ ${item.relative}`));
  }

  if (deleteExtra && diff.toDelete.length > 0) {
    console.log(`\n删除 (${diff.toDelete.length}):`);
    diff.toDelete.forEach(item => console.log(`  - ${item.relative}`));
  }

  console.log('');
}

/**
 * 显示统计信息（表格）
 */
function showStats(stats) {
  const table = new Table({
    head: ['操作', '数量'],
    style: { head: ['cyan'] }
  });

  table.push(
    ['新增', stats.added.toString()],
    ['更新', stats.updated.toString()],
    ['删除', stats.deleted.toString()]
  );

  if (stats.errors.length > 0) {
    table.push(['错误', stats.errors.length.toString()]);
  }

  console.log('\n同步统计:');
  console.log(table.toString());

  if (stats.errors.length > 0) {
    console.log('\n错误详情:');
    stats.errors.forEach(err => {
      console.log(`  ✗ ${err.action} ${err.file}: ${err.error}`);
    });
  }
}

export { executeSync };
