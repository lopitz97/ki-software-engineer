const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/auto-fix.yml'), 'utf8').replace(/\r\n/g, '\n');
const publication = workflow
  .split('      - name: Create Pull Request if changes were made')[1]
  .split('        run: |\n')[1]
  .split('\n  notify-failure:')[0]
  .split('\n')
  .map(line => line.replace(/^          /, ''))
  .join('\n');
const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';

function fixture() {
  fs.mkdirSync(path.join(root, 'tmp'), { recursive: true });
  const dir = fs.mkdtempSync(path.join(root, 'tmp/auto-fix-pr-'));
  const repo = path.join(dir, 'repo');
  const remote = path.join(dir, 'remote.git');
  fs.mkdirSync(repo);
  const git = (...args) =>
    execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '--bare', remote);
  git('init', '-b', 'feature/demo');
  git('config', 'user.name', 'Test');
  git('config', 'user.email', 'test@example.com');
  fs.writeFileSync(path.join(repo, '.gitignore'), '/tmp\n');
  fs.writeFileSync(path.join(repo, 'app.txt'), 'broken\n');
  git('add', '.');
  git('commit', '-m', 'Initial state');
  git('remote', 'add', 'origin', remote);
  git('push', 'origin', 'feature/demo');
  const source = git('rev-parse', 'HEAD');
  git('switch', '-c', 'auto-fix/123-1');
  fs.mkdirSync(path.join(repo, 'tmp'));
  fs.writeFileSync(path.join(repo, 'tmp/auto-fix-summary.md'), '## Repair\n\nCorrected the invalid configuration.\n');
  const repair = () => {
    fs.writeFileSync(path.join(repo, 'app.txt'), 'fixed\n');
    git('add', 'app.txt');
    git('commit', '-m', 'fix: correct configuration');
  };
  const run = () =>
    spawnSync(
      bash,
      [
        '-c',
        `
    gh() {
      printf '%s\\n' "$@" >> "$RUNNER_TEMP/gh-calls.txt"
      if [[ "$1 $2" == 'pr create' ]]; then
        echo 'https://github.com/example/repo/pull/42'
      fi
    }
    ${publication}
  `
      ],
      {
        cwd: repo,
        encoding: 'utf8',
        env: {
          ...process.env,
          SOURCE_SHA: source,
          BASE_BRANCH: 'feature/demo',
          FIX_BRANCH: 'auto-fix/123-1',
          FAILED_RUN_URL: 'https://github.com/example/repo/actions/runs/100',
          GITHUB_REPOSITORY: 'example/repo',
          RUNNER_TEMP: dir.replaceAll('\\', '/'),
          GITHUB_STEP_SUMMARY: path.join(dir, 'summary.md').replaceAll('\\', '/')
        }
      }
    );
  const published = () => git('ls-remote', 'origin', 'refs/heads/auto-fix/123-1');
  return { dir, repo, git, source, repair, run, published };
}

test('publishes committed repairs to a new branch and describes them in a PR against the source branch', () => {
  const f = fixture();
  f.repair();
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.ok(f.published().startsWith(f.git('rev-parse', 'HEAD')));
  assert.ok(f.git('ls-remote', 'origin', 'refs/heads/feature/demo').startsWith(f.source));
  const calls = fs.readFileSync(path.join(f.dir, 'gh-calls.txt'), 'utf8');
  assert.match(calls, /--base\nfeature\/demo\n--head\nauto-fix\/123-1/);
  assert.match(calls, /--body-file/);
  const body = fs.readFileSync(path.join(f.dir, 'auto-fix-pr.md'), 'utf8');
  assert.match(body, /Corrected the invalid configuration/);
  assert.match(body, /independently verified `npm run build` successfully/);
  assert.ok(body.includes(f.source));
  assert.match(body, /actions\/runs\/100/);
  assert.match(fs.readFileSync(path.join(f.dir, 'summary.md'), 'utf8'), /pull\/42/);
});

test('does not publish when there is no repair', () => {
  const f = fixture();
  assert.equal(f.run().status, 0);
  assert.equal(f.published(), '');
  assert.equal(fs.existsSync(path.join(f.dir, 'gh-calls.txt')), false);
});

test('rejects uncommitted repair changes', () => {
  const f = fixture();
  fs.writeFileSync(path.join(f.repo, 'app.txt'), 'not committed\n');
  assert.notEqual(f.run().status, 0);
  assert.equal(f.published(), '');
});

test('rejects missing repair descriptions before pushing', () => {
  const f = fixture();
  f.repair();
  fs.unlinkSync(path.join(f.repo, 'tmp/auto-fix-summary.md'));
  assert.notEqual(f.run().status, 0);
  assert.equal(f.published(), '');
});

test('skips stale repairs when the source branch advanced', () => {
  const f = fixture();
  f.repair();
  f.git('push', 'origin', 'HEAD:refs/heads/feature/demo');
  assert.equal(f.run().status, 0);
  assert.equal(f.published(), '');
});

test('rejects repairs on an unexpected branch', () => {
  const f = fixture();
  f.repair();
  f.git('switch', '-c', 'unexpected');
  assert.notEqual(f.run().status, 0);
  assert.equal(f.published(), '');
});
