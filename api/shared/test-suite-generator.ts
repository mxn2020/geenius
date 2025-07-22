// Test Suite Generator for Agentic AI System
import { CustomAIAgent } from './custom-ai-agent';
import { EnhancedGitHubService, FileChange } from '../../src/services/enhanced-github-service';

export interface TestFile {
  path: string;
  content: string;
  type: 'unit' | 'integration' | 'e2e' | 'visual';
  framework: 'jest' | 'vitest' | 'playwright' | 'cypress';
  description: string;
}

export interface TestSuite {
  name: string;
  files: TestFile[];
  setup: string[];
  dependencies: string[];
  runCommand: string;
  coverage: {
    files: string[];
    threshold: number;
  };
}

export interface TestGenerationConfig {
  framework: 'jest' | 'vitest' | 'playwright' | 'cypress';
  includeVisualTests: boolean;
  includeAccessibilityTests: boolean;
  coverageThreshold: number;
  testTypes: ('unit' | 'integration' | 'e2e')[];
}

export class TestSuiteGenerator {
  private aiAgent: CustomAIAgent;
  private githubService: EnhancedGitHubService;

  constructor(aiProvider: 'anthropic' | 'openai' | 'google' | 'grok' = 'anthropic') {
    this.aiAgent = new CustomAIAgent({
      provider: aiProvider,
      role: 'qa-engineer',
      expertise: ['testing', 'react-testing-library', 'playwright', 'jest', 'vitest']
    });
    this.githubService = new EnhancedGitHubService();
  }

  /**
   * Generate comprehensive test suite for file changes
   */
  async generateTestSuite(
    fileChanges: FileChange[],
    changes: any[],
    config: TestGenerationConfig
  ): Promise<TestSuite> {
    const testFiles: TestFile[] = [];
    const dependencies = new Set<string>();
    const setupInstructions: string[] = [];

    // Generate tests for each changed file
    for (const fileChange of fileChanges) {
      const relatedChanges = changes.filter(change => 
        change.componentContext?.filePath === fileChange.path ||
        change.metadata?.filePath === fileChange.path
      );

      if (relatedChanges.length === 0) continue;

      // Generate different types of tests based on config
      if (config.testTypes.includes('unit')) {
        const unitTests = await this.generateUnitTests(fileChange, relatedChanges);
        testFiles.push(...unitTests);
        dependencies.add('@testing-library/react');
        dependencies.add('@testing-library/jest-dom');
        dependencies.add('@testing-library/user-event');
      }

      if (config.testTypes.includes('integration')) {
        const integrationTests = await this.generateIntegrationTests(fileChange, relatedChanges);
        testFiles.push(...integrationTests);
      }

      if (config.testTypes.includes('e2e')) {
        const e2eTests = await this.generateE2ETests(fileChange, relatedChanges, config.framework);
        testFiles.push(...e2eTests);
        
        if (config.framework === 'playwright') {
          dependencies.add('@playwright/test');
        } else if (config.framework === 'cypress') {
          dependencies.add('cypress');
        }
      }

      if (config.includeVisualTests) {
        const visualTests = await this.generateVisualRegressionTests(fileChange, relatedChanges);
        testFiles.push(...visualTests);
        dependencies.add('@percy/playwright'); // or similar
      }

      if (config.includeAccessibilityTests) {
        const a11yTests = await this.generateAccessibilityTests(fileChange, relatedChanges);
        testFiles.push(...a11yTests);
        dependencies.add('@axe-core/playwright');
      }
    }

    // Generate setup instructions
    setupInstructions.push(...this.generateSetupInstructions(config, Array.from(dependencies)));

    // Determine run command
    const runCommand = this.generateRunCommand(config);

    return {
      name: `AI-Generated Test Suite - ${new Date().toISOString().split('T')[0]}`,
      files: testFiles,
      setup: setupInstructions,
      dependencies: Array.from(dependencies),
      runCommand,
      coverage: {
        files: fileChanges.map(fc => fc.path),
        threshold: config.coverageThreshold
      }
    };
  }

