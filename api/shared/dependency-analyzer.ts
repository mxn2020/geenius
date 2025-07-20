// Component Dependency Analyzer for Agentic AI System
import { EnhancedGitHubService } from './enhanced-github-service';

export interface DependencyInfo {
  imports: string[];
  exports: string[];
  relatedFiles: string[];
  affectedComponents: string[];
  dependencyTree: DependencyNode[];
}

export interface DependencyNode {
  filePath: string;
  dependencies: string[];
  dependents: string[];
  level: number; // How deep in the dependency tree
}

export interface ComponentRelation {
  componentId: string;
  filePath: string;
  dependencies: string[];
  affectedBy: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

export class DependencyAnalyzer {
  private githubService: EnhancedGitHubService;
  private fileCache = new Map<string, string>();
  private dependencyCache = new Map<string, DependencyInfo>();

  constructor() {
    this.githubService = new EnhancedGitHubService();
  }

  /**
   * Analyze dependencies for multiple files and changes
   */
  async analyzeMultipleFiles(
    repoUrl: string,
    filePaths: string[],
    changes: any[]
  ): Promise<{
    dependencyMap: Map<string, DependencyInfo>;
    processingOrder: string[];
    riskAnalysis: ComponentRelation[];
  }> {
    const dependencyMap = new Map<string, DependencyInfo>();
    const allFiles = new Set(filePaths);

    // First, retrieve and cache all file contents
    await this.cacheFileContents(repoUrl, filePaths);

    // Analyze each file's dependencies
    for (const filePath of filePaths) {
      const content = this.fileCache.get(filePath);
      if (content) {
        const deps = await this.analyzeFileDependencies(content, filePath, repoUrl);
        dependencyMap.set(filePath, deps);
        
        // Add related files to the analysis set
        deps.relatedFiles.forEach(relatedPath => {
          if (!allFiles.has(relatedPath)) {
            allFiles.add(relatedPath);
          }
        });
      }
    }

    // Analyze additional related files
    const additionalFiles = Array.from(allFiles).filter(f => !filePaths.includes(f));
    if (additionalFiles.length > 0) {
      await this.cacheFileContents(repoUrl, additionalFiles);
      for (const filePath of additionalFiles) {
        const content = this.fileCache.get(filePath);
        if (content) {
          const deps = await this.analyzeFileDependencies(content, filePath, repoUrl);
          dependencyMap.set(filePath, deps);
        }
      }
    }

    // Determine optimal processing order
    const processingOrder = this.calculateProcessingOrder(dependencyMap);

    // Perform risk analysis
    const riskAnalysis = this.performRiskAnalysis(dependencyMap, changes);

    return {
      dependencyMap,
      processingOrder,
      riskAnalysis
    };
  }

  /**
   * Cache file contents for analysis
   */
  private async cacheFileContents(repoUrl: string, filePaths: string[]): Promise<void> {
    const uncachedFiles = filePaths.filter(path => !this.fileCache.has(path));
    
    if (uncachedFiles.length > 0) {
      const fileContents = await this.githubService.retrieveFiles(repoUrl, uncachedFiles);
      fileContents.forEach(file => {
        this.fileCache.set(file.path, file.content);
      });
    }
  }

  /**
   * Analyze dependencies for a single file
   */
  async analyzeFileDependencies(
    content: string,
    filePath: string,
    repoUrl: string
  ): Promise<DependencyInfo> {
    // Check cache first
    if (this.dependencyCache.has(filePath)) {
      return this.dependencyCache.get(filePath)!;
    }

    const imports: string[] = [];
    const exports: string[] = [];
    const relatedFiles: string[] = [];
    const affectedComponents: string[] = [];

    // Parse import statements
    const importRegex = /import\s+(?:{[^}]*}|\*\s+as\s+\w+|\w+)?\s*(?:,\s*{[^}]*})?\s*from\s+['"](.*?)['"];?/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      imports.push(importPath);

      // Resolve relative imports to actual file paths
      if (importPath.startsWith('./') || importPath.startsWith('../')) {
        const resolvedPath = this.resolveRelativePath(filePath, importPath);
        relatedFiles.push(resolvedPath);
      }
    }

