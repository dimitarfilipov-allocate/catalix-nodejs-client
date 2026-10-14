const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const workflowDir = path.resolve(__dirname, '../../.github/workflows');
const source = fs.readFileSync(path.join(workflowDir, 'enhancement-implementer.md'), 'utf8');
const compiled = fs.readFileSync(path.join(workflowDir, 'enhancement-implementer.lock.yml'), 'utf8');

test.describe('Enhancement Implementer authentication', () => {
  test('grants Copilot inference access while keeping repository access read-only', () => {
    const permissions = source.match(/^permissions:\n((?:[ \t]+.*\n)+)/m)[1];

    expect(permissions).toContain('copilot-requests: write');
    expect(permissions).toContain('contents: read');
    expect(permissions).toContain('issues: read');
    expect(permissions).toContain('pull-requests: read');
  });

  for (const job of ['agent', 'detection']) {
    test(`${job} uses the built-in token instead of the Copilot secret`, () => {
      const jobConfig = compiled.match(new RegExp(`^  ${job}:\\n([\\s\\S]*?)(?=^  [\\w-]+:|$(?![\\s\\S]))`, 'm'))[1];

      expect(jobConfig).toContain('copilot-requests: write');
      expect(jobConfig).toContain('COPILOT_GITHUB_TOKEN: ${{ github.token }}');
      expect(jobConfig).not.toContain('secrets.COPILOT_GITHUB_TOKEN');
    });
  }
});