  /**
   * Generate unit tests for a file
   */
  private async generateUnitTests(fileChange: FileChange, changes: any[]): Promise<TestFile[]> {
    const prompt = `
Generate comprehensive unit tests for this React/TypeScript component:

File: ${fileChange.path}
Code:
\`\`\`typescript
${fileChange.content}
\`\`\`

Changes made:
${changes.map(change => `- ${change.componentId}: ${change.feedback}`).join('\n')}

Create unit tests that:
1. Test component rendering
2. Test user interactions (clicks, inputs, etc.)
3. Test prop handling and edge cases
4. Test state changes if applicable
5. Test the specific changes that were made

Use React Testing Library with Jest/Vitest. Include:
- Proper imports and setup
- Descriptive test names
- Comprehensive assertions
- Mock functions where needed
- Error boundary testing if applicable

Return JSON format:
{
  "testFiles": [
    {
      "filename": "ComponentName.test.tsx",
      "content": "complete test file content"
    }
  ]
}
`;

    try {
      const response = await this.aiAgent.processRequest(prompt);
      const result = JSON.parse(response);
      
      return result.testFiles.map((tf: any) => ({
        path: this.getTestPath(fileChange.path, tf.filename),
        content: tf.content,
        type: 'unit' as const,
        framework: 'vitest' as const,
        description: `Unit tests for ${fileChange.path}`
      }));
    } catch (error) {
      console.error('Failed to generate unit tests:', error);
      return [];
    }
  }

  /**
   * Generate integration tests
   */
  private async generateIntegrationTests(fileChange: FileChange, changes: any[]): Promise<TestFile[]> {
    const prompt = `
Generate integration tests for this component that test how it works with other components:

File: ${fileChange.path}
Code:
\`\`\`typescript
${fileChange.content}
\`\`\`

Changes made:
${changes.map(change => `- ${change.componentId}: ${change.feedback}`).join('\n')}

Create integration tests that:
1. Test component interactions with parent/child components
2. Test data flow and state management
3. Test API calls and side effects
4. Test routing if applicable
5. Test context providers and consumers

Use React Testing Library with proper mocking for external dependencies.

Return JSON format:
{
  "testFiles": [
    {
      "filename": "ComponentName.integration.test.tsx",
      "content": "complete integration test file content"
    }
  ]
}
`;

    try {
      const response = await this.aiAgent.processRequest(prompt);
      const result = JSON.parse(response);
      
      return result.testFiles.map((tf: any) => ({
        path: this.getTestPath(fileChange.path, tf.filename),
        content: tf.content,
        type: 'integration' as const,
        framework: 'vitest' as const,
        description: `Integration tests for ${fileChange.path}`
      }));
    } catch (error) {
      console.error('Failed to generate integration tests:', error);
      return [];
    }
  }

  /**
   * Generate E2E tests
   */
  private async generateE2ETests(
    fileChange: FileChange, 
    changes: any[], 
    framework: 'playwright' | 'cypress'
  ): Promise<TestFile[]> {
    const prompt = `
Generate end-to-end tests using ${framework} for this component:

File: ${fileChange.path}
Changes made:
${changes.map(change => `- ${change.componentId}: ${change.feedback}`).join('\n')}

Create E2E tests that:
1. Test complete user workflows
2. Test cross-browser compatibility
3. Test responsive design
4. Test the specific UI changes that were made
5. Test error scenarios and edge cases

Use ${framework} best practices and include:
- Page object model if appropriate
- Proper waiting for elements
- Screenshot comparisons for visual changes
- Mobile/desktop testing if responsive changes were made

Return JSON format:
{
  "testFiles": [
    {
      "filename": "component-workflow.spec.ts",
      "content": "complete ${framework} test file content"
    }
  ]
}
`;

    try {
      const response = await this.aiAgent.processRequest(prompt);
      const result = JSON.parse(response);
      
      return result.testFiles.map((tf: any) => ({
        path: `e2e/${tf.filename}`,
        content: tf.content,
        type: 'e2e' as const,
        framework,
        description: `E2E tests for ${fileChange.path}`
      }));
    } catch (error) {
      console.error('Failed to generate E2E tests:', error);
      return [];
    }
  }

