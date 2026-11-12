import { execFile } from 'node:child_process';
import { isAbsolute, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';

const exec = promisify(execFile);

export const migrationSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('code'),
      migration: z.enum([
        'control-flow',
        'inject',
        'standalone',
        'route-lazy-loading',
        'signal-inputs',
        'signal-queries',
        'outputs',
        'signals',
        'cleanup-unused-imports',
        'self-closing-tag'
      ]),
      path: z.string().min(1).default('.').describe('Path relative to the Angular workspace'),
      dryRun: z.boolean().default(false).describe('Preview changes without writing files'),
      standaloneMode: z
        .enum(['convert-to-standalone', 'prune-ng-modules', 'standalone-bootstrap'])
        .optional()
        .describe('Only for the standalone migration; defaults to convert-to-standalone')
    })
    .strict(),
  z
    .object({
      kind: z.literal('version'),
      package: z
        .string()
        .regex(/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/)
        .default('@angular/core')
        .describe('Installed package whose migrations should run; does not upgrade dependencies'),
      from: z
        .string()
        .regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/)
        .describe('Starting version, e.g. 19.0.0'),
      to: z
        .string()
        .regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/)
        .optional()
        .describe('Target version; defaults to the installed version'),
      name: z
        .string()
        .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/)
        .optional()
        .describe('Run a single named version migration'),
      allowDirty: z.boolean().default(false).describe('Explicitly allow migration with uncommitted files')
    })
    .strict()
]);

type CliRunner = (args: string[], cwd: string) => Promise<{ stdout: string; stderr: string }>;

const runCli: CliRunner = (args, cwd) =>
  exec(process.execPath, [resolve(cwd, 'node_modules/@angular/cli/bin/ng.js'), ...args], {
    cwd,
    timeout: 10 * 60 * 1000,
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, CI: 'true', NG_CLI_ANALYTICS: 'false', NG_DISABLE_VERSION_CHECK: 'true' }
  });

export async function runMigration(input: unknown, cwd: string, runner: CliRunner = runCli) {
  try {
    const options = migrationSchema.parse(input);
    let args: string[];

    if (options.kind === 'code') {
      const path = relative(cwd, resolve(cwd, options.path));
      if (path === '..' || path.startsWith('../') || path.startsWith('..\\') || isAbsolute(path)) {
        throw new Error('Migration path must stay inside the Angular workspace.');
      }
      if (options.standaloneMode && options.migration !== 'standalone') {
        throw new Error('standaloneMode can only be used with the standalone migration.');
      }
      args = ['generate', `@angular/core:${options.migration}`, `--path=${path || '.'}`, '--interactive=false'];
      if (options.dryRun) args.push('--dry-run');
      if (options.migration === 'standalone') {
        args.push(`--mode=${options.standaloneMode ?? 'convert-to-standalone'}`);
      }
    } else {
      args = ['update', options.package, '--migrate-only', `--from=${options.from}`];
      if (options.to) args.push(`--to=${options.to}`);
      if (options.name) args.push(`--name=${options.name}`);
      if (options.allowDirty) args.push('--allow-dirty');
    }

    const { stdout, stderr } = await runner(args, cwd);
    return { content: [{ type: 'text' as const, text: `Migration completed.\n${stdout}\n${stderr}`.trim() }] };
  } catch (error: unknown) {
    const failure = error as { message?: string; stdout?: string; stderr?: string } | null;
    const details = [failure?.message ?? String(error), failure?.stdout, failure?.stderr].filter(Boolean).join('\n');
    return { isError: true, content: [{ type: 'text' as const, text: `Migration failed:\n${details}` }] };
  }
}
