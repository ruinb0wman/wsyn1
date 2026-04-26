import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

import { executeSync } from '../src/sync/executor.js';

describe('Executor', () => {
  let targetDir;

  beforeEach(async () => {
    targetDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wsync-exec-'));
  });

  afterEach(async () => {
    await fs.remove(targetDir);
  });

  describe('executeSync', () => {
    it('should add new files', async () => {
      const sourceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wsync-src-'));
      await fs.writeFile(path.join(sourceDir, 'new.js'), 'content');

      const diff = {
        toAdd: [{
          source: path.join(sourceDir, 'new.js'),
          target: path.join(targetDir, 'new.js'),
          relative: 'new.js'
        }],
        toUpdate: [],
        toDelete: []
      };

      const stats = await executeSync(diff, { dryRun: false, verbose: false, delete: true });

      assert.strictEqual(stats.added, 1);
      assert.strictEqual(stats.updated, 0);
      assert.strictEqual(stats.deleted, 0);
      assert.strictEqual(stats.errors.length, 0);

      const exists = await fs.pathExists(path.join(targetDir, 'new.js'));
      assert.strictEqual(exists, true);

      await fs.remove(sourceDir);
    });

    it('should update existing files', async () => {
      const sourceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wsync-src-'));
      await fs.writeFile(path.join(sourceDir, 'file.js'), 'new content');
      await fs.writeFile(path.join(targetDir, 'file.js'), 'old content');

      const diff = {
        toAdd: [],
        toUpdate: [{
          source: path.join(sourceDir, 'file.js'),
          target: path.join(targetDir, 'file.js'),
          relative: 'file.js'
        }],
        toDelete: []
      };

      const stats = await executeSync(diff, { dryRun: false, verbose: false, delete: true });

      assert.strictEqual(stats.added, 0);
      assert.strictEqual(stats.updated, 1);
      assert.strictEqual(stats.deleted, 0);

      const content = await fs.readFile(path.join(targetDir, 'file.js'), 'utf8');
      assert.strictEqual(content, 'new content');

      await fs.remove(sourceDir);
    });

    it('should delete files when delete option is true', async () => {
      await fs.writeFile(path.join(targetDir, 'old.js'), 'old');

      const diff = {
        toAdd: [],
        toUpdate: [],
        toDelete: [{
          target: path.join(targetDir, 'old.js'),
          relative: 'old.js'
        }]
      };

      const stats = await executeSync(diff, { dryRun: false, verbose: false, delete: true });

      assert.strictEqual(stats.deleted, 1);

      const exists = await fs.pathExists(path.join(targetDir, 'old.js'));
      assert.strictEqual(exists, false);
    });

    it('should not delete files when delete option is false', async () => {
      await fs.writeFile(path.join(targetDir, 'old.js'), 'old');

      const diff = {
        toAdd: [],
        toUpdate: [],
        toDelete: [{
          target: path.join(targetDir, 'old.js'),
          relative: 'old.js'
        }]
      };

      const stats = await executeSync(diff, { dryRun: false, verbose: false, delete: false });

      assert.strictEqual(stats.deleted, 0);

      const exists = await fs.pathExists(path.join(targetDir, 'old.js'));
      assert.strictEqual(exists, true);
    });

    it('should not execute in dry-run mode', async () => {
      const sourceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wsync-src-'));
      await fs.writeFile(path.join(sourceDir, 'dry.js'), 'content');

      const diff = {
        toAdd: [{
          source: path.join(sourceDir, 'dry.js'),
          target: path.join(targetDir, 'dry.js'),
          relative: 'dry.js'
        }],
        toUpdate: [],
        toDelete: []
      };

      const stats = await executeSync(diff, { dryRun: true, verbose: false, delete: true });

      assert.strictEqual(stats.added, 0);
      assert.strictEqual(stats.updated, 0);
      assert.strictEqual(stats.deleted, 0);

      const exists = await fs.pathExists(path.join(targetDir, 'dry.js'));
      assert.strictEqual(exists, false);

      await fs.remove(sourceDir);
    });

    it('should handle empty diff', async () => {
      const diff = {
        toAdd: [],
        toUpdate: [],
        toDelete: []
      };

      const stats = await executeSync(diff, { dryRun: false, verbose: false, delete: true });

      assert.strictEqual(stats.added, 0);
      assert.strictEqual(stats.updated, 0);
      assert.strictEqual(stats.deleted, 0);
    });
  });
});
