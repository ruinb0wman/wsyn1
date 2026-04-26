#!/usr/bin/env node

import { program } from 'commander';
import configInitCommand from '../src/commands/config-init.js';
import syncCommand from '../src/commands/sync.js';

program
  .name('wsync')
  .description('WSL2 to Windows code sync tool')
  .version('1.0.0');

// wsync config init
const configCmd = program
  .command('config')
  .description('Configuration commands');

configCmd
  .command('init')
  .description('Initialize .wsync.config.js or .wsync.config.cjs in current directory')
  .option('-y, --yes', 'Use default values without prompts')
  .action(configInitCommand);

// wsync sync
const syncCmd = program
  .command('sync')
  .description('Sync commands');

syncCmd
  .command('run')
  .alias('sync')
  .description('Execute one-time sync from WSL2 to Windows')
  .option('-c, --config <path>', 'Path to config file')
  .option('-d, --dry-run', 'Show what would be synced without executing')
  .option('-v, --verbose', 'Show detailed output')
  .action((options) => syncCommand({ ...options, watch: false }));

syncCmd
  .command('watch')
  .description('Watch files and sync automatically')
  .option('-c, --config <path>', 'Path to config file')
  .option('-v, --verbose', 'Show detailed output')
  .action((options) => syncCommand({ ...options, watch: true }));

program.parse();
