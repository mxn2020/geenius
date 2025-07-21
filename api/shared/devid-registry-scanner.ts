// DevId Registry Scanner - Auto-registration system for component usages
import { promises as fs } from 'fs';
import path from 'path';

export interface DevIdUsage {
  id: string;
  definitionId: string;
  name: string;
  description: string;
  filePath: string;
  repositoryPath?: string;
  category: ComponentCategory;
  semanticTags: string[];
  dependencies?: string[];
  props?: Record<string, any>;
}

export type ComponentCategory = 
  | 'ui' 
  | 'interactive' 
  | 'layout' 
  | 'navigation' 
  | 'content' 
  | 'form' 
  | 'data-display' 
  | 'feedback' 
  | 'overlay' 
  | 'media'
  | 'semantic'
  | 'utility';

export interface RegistryContext {
  templatePath: string;
  registryDataPath: string;
  repositoryUrl?: string;
}

export class DevIdRegistryScanner {
  private context: RegistryContext;

  constructor(context: RegistryContext) {
    this.context = context;
  }

  /**
   * Main method: Scan modified files and auto-register new devIds
   */
  async scanAndRegisterDevIds(modifiedFiles: { path: string; content: string }[]): Promise<{
    newDevIds: DevIdUsage[];
    registeredCount: number;
    errors: string[];
  }> {
    const results = {
      newDevIds: [] as DevIdUsage[],
      registeredCount: 0,
      errors: [] as string[]
    };

    try {
      console.log(`[REGISTRY-SCANNER] Starting scan of ${modifiedFiles.length} modified files`);

      // Step 1: Extract all devIds from modified files
      const extractedDevIds = await this.extractDevIdsFromFiles(modifiedFiles);
      console.log(`[REGISTRY-SCANNER] Extracted ${extractedDevIds.length} devIds from files`);

      // Step 2: Load existing registry data
      const existingDevIds = await this.loadExistingRegistry();
      console.log(`[REGISTRY-SCANNER] Found ${existingDevIds.size} existing devIds in registry`);

      // Step 3: Identify new devIds
      const newDevIds = extractedDevIds.filter(devId => !existingDevIds.has(devId.id));
      console.log(`[REGISTRY-SCANNER] Identified ${newDevIds.length} new devIds to register`);

      // Step 4: Generate metadata for new devIds
      const devIdUsages = await this.generateDevIdMetadata(newDevIds);
      console.log(`[REGISTRY-SCANNER] Generated metadata for ${devIdUsages.length} devIds`);

      // Step 5: Register new devIds
      if (devIdUsages.length > 0) {
        await this.registerNewDevIds(devIdUsages);
        results.registeredCount = devIdUsages.length;
        results.newDevIds = devIdUsages;
        console.log(`[REGISTRY-SCANNER] Successfully registered ${devIdUsages.length} new devIds`);
      }

      return results;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[REGISTRY-SCANNER] Error during scan and registration:`, errorMessage);
      results.errors.push(errorMessage);
      return results;
    }
  }

  /**
   * Extract devIds from file contents
   */
  private async extractDevIdsFromFiles(files: { path: string; content: string }[]): Promise<Array<{
    id: string;
    filePath: string;
    context: string;
    line: number;
  }>> {
    const devIds: Array<{ id: string; filePath: string; context: string; line: number }> = [];

    for (const file of files) {
      try {
        // Pattern to match devId props: devId="some-id" or devId={'some-id'}
        const devIdRegex = /devId\s*=\s*[{"]([^}"']+)[}"']/g;
        const lines = file.content.split('\n');
        
        let match;
        while ((match = devIdRegex.exec(file.content)) !== null) {
          const devId = match[1];
          
          // Skip invalid patterns
          if (devId === 'noID' || devId.includes('${') || devId.includes('`')) {
            continue;
          }

          // Find line number
          const lineIndex = file.content.substring(0, match.index).split('\n').length - 1;
          const contextLine = lines[lineIndex] || '';

          devIds.push({
            id: devId,
            filePath: file.path,
            context: contextLine.trim(),
            line: lineIndex + 1
          });
        }
      } catch (error) {
        console.error(`[REGISTRY-SCANNER] Error extracting devIds from ${file.path}:`, error);
      }
    }

    // Remove duplicates
    const uniqueDevIds = Array.from(
      new Map(devIds.map(item => [item.id, item])).values()
    );

    return uniqueDevIds;
  }

  /**
   * Load existing registry data from JSON files
   */
  private async loadExistingRegistry(): Promise<Set<string>> {
    const existingDevIds = new Set<string>();

    try {
      const registryDataPath = this.context.registryDataPath;
      const files = await fs.readdir(registryDataPath);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(registryDataPath, file);
            const content = await fs.readFile(filePath, 'utf-8');
            const data = JSON.parse(content);
            
            if (Array.isArray(data)) {
              data.forEach((usage: any) => {
                if (usage.id) {
                  existingDevIds.add(usage.id);
                }
              });
            }
          } catch (error) {
            console.error(`[REGISTRY-SCANNER] Error reading registry file ${file}:`, error);
          }
        }
      }
    } catch (error) {
      console.error(`[REGISTRY-SCANNER] Error loading existing registry:`, error);
    }

    return existingDevIds;
  }

  /**
   * Generate intelligent metadata for new devIds
   */
  private async generateDevIdMetadata(
    newDevIds: Array<{ id: string; filePath: string; context: string; line: number }>
  ): Promise<DevIdUsage[]> {
    const devIdUsages: DevIdUsage[] = [];

    for (const devIdInfo of newDevIds) {
      try {
        const metadata = this.inferDevIdMetadata(devIdInfo);
        devIdUsages.push(metadata);
      } catch (error) {
        console.error(`[REGISTRY-SCANNER] Error generating metadata for ${devIdInfo.id}:`, error);
      }
    }

    return devIdUsages;
  }

  /**
   * Intelligent metadata inference for devIds
   */
  private inferDevIdMetadata(devIdInfo: { 
    id: string; 
    filePath: string; 
    context: string; 
    line: number 
  }): DevIdUsage {
    const { id, filePath, context } = devIdInfo;

    // Parse devId pattern: {context}-{component}-{purpose} or {context}-{purpose}
    const parts = id.split('-');
    const lastPart = parts[parts.length - 1];

    // Infer component type from suffix or context
    const definitionId = this.inferDefinitionId(id, context, lastPart);
    
    // Infer category from file path and devId context
    const category = this.inferCategory(filePath, id, context);
    
    // Generate semantic name and description
    const name = this.generateComponentName(id);
    const description = this.generateComponentDescription(id, definitionId, filePath);
    
    // Generate semantic tags
    const semanticTags = this.generateSemanticTags(id, filePath, context);

    // Normalize file path (relative to template root)
    const normalizedFilePath = this.normalizeFilePath(filePath);

    return {
      id,
      definitionId,
      name,
      description,
      filePath: normalizedFilePath,
      repositoryPath: this.context.repositoryUrl ? 
        `${this.context.repositoryUrl}/blob/main/${normalizedFilePath}` : undefined,
      category,
      semanticTags,
      props: this.inferProps(context, definitionId)
    };
  }

  /**
   * Infer component definition ID (which dev- component this usage maps to)
   */
  private inferDefinitionId(devId: string, context: string, lastPart: string): string {
    // Common component suffixes to definition mapping
    const suffixMappings: Record<string, string> = {
      'button': 'dev-button',
      'btn': 'dev-button',
      'card': 'dev-card',
      'form': 'dev-form',
      'input': 'dev-input',
      'textarea': 'dev-textarea',
      'select': 'dev-select',
      'modal': 'dev-modal',
      'dialog': 'dev-dialog',
      'badge': 'dev-badge',
      'alert': 'dev-alert',
      'tabs': 'dev-tabs',
      'tab': 'dev-tab',
      'accordion': 'dev-accordion',
      'dropdown': 'dev-dropdown',
      'menu': 'dev-menu',
      'nav': 'dev-nav',
      'header': 'dev-header',
      'footer': 'dev-footer',
      'sidebar': 'dev-sidebar',
      'section': 'dev-section',
      'container': 'dev-container',
      'wrapper': 'dev-div',
      'text': 'dev-text',
      'heading': 'dev-heading',
      'title': 'dev-heading',
      'paragraph': 'dev-text',
      'link': 'dev-link',
      'image': 'dev-image',
      'icon': 'dev-icon',
      'spinner': 'dev-spinner',
      'loader': 'dev-spinner',
      'progress': 'dev-progress'
    };

    // Check suffix mapping first
    if (suffixMappings[lastPart]) {
      return suffixMappings[lastPart];
    }

    // Analyze context for HTML element hints
    const contextLower = context.toLowerCase();
    if (contextLower.includes('<button') || contextLower.includes('onclick')) {
      return 'dev-button';
    }
    if (contextLower.includes('<form') || contextLower.includes('onsubmit')) {
      return 'dev-form';
    }
    if (contextLower.includes('<input')) {
      return 'dev-input';
    }
    if (contextLower.includes('<div')) {
      return 'dev-div';
    }
    if (contextLower.includes('<section')) {
      return 'dev-section';
    }
    if (contextLower.includes('<a ') || contextLower.includes('<a>')) {
      return 'dev-link';
    }

    // Default fallback based on common patterns
    if (devId.includes('section') || devId.includes('area')) {
      return 'dev-section';
    }
    if (devId.includes('container') || devId.includes('wrapper')) {
      return 'dev-div';
    }

    // Ultimate fallback
    return 'dev-div';
  }

  /**
   * Infer component category
   */
  private inferCategory(filePath: string, devId: string, context: string): ComponentCategory {
    // File-based category inference
    if (filePath.includes('/auth/') || devId.includes('auth') || devId.includes('login')) {
      return 'interactive';
    }
    if (filePath.includes('/pages/Landing') || devId.includes('hero') || devId.includes('landing')) {
      return 'content';
    }
    if (filePath.includes('/nav') || devId.includes('nav') || devId.includes('menu')) {
      return 'navigation';
    }
    if (filePath.includes('/components/ui/')) {
      return 'ui';
    }

    // DevId pattern-based inference
    if (devId.includes('button') || devId.includes('btn') || devId.includes('submit')) {
      return 'interactive';
    }
    if (devId.includes('form') || devId.includes('input') || devId.includes('field')) {
      return 'form';
    }
    if (devId.includes('card') || devId.includes('badge') || devId.includes('alert')) {
      return 'ui';
    }
    if (devId.includes('modal') || devId.includes('dialog') || devId.includes('popup')) {
      return 'overlay';
    }
    if (devId.includes('nav') || devId.includes('menu') || devId.includes('breadcrumb')) {
      return 'navigation';
    }
    if (devId.includes('header') || devId.includes('footer') || devId.includes('sidebar')) {
      return 'layout';
    }
    if (devId.includes('section') || devId.includes('container') || devId.includes('wrapper')) {
      return 'layout';
    }
    if (devId.includes('text') || devId.includes('heading') || devId.includes('title')) {
      return 'content';
    }

    // Default fallback
    return 'ui';
  }

  /**
   * Generate human-readable component name
   */
  private generateComponentName(devId: string): string {
    return devId
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Generate component description
   */
  private generateComponentDescription(devId: string, definitionId: string, filePath: string): string {
    const componentType = definitionId.replace('dev-', '');
    const fileName = path.basename(filePath, path.extname(filePath));
    const contextParts = devId.split('-');
    const context = contextParts[0];

    return `${componentType.charAt(0).toUpperCase() + componentType.slice(1)} component used in ${fileName} for ${context} functionality`;
  }

  /**
   * Generate semantic tags
   */
  private generateSemanticTags(devId: string, filePath: string, context: string): string[] {
    const tags: string[] = [];

    // File-based tags
    if (filePath.includes('/pages/Landing')) tags.push('landing-page');
    if (filePath.includes('/auth/')) tags.push('authentication');
    if (filePath.includes('/components/ui/')) tags.push('ui-component');

    // DevId-based tags
    const parts = devId.split('-');
    parts.forEach(part => {
      if (part.length > 2) { // Avoid short meaningless parts
        tags.push(part);
      }
    });

    // Context-based tags
    if (context.includes('onClick') || context.includes('onSubmit')) tags.push('interactive');
    if (context.includes('className') || context.includes('style')) tags.push('styled');

    // Remove duplicates and limit to reasonable number
    return Array.from(new Set(tags)).slice(0, 8);
  }

  /**
   * Infer component props from context
   */
  private inferProps(context: string, definitionId: string): Record<string, any> | undefined {
    const props: Record<string, any> = {};

    // Extract common props from context
    if (context.includes('className=')) {
      const classMatch = context.match(/className\s*=\s*[{"]([^}"']+)[}"']/);
      if (classMatch) {
        props.className = classMatch[1];
      }
    }

    if (context.includes('onClick') || context.includes('onSubmit')) {
      props.interactive = true;
    }

    return Object.keys(props).length > 0 ? props : undefined;
  }

  /**
   * Normalize file path (make it relative to template root)
   */
  private normalizeFilePath(filePath: string): string {
    // Remove template path prefix if present
    if (filePath.startsWith(this.context.templatePath)) {
      return filePath.substring(this.context.templatePath.length).replace(/^\//, '');
    }
    
    // If it's already relative, return as-is
    if (!path.isAbsolute(filePath)) {
      return filePath;
    }

    // Extract relative path from common prefixes
    const srcMatch = filePath.match(/.*\/(src\/.*)$/);
    if (srcMatch) {
      return srcMatch[1];
    }

    // Fallback: just return the basename
    return path.basename(filePath);
  }

  /**
   * Register new devIds to newUsages.json
   */
  private async registerNewDevIds(devIdUsages: DevIdUsage[]): Promise<void> {
    try {
      const newUsagesPath = path.join(this.context.registryDataPath, 'newUsages.json');
      
      // Load existing new usages
      let existingUsages: DevIdUsage[] = [];
      try {
        const existingContent = await fs.readFile(newUsagesPath, 'utf-8');
        existingUsages = JSON.parse(existingContent);
      } catch (error) {
        // File doesn't exist or is invalid, start with empty array
        console.log(`[REGISTRY-SCANNER] Creating new newUsages.json file`);
      }

      // Merge new usages (avoiding duplicates)
      const existingIds = new Set(existingUsages.map(usage => usage.id));
      const uniqueNewUsages = devIdUsages.filter(usage => !existingIds.has(usage.id));
      
      const updatedUsages = [...existingUsages, ...uniqueNewUsages];

      // Sort by category then by id for better organization
      updatedUsages.sort((a, b) => {
        if (a.category !== b.category) {
          return a.category.localeCompare(b.category);
        }
        return a.id.localeCompare(b.id);
      });

      // Write back to file with proper formatting
      await fs.writeFile(newUsagesPath, JSON.stringify(updatedUsages, null, 2));
      
      console.log(`[REGISTRY-SCANNER] Updated ${newUsagesPath} with ${uniqueNewUsages.length} new usages`);
      
    } catch (error) {
      console.error(`[REGISTRY-SCANNER] Error registering new devIds:`, error);
      throw error;
    }
  }

  /**
   * Validate registry health and suggest cleanups
   */
  async validateRegistry(): Promise<{
    orphanedEntries: string[];
    suggestions: string[];
    health: 'good' | 'warning' | 'critical';
  }> {
    // This method can be used for registry maintenance
    // Implementation can be added later for registry health checks
    return {
      orphanedEntries: [],
      suggestions: [],
      health: 'good'
    };
  }
}