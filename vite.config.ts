import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

// Short commit hash shown in the HUD so playtest reports can name the exact build.
const buildId = (process.env.GITHUB_SHA ?? 'local').slice(0, 7);

/** Every file under `dir`, as paths relative to it with forward slashes. */
function listFiles(dir: string, root = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path, root) : [relative(root, path).split('\\').join('/')];
  });
}

/**
 * Writes dist/sw.js from src/pwa/sw.js with this build's file list, so the installed app
 * caches the whole game for offline play. The cache version is a hash of the file names
 * (they're content-hashed), the public files' contents and the worker template.
 */
function pwaPlugin(): Plugin {
  return {
    name: 'steel-vulture-pwa',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const publicFiles = listFiles('public');
      const files = ['./', ...Object.keys(bundle), ...publicFiles].filter((f) => f !== 'sw.js' && !f.endsWith('.map'));
      if (!files.includes('index.html')) this.error('pwa: index.html missing from the bundle');
      const template = readFileSync('src/pwa/sw.js', 'utf8');
      const hash = createHash('sha256').update(files.join('\n')).update(template);
      for (const f of publicFiles) hash.update(readFileSync(join('public', f)));
      const source = template
        .replace('__VERSION__', hash.digest('hex').slice(0, 12))
        .replace('__FILES__', JSON.stringify(files, null, 2));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  // Relative base so the build works at any GitHub Pages path (/<repo>/) and locally.
  base: './',
  plugins: [pwaPlugin()],
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  build: {
    // ES2020 keeps the game running on older phones and browsers (e.g. iOS 14+ Safari).
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
    rolldownOptions: {
      output: {
        // Phaser in its own chunk: it rarely changes, so browsers keep it cached between deploys.
        codeSplitting: {
          groups: [{ name: 'phaser', test: /node_modules[\\/]phaser/ }],
        },
      },
    },
  },
});
