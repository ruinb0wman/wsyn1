import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

import { createFilter } from '../src/filter/filter.js';

describe('Filter', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wsync-filter-'));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('shouldSync', () => {
    it('should sync normal files not in gitignore', async () => {
      await fs.writeFile(path.join(tempDir, '.gitignore'), 'node_modules/\n');
      await fs.writeFile(path.join(tempDir, 'index.js'), 'console.log("hello");');

      const filter = createFilter({
        source: tempDir,
        whitelist: [],
        blacklist: []
      });

      assert.strictEqual(
        filter.shouldSync(path.join(tempDir, 'index.js')),
        true
      );
    });

    it('should ignore files in gitignore', async () => {
      await fs.writeFile(path.join(tempDir, '.gitignore'), 'node_modules/\n');
      await fs.ensureDir(path.join(tempDir, 'node_modules'));
      await fs.writeFile(path.join(tempDir, 'node_modules', 'test.js'), '');

      const filter = createFilter({
        source: tempDir,
        whitelist: [],
        blacklist: []
      });

      assert.strictEqual(
        filter.shouldSync(path.join(tempDir, 'node_modules', 'test.js')),
        false
      );
    });

    it('should sync whitelisted files even if in gitignore', async () => {
      await fs.writeFile(path.join(tempDir, '.gitignore'), 'dist/\n');
      await fs.ensureDir(path.join(tempDir, 'dist'));
      await fs.writeFile(path.join(tempDir, 'dist', 'build.js'), '');

      const filter = createFilter({
        source: tempDir,
        whitelist: ['dist/'],
        blacklist: []
      });

      assert.strictEqual(
        filter.shouldSync(path.join(tempDir, 'dist', 'build.js')),
        true
      );
    });

    it('should ignore blacklisted files even if not in gitignore', async () => {
      await fs.writeFile(path.join(tempDir, '.gitignore'), '');
      await fs.writeFile(path.join(tempDir, '.env'), 'SECRET=***');

      const filter = createFilter({
        source: tempDir,
        whitelist: [],
        blacklist: ['.env']
      });

      assert.strictEqual(
        filter.shouldSync(path.join(tempDir, '.env')),
        false
      );
    });

    it('should prioritize blacklist over whitelist', async () => {
      await fs.writeFile(path.join(tempDir, '.gitignore'), '');
      await fs.writeFile(path.join(tempDir, 'secret.txt'), '');

      const filter = createFilter({
        source: tempDir,
        whitelist: ['secret.txt'],
        blacklist: ['secret.txt']
      });

      assert.strictEqual(
        filter.shouldSync(path.join(tempDir, 'secret.txt')),
        false
      );
    });

    it('should handle glob patterns in blacklist', async () => {
      await fs.writeFile(path.join(tempDir, '.gitignore'), '');
      await fs.writeFile(path.join(tempDir, 'app.log'), '');
      await fs.writeFile(path.join(tempDir, 'debug.log'), '');

      const filter = createFilter({
        source: tempDir,
        whitelist: [],
        blacklist: ['*.log']
      });

      assert.strictEqual(
        filter.shouldSync(path.join(tempDir, 'app.log')),
        false
      );
      assert.strictEqual(
        filter.shouldSync(path.join(tempDir, 'debug.log')),
        false
      );
    });

    it('should handle directory patterns', async () => {
      await fs.writeFile(path.join(tempDir, '.gitignore'), '');
      await fs.ensureDir(path.join(tempDir, 'tmp'));
      await fs.writeFile(path.join(tempDir, 'tmp', 'file.txt'), '');

      const filter = createFilter({
        source: tempDir,
        whitelist: [],
        blacklist: ['tmp/']
      });

      assert.strictEqual(
        filter.shouldSync(path.join(tempDir, 'tmp', 'file.txt')),
        false
      );
    });

    it('should always allow root directory', async () => {
      const filter = createFilter({
        source: tempDir,
        whitelist: [],
        blacklist: []
      });

      assert.strictEqual(filter.shouldSync(tempDir), true);
      assert.strictEqual(filter.shouldSync(''), true);
    });
  });
});
