import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * TAPS-2.6: asserts the deploy config is wired correctly. This is
 * deliberately a thin, static check — it cannot prove `prisma migrate
 * deploy` actually runs successfully against a real database at deploy
 * time (that's the real, non-mocked evidence recorded in
 * docs/adr/020-migrate-deploy-release-command.md: a local build of the
 * exact production image, run against the real Neon database, plus a
 * real `fly deploy`). What this guards against is silent config drift —
 * someone editing fly.toml or package.json later and accidentally
 * removing the release_command wiring or the CLI dependency it needs.
 */
describe('apps/api deploy config (TAPS-2.6)', () => {
  const flyToml = readFileSync(join(__dirname, 'fly.toml'), 'utf8');
  const packageJson = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  it("wires `prisma migrate deploy` into fly.toml's [deploy] release_command", () => {
    const deploySection = flyToml.match(/\[deploy\]([\s\S]*?)(\n\[|$)/);
    expect(deploySection, 'fly.toml has no [deploy] section').not.toBeNull();
    expect(deploySection![1]).toMatch(/release_command\s*=\s*'npx prisma migrate deploy'/);
  });

  it('ships the `prisma` CLI as a production dependency, not a devDependency', () => {
    // Fly's release_command runs in a temporary machine built from the same
    // image that gets deployed (confirmed against Fly's own docs) — so the
    // CLI must be reachable at runtime, not just at build time.
    expect(packageJson.dependencies?.prisma).toBeDefined();
    expect(packageJson.devDependencies?.prisma).toBeUndefined();
  });
});
