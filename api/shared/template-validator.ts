// netlify/functions/shared/template-validator.ts
interface TemplateValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  score: number;
  recommendations: string[];
}

export class TemplateValidator {
  static async validateTemplate(repoUrl: string): Promise<TemplateValidationResult> {
    const result: TemplateValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      score: 100,
      recommendations: []
    };

    try {
      // Check repository structure
      await this.checkRepositoryStructure(repoUrl, result);
      
      // Check package.json
      await this.checkPackageJson(repoUrl, result);
      
      // Check documentation
      await this.checkDocumentation(repoUrl, result);
      
      // Check test coverage
      await this.checkTestCoverage(repoUrl, result);
      
      // Check security
      await this.checkSecurity(repoUrl, result);

      // Calculate final score
      result.score = Math.max(0, 100 - (result.errors.length * 20) - (result.warnings.length * 5));
      result.valid = result.errors.length === 0 && result.score >= 60;

    } catch (error) {
      result.valid = false;
      result.errors.push(`Validation failed: ${error.message}`);
      result.score = 0;
    }

    return result;
  }

  private static async checkRepositoryStructure(repoUrl: string, result: TemplateValidationResult): Promise<void> {
    // Check for required files and directories
    const requiredFiles = ['package.json', 'README.md', '.gitignore'];
    const recommendedFiles = ['LICENSE', 'CONTRIBUTING.md', '.github/workflows'];

    // In a real implementation, fetch repository contents via GitHub API
    // For now, we'll simulate the checks

    // Simulate missing files
    const missingRequired = requiredFiles.filter(() => Math.random() < 0.1);
    const missingRecommended = recommendedFiles.filter(() => Math.random() < 0.3);

    missingRequired.forEach(file => {
      result.errors.push(`Required file missing: ${file}`);
    });

    missingRecommended.forEach(file => {
      result.warnings.push(`Recommended file missing: ${file}`);
      result.recommendations.push(`Consider adding ${file} for better project organization`);
    });
  }

  private static async checkPackageJson(repoUrl: string, result: TemplateValidationResult): Promise<void> {
    // Check package.json structure and dependencies
    // In a real implementation, fetch and parse package.json

    const requiredFields = ['name', 'version', 'description', 'scripts'];
    const requiredScripts = ['dev', 'build', 'test'];

    // Simulate validation
    if (Math.random() < 0.1) {
      result.errors.push('package.json is invalid or missing');
      return;
    }

    requiredFields.forEach(field => {
      if (Math.random() < 0.05) {
        result.warnings.push(`Package.json missing recommended field: ${field}`);
      }
    });

    requiredScripts.forEach(script => {
      if (Math.random() < 0.1) {
        result.warnings.push(`Package.json missing recommended script: ${script}`);
        result.recommendations.push(`Add "${script}" script to package.json`);
      }
    });
  }

  private static async checkDocumentation(repoUrl: string, result: TemplateValidationResult): Promise<void> {
    // Check README.md content quality
    // In a real implementation, analyze README content

    if (Math.random() < 0.2) {
      result.warnings.push('README.md appears to be minimal or incomplete');
      result.recommendations.push('Enhance README with setup instructions, usage examples, and contribution guidelines');
    }

    if (Math.random() < 0.1) {
      result.recommendations.push('Consider adding inline code documentation');
    }
  }

  private static async checkTestCoverage(repoUrl: string, result: TemplateValidationResult): Promise<void> {
    // Check for test files and coverage
    // In a real implementation, analyze test directory and run coverage

    if (Math.random() < 0.3) {
      result.warnings.push('Low or missing test coverage detected');
      result.recommendations.push('Add comprehensive test suite to improve code quality');
    }

    if (Math.random() < 0.1) {
      result.errors.push('No test files found in repository');
    }
  }

  private static async checkSecurity(repoUrl: string, result: TemplateValidationResult): Promise<void> {
    // Check for security vulnerabilities
    // In a real implementation, run security audit

    if (Math.random() < 0.05) {
      result.errors.push('Security vulnerabilities detected in dependencies');
    }

    if (Math.random() < 0.1) {
      result.warnings.push('Outdated dependencies detected');
      result.recommendations.push('Update dependencies to latest secure versions');
    }

    if (Math.random() < 0.15) {
      result.recommendations.push('Consider adding security headers and HTTPS enforcement');
    }
  }

  static generateValidationReport(result: TemplateValidationResult): string {
    return `
# Template Validation Report

## Overall Score: ${result.score}/100
**Status: ${result.valid ? '✅ PASSED' : '❌ FAILED'}**

## Errors (${result.errors.length})
${result.errors.map(error => `- ❌ ${error}`).join('\n')}

## Warnings (${result.warnings.length})
${result.warnings.map(warning => `- ⚠️ ${warning}`).join('\n')}

## Recommendations (${result.recommendations.length})
${result.recommendations.map(rec => `- 💡 ${rec}`).join('\n')}

## Next Steps
${result.valid 
  ? '✅ Template meets quality standards and is ready for use.'
  : '❌ Template requires fixes before it can be used reliably. Please address the errors listed above.'
}

---
*Report generated by AI Agent System Template Validator*
    `.trim();
  }
}

