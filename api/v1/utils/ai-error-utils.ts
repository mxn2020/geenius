// AI error fixing utilities

import { ParsedError, DeploymentErrorInfo, FileFix } from '../types/project-types';
import { NetlifyService } from '../../../src/services/netlify';
import { EnhancedGitHubService } from '../../../src/services/enhanced-github-service';
import { CustomAIAgent } from '../../shared/custom-ai-agent';

/**
 * Clean markdown code blocks and language identifiers from AI-generated code
 */
export function cleanMarkdownFromCode(content: string): string {
  // Remove markdown code blocks with language identifiers
  let cleaned = content
    // Remove opening code blocks: ```typescript, ```javascript, ```tsx, etc.
    .replace(/^```\w*\s*\n?/gm, '')
    // Remove closing code blocks: ```
    .replace(/^```\s*$/gm, '')
    // Remove any remaining backticks at start/end of lines
    .replace(/^`{1,3}/gm, '')
    .replace(/`{1,3}$/gm, '');
  
  // Clean up extra whitespace but preserve intentional spacing
  cleaned = cleaned.trim();
  
  // If the content looks like it has markdown artifacts, try additional cleaning
  if (cleaned.includes('```') || cleaned.match(/^(typescript|javascript|tsx|jsx|ts|js)\s*$/m)) {
    cleaned = cleaned
      .replace(/^(typescript|javascript|tsx|jsx|ts|js)\s*$/gm, '')
      .replace(/```/g, '')
      .trim();
  }
  
  return cleaned;
}

/**
 * Parse deployment errors from build logs
 */
export async function parseDeploymentError(deployment: any): Promise<DeploymentErrorInfo> {
  const errors: ParsedError[] = [];
  let errorType: 'typescript' | 'build' | 'dependency' | 'config' | 'unknown' = 'unknown';
  let buildLog = '';
  
  try {
    const netlifyService = new NetlifyService();
    buildLog = await netlifyService.getBuildLogs(deployment.site_id, deployment.id);
    
    // Parse TypeScript errors
    const tsErrorRegex = /([^:\s]+\.tsx?)\((\d+),(\d+)\):\s*(error\s+TS\d+):\s*(.+)/g;
    const simpleErrorRegex = /([^:\s]+\.tsx?):(\d+):(\d+):\s*(error\s+TS\d+):\s*(.+)/g;
    
    let match;
    while ((match = tsErrorRegex.exec(buildLog)) !== null) {
      const [, file, line, column, code, message] = match;
      errors.push({
        file: file.replace(/^\.\//, '').replace(/^src\//, 'src/'),
        line: parseInt(line),
        column: parseInt(column),
        message: message.trim(),
        code: code.replace('error ', ''),
        type: 'typescript'
      });
      errorType = 'typescript';
    }
    
    while ((match = simpleErrorRegex.exec(buildLog)) !== null) {
      const [, file, line, column, code, message] = match;
      errors.push({
        file: file.replace(/^\.\//, '').replace(/^src\//, 'src/'),
        line: parseInt(line),
        column: parseInt(column),
        message: message.trim(),
        code: code.replace('error ', ''),
        type: 'typescript'
      });
      errorType = 'typescript';
    }
    
    // Parse build errors if no TypeScript errors found
    if (errors.length === 0) {
      if (buildLog.includes('npm ERR!') || buildLog.includes('yarn install')) {
        errorType = 'dependency';
      } else if (buildLog.includes('webpack') || buildLog.includes('rollup')) {
        errorType = 'build';
      } else if (buildLog.includes('config')) {
        errorType = 'config';
      }
      
      // Add generic error
      errors.push({
        file: 'unknown',
        message: deployment.error_message || 'Build failed',
        type: errorType
      });
    }
    
  } catch (error) {
    console.error('[ERROR-PARSER] Failed to get build logs:', error);
    errors.push({
      file: 'unknown',
      message: deployment.error_message || 'Build failed',
      type: 'unknown'
    });
  }
  
  const canFix = errorType === 'typescript' && errors.length > 0;
  
  return {
    errorType,
    errors,
    buildLog,
    canFix
  };
}

/**
 * Fix code using AI
 */
export async function fixCodeWithAI(
  sessionId: string,
  errorInfo: DeploymentErrorInfo, 
  repoUrl: string,
  aiProvider: string = 'anthropic'
): Promise<{ success: boolean; fixes: FileFix[]; explanation: string }> {
  
  console.log(`[AI-FIXER] Starting AI fix for ${errorInfo.errors.length} errors`);

  try {
    const customAgent = new CustomAIAgent({
      sessionId,
      sandbox: null,
      repositoryUrl: repoUrl,
      provider: aiProvider as 'anthropic' | 'openai' | 'google' | 'grok',
      model: 'claude-sonnet-4-20250514',
      projectContext: {
        componentRegistry: {},
        dependencies: {},
        framework: 'react',
        structure: 'standard'
      }
    });
    
    const fixes: FileFix[] = [];
    const githubService = new EnhancedGitHubService();
    
    // Group errors by file for efficient processing
    const fileErrors = new Map<string, ParsedError[]>();
    for (const error of errorInfo.errors) {
      if (!fileErrors.has(error.file)) {
        fileErrors.set(error.file, []);
      }
      fileErrors.get(error.file)!.push(error);
    }

    // Process each file with errors
    for (const [filePath, fileErrorList] of fileErrors) {
      
      // Get current file content
      const currentContent = await githubService.getFileContent(repoUrl, filePath, 'main');
      
      // Create fix prompt for this file
      const fixPrompt = `
You are a TypeScript/React code fixer. Fix the following errors in this file:

FILE: ${filePath}
CURRENT CONTENT:
\`\`\`typescript
${currentContent}
\`\`\`

ERRORS TO FIX:
${fileErrorList.map(error => 
  `- Line ${error.line}: ${error.message} (${error.code})`
).join('\n')}

CRITICAL INSTRUCTIONS:
1. For TS6133 errors (unused variables/imports): Remove the unused imports or variables
2. For syntax errors (TS1443, TS1005, TS1434, etc.): Fix the syntax issues carefully
3. For other TypeScript errors: Fix the type issues while preserving functionality
4. DO NOT change the overall structure or functionality of the code
5. IMPORTANT: Return ONLY the raw TypeScript/React code - NO markdown code blocks, NO language identifiers, NO explanations
6. Do NOT wrap your response in \`\`\`typescript or \`\`\` blocks
7. Preserve all existing imports that are actually used
8. Maintain the same code style and formatting
9. Remove any markdown formatting artifacts like \`\`\`typescript or \`\`\`

Return the complete fixed file content as raw code:`;

      const fixResult = await customAgent.processRequest(fixPrompt);
      
      if (fixResult && fixResult.trim()) {
        // Clean any markdown formatting from the AI response
        const cleanedContent = cleanMarkdownFromCode(fixResult);
        
        fixes.push({
          file: filePath,
          oldContent: currentContent,
          newContent: cleanedContent,
          description: `Fixed ${fileErrorList.length} errors: ${fileErrorList.map(e => e.code).join(', ')}`
        });
        
        console.log(`[AI-FIXER] Fixed ${fileErrorList.length} errors in ${filePath}`);
      } else {
        console.warn(`[AI-FIXER] Failed to fix errors in ${filePath}: No content returned`);
      }
    }

    const explanation = `AI successfully fixed ${fixes.length} files with TypeScript errors. Removed unused imports and variables.`;
    
    return {
      success: fixes.length > 0,
      fixes,
      explanation
    };

  } catch (error: any) {
    console.error(`[AI-FIXER] Error during AI code fixing:`, error);
    return {
      success: false,
      fixes: [],
      explanation: `AI code fixing failed: ${error.message}`
    };
  }
}

/**
 * Apply fixes to repository
 */
export async function applyFixesToRepository(
  sessionId: string,
  repoUrl: string,
  fixes: FileFix[]
): Promise<boolean> {
  try {
    console.log(`[REPO-FIXER] Applying ${fixes.length} fixes to repository`);
    
    const githubService = new EnhancedGitHubService();
    
    // Apply each fix as a separate commit for better tracking
    for (const fix of fixes) {
      const fileChanges = [{
        path: fix.file,
        content: fix.newContent,
        encoding: 'utf-8' as const
      }];
      
      await githubService.commitChanges(
        repoUrl,
        'main',
        fileChanges,
        `AI fix: ${fix.description}`
      );
      
      console.log(`[REPO-FIXER] Applied fix to ${fix.file}: ${fix.description}`);
    }
    
    console.log(`[REPO-FIXER] Applied ${fixes.length} fixes in ${fixes.length} commits`);
    return true;
    
  } catch (error: any) {
    console.error(`[REPO-FIXER] Error applying fixes to repository:`, error);
    return false;
  }
}