  /**
   * Generate visual regression tests
   */
  private async generateVisualRegressionTests(fileChange: FileChange, changes: any[]): Promise<TestFile[]> {
    const prompt = `
Generate visual regression tests for UI changes:

File: ${fileChange.path}
UI Changes:
${changes.filter(c => c.category === 'ui' || c.category === 'styling').map(c => `- ${c.feedback}`).join('\n')}

Create visual tests that:
1. Capture screenshots of different component states
2. Test responsive breakpoints
3. Test theme variations if applicable
4. Test hover/focus states
5. Test loading/error states

Use Playwright with Percy or similar visual testing tools.

Return JSON format:
{
  "testFiles": [
    {
      "filename": "ComponentName.visual.spec.ts",
      "content": "complete visual test file content"
    }
  ]
}
`;

    try {
      const response = await this.aiAgent.processRequest(prompt);
      const result = JSON.parse(response);
      
      return result.testFiles.map((tf: any) => ({
        path: `tests/visual/${tf.filename}`,
        content: tf.content,
        type: 'visual' as const,
        framework: 'playwright' as const,
        description: `Visual regression tests for ${fileChange.path}`
      }));
    } catch (error) {
      console.error('Failed to generate visual tests:', error);
      return [];
    }
  }

  /**
   * Generate accessibility tests
   */
  private async generateAccessibilityTests(fileChange: FileChange, changes: any[]): Promise<TestFile[]> {
    const prompt = `
Generate accessibility tests for this component:

File: ${fileChange.path}
Changes: ${changes.map(c => c.feedback).join(', ')}

Create accessibility tests that:
1. Test ARIA attributes and roles
2. Test keyboard navigation
3. Test screen reader compatibility
4. Test color contrast
5. Test focus management

Use axe-core with Playwright or Jest.

Return JSON format:
{
  "testFiles": [
    {
      "filename": "ComponentName.a11y.spec.ts",
      "content": "complete accessibility test file content"
    }
  ]
}
`;

    try {
      const response = await this.aiAgent.processRequest(prompt);
      const result = JSON.parse(response);
      
      return result.testFiles.map((tf: any) => ({
        path: `tests/accessibility/${tf.filename}`,
        content: tf.content,
        type: 'unit' as const,
        framework: 'playwright' as const,
        description: `Accessibility tests for ${fileChange.path}`
      }));
    } catch (error) {
      console.error('Failed to generate accessibility tests:', error);
      return [];
    }
  }

  /**
   * Generate setup instructions for the test suite
   */
  private generateSetupInstructions(config: TestGenerationConfig, dependencies: string[]): string[] {
    const instructions: string[] = [];

    instructions.push('# Test Suite Setup Instructions');
    instructions.push('');
    instructions.push('## Install Dependencies');
    instructions.push(`npm install --save-dev ${dependencies.join(' ')}`);
    instructions.push('');

    if (config.framework === 'playwright') {
      instructions.push('## Playwright Setup');
      instructions.push('npx playwright install');
      instructions.push('');
    }

    if (config.includeVisualTests) {
      instructions.push('## Visual Testing Setup');
      instructions.push('# Configure Percy or similar visual testing service');
      instructions.push('# Set PERCY_TOKEN environment variable');
      instructions.push('');
    }

    instructions.push('## Configuration Files');
    instructions.push('# Update vitest.config.ts or jest.config.js');
    instructions.push('# Configure test coverage thresholds');
    instructions.push('# Set up test environment');

    return instructions;
  }

