import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

import { scanSource, scanTarget, computeDiff } from '../src/sync/scanner.js';
import { createFilter } from '../src/filter/filter.js';

describe('Scanner', () => {
  let sourceDir;
  let targetDir;

  beforeEach(async () => {
    sourceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wsync-source-'));
    targetDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wsync-target-'));
  });

  afterEach(async () => {
    await fs.remove(sourceDir);
    await fs.remove(targetDir);
  });

  describe('scanSource', () => {
    it('should scan all files in source directory', async () => {
      await fs.writeFile(path.join(sourceDir, 'a.js'), 'a');
      await fs.writeFile(path.join(sourceDir, 'b.js'), 'b');
      await fs.ensureDir(path.join(sourceDir, 'sub'));
      await fs.writeFile(path.join(sourceDir, 'sub', 'c.js'), 'c');

      const filter = createFilter({
        source: sourceDir,
        whitelist: [],
        blacklist: []
      });

      const files = await scanSource(filter, sourceDir);

      assert.strictEqual(files.size, 3);
      assert.ok(files.has(path.join(sourceDir, 'a.js')));
      assert.ok(files.has(path.join(sourceDir, 'b.js')));
      assert.ok(files.has(path.join(sourceDir, 'sub', 'c.js')));
    });

    it('should respect gitignore rules', async () => {
      await fs.writeFile(path.join(sourceDir, '.gitignore'), 'ignored.js\n');
      await fs.writeFile(path.join(sourceDir, 'kept.js'), 'kept');
      await fs.writeFile(path.join(sourceDir, 'ignored.js'), 'ignored');

      const filter = createFilter({
        source: sourceDir,
        whitelist: [],
        blacklist: ['.gitignore']
      });

      const files = await scanSource(filter, sourceDir);

      assert.strictEqual(files.size, 1);
      assert.ok(files.has(path.join(sourceDir, 'kept.js')));
    });
  });

  describe('scanTarget', () => {
    it('should return empty map when target does not exist', async () => {
      const nonExistent = path.join(targetDir, 'nonexistent');
      const files = await scanTarget(nonExistent);
      assert.strictEqual(files.size, 0);
    });

    it('should scan all files in target directory', async () => {
      await fs.writeFile(path.join(targetDir, 'x.js'), 'x');
      await fs.writeFile(path.join(targetDir, 'y.js'), 'y');

      const files = await scanTarget(targetDir);

      assert.strictEqual(files.size, 2);
      assert.ok(files.has(path.join(targetDir, 'x.js')));
      assert.ok(files.has(path.join(targetDir, 'y.js')));
    });
  });

  describe('computeDiff', () => {
    it('should detect new files to add', () => {
      const sourceFiles = new Map([
        [path.join(sourceDir, 'new.js'), { size: 10, mtime: 1000 }]
      ]);
      const targetFiles = new Map();

      const diff = computeDiff(sourceFiles, targetFiles, sourceDir, targetDir);

      assert.strictEqual(diff.toAdd.length, 1);
      assert.strictEqual(diff.toUpdate.length, 0);
      assert.strictEqual(diff.toDelete.length, 0);
      assert.ok(diff.toAdd[0].relative.includes('new.js'));
    });

    it('should detect files to update when size differs', () => {
      const filePath = path.join(sourceDir, 'file.js');
      const sourceFiles = new Map([
        [filePath, { size: 20, mtime: 1000 }]
      ]);
      const targetFiles = new Map([
        [path.join(targetDir, 'file.js'), { size: 10, mtime: 1000 }]
      ]);

      const diff = computeDiff(sourceFiles, targetFiles, sourceDir, targetDir);

      assert.strictEqual(diff.toAdd.length, 0);
      assert.strictEqual(diff.toUpdate.length, 1);
      assert.strictEqual(diff.toDelete.length, 0);
    });

    it('should detect files to delete', () => {
      const sourceFiles = new Map();
      const targetFiles = new Map([
        [path.join(targetDir, 'old.js'), { size: 10, mtime: 1000 }]
      ]);

      const diff = computeDiff(sourceFiles, targetFiles, sourceDir, targetDir);

      assert.strictEqual(diff.toAdd.length, 0);
      assert.strictEqual(diff.toUpdate.length, 0);
      assert.strictEqual(diff.toDelete.length, 1);
    });

    it('should apply prefix correctly', () => {
      const sourceFiles = new Map([
        [path.join(sourceDir, 'app.js'), { size: 10, mtime: 1000 }]
      ]);
      const targetFiles = new Map();

      const diff = computeDiff(sourceFiles, targetFiles, sourceDir, targetDir, 'dist');

      assert.ok(diff.toAdd[0].target.includes(path.join('dist', 'app.js')));
    });

    it('should not detect changes when files are identical', () => {
      const filePath = path.join(sourceDir, 'same.js');
      const sourceFiles = new Map([
        [filePath, { size: 10, mtime: 1000 }]
      ]);
      const targetFiles = new Map([
        [path.join(targetDir, 'same.js'), { size: 10, mtime: 1000 }]
      ]);

      const diff = computeDiff(sourceFiles, targetFiles, sourceDir, targetDir);

      assert.strictEqual(diff.toAdd.length, 0);
      assert.strictEqual(diff.toUpdate.length, 0);
      assert.strictEqual(diff.toDelete.length, 0);
    });
  });
});