    // Parse export statements
    const exportRegex = /export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type)\s+(\w+)/g;
    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }

    // Parse React component usage (for component dependencies)
    const componentRegex = /<(\w+)(?:\s|>)/g;
    while ((match = componentRegex.exec(content)) !== null) {
      const componentName = match[1];
      if (componentName[0] === componentName[0].toUpperCase()) { // React component convention
        affectedComponents.push(componentName);
      }
    }

    // Analyze CSS/styling dependencies
    const styleImports = this.analyzeStyleDependencies(content);
    relatedFiles.push(...styleImports);

    // Build dependency tree
    const dependencyTree = await this.buildDependencyTree(filePath, relatedFiles, 0);

    const dependencyInfo: DependencyInfo = {
      imports,
      exports,
      relatedFiles,
      affectedComponents,
      dependencyTree
    };

    // Cache the result
    this.dependencyCache.set(filePath, dependencyInfo);
    return dependencyInfo;
  }

  /**
   * Resolve relative import paths to absolute file paths
   */
  private resolveRelativePath(currentFile: string, relativePath: string): string {
    const currentDir = currentFile.split('/').slice(0, -1).join('/');
    const pathParts = relativePath.split('/');
    const currentParts = currentDir.split('/');

    for (const part of pathParts) {
      if (part === '.') {
        continue;
      } else if (part === '..') {
        currentParts.pop();
      } else {
        currentParts.push(part);
      }
    }

    let resolvedPath = currentParts.join('/');
    
    // Add file extensions if missing
    if (!resolvedPath.endsWith('.ts') && !resolvedPath.endsWith('.tsx') && 
        !resolvedPath.endsWith('.js') && !resolvedPath.endsWith('.jsx')) {
      // Try different extensions
      const possibleExtensions = ['.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts'];
      for (const ext of possibleExtensions) {
        const withExt = resolvedPath + ext;
        if (this.fileCache.has(withExt)) {
          resolvedPath = withExt;
          break;
        }
      }
    }

    return resolvedPath;
  }

  /**
   * Analyze styling dependencies (CSS imports, styled-components, etc.)
   */
  private analyzeStyleDependencies(content: string): string[] {
    const styleDeps: string[] = [];

    // CSS/SCSS imports
    const cssImportRegex = /import\s+['"](.*?\.(?:css|scss|sass|less))['"];?/g;
    let match;
    while ((match = cssImportRegex.exec(content)) !== null) {
      styleDeps.push(match[1]);
    }

    // Styled-components or emotion imports
    const styledRegex = /import\s+styled.*?from\s+['"](.*?)['"];?/g;
    while ((match = styledRegex.exec(content)) !== null) {
      styleDeps.push(match[1]);
    }

    return styleDeps;
  }

  /**
   * Build dependency tree for a file
   */
  private async buildDependencyTree(
    filePath: string,
    dependencies: string[],
    level: number,
    visited = new Set<string>()
  ): Promise<DependencyNode[]> {
    if (visited.has(filePath) || level > 3) { // Prevent infinite recursion and limit depth
      return [];
    }

    visited.add(filePath);
    const tree: DependencyNode[] = [];

    for (const depPath of dependencies) {
      const content = this.fileCache.get(depPath);
      if (content) {
        const depInfo = await this.analyzeFileDependencies(content, depPath, '');
        tree.push({
          filePath: depPath,
          dependencies: depInfo.relatedFiles,
          dependents: [], // Will be filled in later pass
          level
        });

        // Recurse for deeper dependencies
        const subTree = await this.buildDependencyTree(
          depPath,
          depInfo.relatedFiles,
          level + 1,
          visited
        );
        tree.push(...subTree);
      }
    }

    return tree;
  }

  /**
   * Calculate optimal processing order based on dependencies
   */
  private calculateProcessingOrder(dependencyMap: Map<string, DependencyInfo>): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: string[] = [];

    const visit = (filePath: string) => {
      if (visited.has(filePath)) return;
      if (visiting.has(filePath)) {
        // Circular dependency detected - handle gracefully
        console.warn(`Circular dependency detected involving ${filePath}`);
        return;
      }

      visiting.add(filePath);
      const deps = dependencyMap.get(filePath);
      
      if (deps) {
        // Visit dependencies first
        for (const depPath of deps.relatedFiles) {
          if (dependencyMap.has(depPath)) {
            visit(depPath);
          }
        }
      }

      visiting.delete(filePath);
      visited.add(filePath);
      result.push(filePath);
    };

    // Process all files
    for (const filePath of dependencyMap.keys()) {
      visit(filePath);
    }

    return result;
  }

  /**
   * Perform risk analysis on component changes
   */
  private performRiskAnalysis(
    dependencyMap: Map<string, DependencyInfo>,
    changes: any[]
  ): ComponentRelation[] {
    const riskAnalysis: ComponentRelation[] = [];

    for (const change of changes) {
      const filePath = change.componentContext?.filePath || change.metadata?.filePath;
      if (!filePath || !dependencyMap.has(filePath)) continue;

      const deps = dependencyMap.get(filePath)!;
      const affectedFiles = new Set<string>();

      // Find all files that depend on this file
      for (const [otherPath, otherDeps] of dependencyMap.entries()) {
        if (otherDeps.relatedFiles.includes(filePath)) {
          affectedFiles.add(otherPath);
        }
      }

      // Determine risk level
      let riskLevel: 'low' | 'medium' | 'high' = 'low';
      if (affectedFiles.size > 5) {
        riskLevel = 'high';
      } else if (affectedFiles.size > 2) {
        riskLevel = 'medium';
      }

      // Increase risk for core components
      if (filePath.includes('/lib/') || filePath.includes('/shared/') || 
          filePath.includes('/common/') || deps.exports.length > 3) {
        riskLevel = riskLevel === 'low' ? 'medium' : 'high';
      }

      riskAnalysis.push({
        componentId: change.componentId,
        filePath,
        dependencies: deps.relatedFiles,
        affectedBy: Array.from(affectedFiles),
        riskLevel
      });
    }

    return riskAnalysis;
  }

  /**
   * Suggest additional files that might need updates
   */
  async suggestAdditionalUpdates(
    dependencyMap: Map<string, DependencyInfo>,
    changedFiles: string[]
  ): Promise<{
    filePath: string;
    reason: string;
    priority: 'low' | 'medium' | 'high';
  }[]> {
    const suggestions: {
      filePath: string;
      reason: string;
      priority: 'low' | 'medium' | 'high';
    }[] = [];

    for (const changedFile of changedFiles) {
      const deps = dependencyMap.get(changedFile);
      if (!deps) continue;

      // Check for files that import from this changed file
      for (const [filePath, fileDeps] of dependencyMap.entries()) {
        if (fileDeps.relatedFiles.includes(changedFile) && !changedFiles.includes(filePath)) {
          let priority: 'low' | 'medium' | 'high' = 'low';
          let reason = `Imports from changed file ${changedFile}`;

          // Higher priority for TypeScript interfaces/types
          if (deps.exports.some(exp => exp.includes('Interface') || exp.includes('Type'))) {
            priority = 'medium';
            reason = `Uses types/interfaces from ${changedFile}`;
          }

          // Highest priority for component props
          if (filePath.includes('component') && changedFile.includes('types')) {
            priority = 'high';
            reason = `Component may need prop updates from ${changedFile}`;
          }

          suggestions.push({ filePath, reason, priority });
        }
      }
    }

    // Remove duplicates and sort by priority
    const uniqueSuggestions = suggestions.filter((suggestion, index, self) =>
      index === self.findIndex(s => s.filePath === suggestion.filePath)
    );

    return uniqueSuggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Clear caches (useful for testing or memory management)
   */
  clearCaches(): void {
    this.fileCache.clear();
    this.dependencyCache.clear();
  }
}