import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

import { findConfig, loadConfig, validateConfig } from '../src/config/loader.js';

describe('Config Loader', () => {
  let tempDir;
  let nestedDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wsync-test-'));
    nestedDir = path.join(tempDir, 'a', 'b', 'c');
    await fs.ensureDir(nestedDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('findConfig', () => {
    it('should find config in current directory', async () => {
      const configPath = path.join(tempDir, '.wsync.config.js');
      await fs.writeFile(configPath, 'export default { target: "/mnt/c/test" };');

      const found = findConfig(tempDir);
      assert.strictEqual(found, configPath);
    });

    it('should find config in parent directory', async () => {
      const configPath = path.join(tempDir, '.wsync.config.js');
      await fs.writeFile(configPath, 'export default { target: "/mnt/c/test" };');

      const found = findConfig(nestedDir);
      assert.strictEqual(found, configPath);
    });

    it('should return null when no config exists', () => {
      const found = findConfig(tempDir);
      assert.strictEqual(found, null);
    });
  });

  describe('loadConfig', () => {
    it('should load and resolve paths (ESM syntax)', async () => {
      const configPath = path.join(tempDir, '.wsync.config.js');
      await fs.writeFile(configPath, `
        export default {
          source: '.',
          target: '/mnt/c/test',
          prefix: 'dist',
          whitelist: ['dist/'],
          blacklist: ['.env']
        };
      `);

      const config = await loadConfig(configPath);

      assert.ok(config.source.endsWith(path.basename(tempDir)));
      assert.strictEqual(config.source, tempDir);
      assert.strictEqual(config.target, '/mnt/c/test');
      assert.strictEqual(config.prefix, 'dist');
      assert.strictEqual(config._configDir, tempDir);
    });

    it('should load CJS syntax with module.exports', async () => {
      const configPath = path.join(tempDir, '.wsync.config.js');
      await fs.writeFile(configPath, `
        module.exports = {
          source: '.',
          target: '/mnt/c/test'
        };
      `);

      const config = await loadConfig(configPath);
      assert.strictEqual(config.source, tempDir);
      assert.strictEqual(config.target, '/mnt/c/test');
    });

    it('should resolve relative source path', async () => {
      const configPath = path.join(tempDir, '.wsync.config.js');
      await fs.writeFile(configPath, `
        export default {
          source: './src',
          target: '/mnt/c/test'
        };
      `);

      const config = await loadConfig(configPath);
      assert.strictEqual(config.source, path.join(tempDir, 'src'));
    });
  });

  describe('validateConfig', () => {
    it('should pass with valid config', async () => {
      const validDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wsync-valid-'));
      const config = {
        source: validDir,
        target: '/mnt/c/test',
        whitelist: [],
        blacklist: []
      };

      const result = validateConfig(config);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
      await fs.remove(validDir);
    });

    it('should fail when target is missing', () => {
      const config = {
        source: '/home/user/project'
      };

      const result = validateConfig(config);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('target')));
    });

    it('should fail when source does not exist', () => {
      const config = {
        source: '/nonexistent/path',
        target: '/mnt/c/test'
      };

      const result = validateConfig(config);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Source')));
    });

    it('should fail when whitelist is not array', () => {
      const config = {
        source: '/home/user/project',
        target: '/mnt/c/test',
        whitelist: 'dist/'
      };

      const result = validateConfig(config);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('whitelist')));
    });
  });
});