  /**
   * Generate run command based on configuration
   */
  private generateRunCommand(config: TestGenerationConfig): string {
    const commands: string[] = [];

    if (config.testTypes.includes('unit')) {
      commands.push('npm run test:unit');
    }

    if (config.testTypes.includes('integration')) {
      commands.push('npm run test:integration');
    }

    if (config.testTypes.includes('e2e')) {
      if (config.framework === 'playwright') {
        commands.push('npx playwright test');
      } else {
        commands.push('npx cypress run');
      }
    }

    if (config.includeVisualTests) {
      commands.push('npm run test:visual');
    }

    return commands.join(' && ');
  }

  /**
   * Get appropriate test file path
   */
  private getTestPath(originalPath: string, testFilename: string): string {
    const pathParts = originalPath.split('/');
    pathParts.pop(); // Remove filename
    
    // Place tests in __tests__ directory next to source
    return [...pathParts, '__tests__', testFilename].join('/');
  }

  /**
   * Generate test configuration files
   */
  async generateTestConfig(config: TestGenerationConfig): Promise<{
    vitestConfig?: string;
    playwrightConfig?: string;
    packageJsonScripts: Record<string, string>;
  }> {
    const packageJsonScripts: Record<string, string> = {};

    let vitestConfig = '';
    let playwrightConfig = '';

    if (config.framework === 'vitest' || config.testTypes.includes('unit')) {
      vitestConfig = `
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      threshold: {
        global: {
          branches: ${config.coverageThreshold},
          functions: ${config.coverageThreshold},
          lines: ${config.coverageThreshold},
          statements: ${config.coverageThreshold}
        }
      }
    }
  }
});
`;

      packageJsonScripts['test:unit'] = 'vitest run';
      packageJsonScripts['test:unit:watch'] = 'vitest';
      packageJsonScripts['test:coverage'] = 'vitest run --coverage';
    }

    if (config.framework === 'playwright' || config.testTypes.includes('e2e')) {
      playwrightConfig = `
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
`;

      packageJsonScripts['test:e2e'] = 'playwright test';
      packageJsonScripts['test:e2e:ui'] = 'playwright test --ui';
    }

    if (config.includeVisualTests) {
      packageJsonScripts['test:visual'] = 'percy exec -- playwright test tests/visual';
    }

    packageJsonScripts['test:all'] = Object.keys(packageJsonScripts)
      .filter(key => key.startsWith('test:') && !key.includes(':watch') && !key.includes(':ui'))
      .map(key => `npm run ${key}`)
      .join(' && ');

    return {
      vitestConfig: vitestConfig || undefined,
      playwrightConfig: playwrightConfig || undefined,
      packageJsonScripts
    };
  }

  /**
   * Commit test files to repository
   */
  async commitTestSuite(
    repoUrl: string,
    branchName: string,
    testSuite: TestSuite
  ): Promise<void> {
    const fileChanges: FileChange[] = testSuite.files.map(testFile => ({
      path: testFile.path,
      content: testFile.content,
      message: `Add ${testFile.type} tests for ${testFile.description}`
    }));

    // Add configuration files
    const testConfig = await this.generateTestConfig({
      framework: 'vitest',
      includeVisualTests: false,
      includeAccessibilityTests: false,
      coverageThreshold: 80,
      testTypes: ['unit', 'integration', 'e2e']
    });

    if (testConfig.vitestConfig) {
      fileChanges.push({
        path: 'vitest.config.ts',
        content: testConfig.vitestConfig,
        message: 'Add Vitest configuration for AI-generated tests'
      });
    }

    if (testConfig.playwrightConfig) {
      fileChanges.push({
        path: 'playwright.config.ts',
        content: testConfig.playwrightConfig,
        message: 'Add Playwright configuration for E2E tests'
      });
    }

    // Commit all test files
    await this.githubService.commitChanges(repoUrl, branchName, fileChanges);
  }
}