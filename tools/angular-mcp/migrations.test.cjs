const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { mkdtemp, mkdir, writeFile, readFile, rm } = require('node:fs/promises');
const { resolve, join } = require('node:path');
const { test } = require('node:test');
const { promisify } = require('node:util');
const { runMigration } = require('../../dist/angular-mcp/migrations.js');

const root = resolve(__dirname, '../..');
const exec = promisify(execFile);

test('code migration forwards path and dry-run as separate CLI arguments', async () => {
  let invocation;
  const result = await runMigration(
    { kind: 'code', migration: 'control-flow', path: 'src/app with spaces', dryRun: true },
    root,
    async (args, cwd) => {
      invocation = { args, cwd };
      return { stdout: 'preview', stderr: 'warning' };
    }
  );
  assert.equal(result.isError, undefined);
  assert.deepEqual(invocation, {
    cwd: root,
    args: [
      'generate',
      '@angular/core:control-flow',
      `--path=${join('src', 'app with spaces')}`,
      '--interactive=false',
      '--dry-run'
    ]
  });
  assert.match(result.content[0].text, /preview\nwarning/);
});

test('version migration uses migrate-only and explicit opt-in flags', async () => {
  let invocation;
  await runMigration(
    { kind: 'version', from: '19.0.0', to: '20.2.1', name: 'example', allowDirty: true },
    root,
    async args => {
      invocation = args;
      return { stdout: '', stderr: '' };
    }
  );
  assert.deepEqual(invocation, [
    'update',
    '@angular/core',
    '--migrate-only',
    '--from=19.0.0',
    '--to=20.2.1',
    '--name=example',
    '--allow-dirty'
  ]);
});

test('standalone migration forwards its selected phase', async () => {
  let invocation;
  await runMigration(
    { kind: 'code', migration: 'standalone', standaloneMode: 'prune-ng-modules' },
    root,
    async args => {
      invocation = args;
      return { stdout: '', stderr: '' };
    }
  );
  assert.ok(invocation.includes('--mode=prune-ng-modules'));
});

test('invalid inputs never launch the CLI', async () => {
  const invalid = [
    { kind: 'code', migration: 'control-flow', path: '../outside' },
    { kind: 'code', migration: 'unknown' },
    { kind: 'code', migration: 'inject', standaloneMode: 'prune-ng-modules' },
    { kind: 'version', package: '--force', from: '19.0.0' },
    { kind: 'version', from: '19.0.0; echo injected' },
    { kind: 'version', from: '19.0.0', dryRun: true },
    { kind: 'version' }
  ];
  for (const input of invalid) {
    const result = await runMigration(input, root, async () => {
      assert.fail('CLI must not run');
    });
    assert.equal(result.isError, true, JSON.stringify(input));
  }
});

test('CLI failures return MCP errors including stdout and stderr', async () => {
  const result = await runMigration({ kind: 'version', from: '19.0.0' }, root, async () => {
    throw Object.assign(new Error('CLI exited with code 1'), { stdout: 'partial output', stderr: 'migration error' });
  });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /CLI exited with code 1\npartial output\nmigration error/);
});

test('real Angular CLI previews and applies a control-flow migration in an isolated workspace', async () => {
  await mkdir(join(root, 'tmp'), { recursive: true });
  const workspace = await mkdtemp(join(root, 'tmp/angular-migration-'));
  const source =
    "import { Component } from '@angular/core';\n@Component({ template: '<p *ngIf=\"visible\">Hello</p>' })\nexport class Example { visible = true; }\n";
  try {
    await mkdir(join(workspace, 'src'));
    await writeFile(
      join(workspace, 'angular.json'),
      JSON.stringify({
        version: 1,
        projects: {
          example: {
            projectType: 'application',
            root: '',
            sourceRoot: 'src',
            architect: {
              build: {
                builder: '@angular/build:application',
                options: { tsConfig: 'tsconfig.json', browser: 'src/example.ts' }
              }
            }
          }
        }
      })
    );
    await writeFile(
      join(workspace, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { experimentalDecorators: true }, include: ['src/**/*.ts'] })
    );
    await writeFile(join(workspace, 'src/example.ts'), source);
    const runner = (args, cwd) =>
      exec(process.execPath, [join(root, 'node_modules/@angular/cli/bin/ng.js'), ...args], {
        cwd,
        env: { ...process.env, CI: 'true', NG_CLI_ANALYTICS: 'false', NG_DISABLE_VERSION_CHECK: 'true' },
        timeout: 60000
      });
    const preview = await runMigration(
      { kind: 'code', migration: 'control-flow', path: 'src', dryRun: true },
      workspace,
      runner
    );
    assert.equal(preview.isError, undefined, preview.content[0].text);
    assert.equal(await readFile(join(workspace, 'src/example.ts'), 'utf8'), source);
    const applied = await runMigration({ kind: 'code', migration: 'control-flow', path: 'src' }, workspace, runner);
    assert.equal(applied.isError, undefined, applied.content[0].text);
    assert.match(await readFile(join(workspace, 'src/example.ts'), 'utf8'), /@if\s*\(visible\)/);
    await writeFile(
      join(workspace, 'package.json'),
      JSON.stringify({
        name: 'migration-fixture',
        private: true
      })
    );
    const version = await runMigration(
      { kind: 'version', from: '20.2.1', to: '20.2.1', allowDirty: true },
      workspace,
      runner
    );
    assert.equal(version.isError, undefined, version.content[0].text);
  } finally {
    assert.ok(workspace.startsWith(join(root, 'tmp') + require('node:path').sep));
    await rm(workspace, { recursive: true, force: true });
  }
});

test('MCP server advertises and validates the migration tool over stdio', async () => {
  const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
  const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
  const client = new Client({ name: 'migration-test', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(root, 'dist/angular-mcp/index.js')],
    cwd: root,
    stderr: 'pipe'
  });
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    assert.ok(tools.some(tool => tool.name === 'generate_component'));
    assert.ok(tools.some(tool => tool.name === 'run_migration'));
    const result = await client.callTool({ name: 'run_migration', arguments: { kind: 'code', migration: 'invalid' } });
    assert.equal(result.isError, true);
  } finally {
    await client.close();
  }
});
