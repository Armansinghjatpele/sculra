// ==============================================================================
// Sculra Isolated Workspace Manager (worker/src/fix-agent/workspace.ts)
// ==============================================================================

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { WorkspaceError } from './errors';
import { RetrievedFileContext } from './code-context';

export class IsolatedWorkspaceManager {
  public readonly workspacePath: string;
  public readonly remediationId: string;
  private isCleanedUp = false;

  constructor(remediationId: string, customRootPath?: string) {
    this.remediationId = remediationId;
    const root = customRootPath || os.tmpdir();
    const safeName = `sculra-fix-${remediationId.replace(/[^a-zA-Z0-9_-]/g, '')}-${Date.now()}`;
    this.workspacePath = path.join(root, safeName);
  }

  /**
   * Initializes the isolated workspace directory.
   */
  async init(files: RetrievedFileContext[] = []): Promise<void> {
    try {
      if (!fs.existsSync(this.workspacePath)) {
        fs.mkdirSync(this.workspacePath, { recursive: true });
      }

      // Populate initial files
      for (const file of files) {
        await this.writeFile(file.path, file.content);
      }
    } catch (err: any) {
      throw new WorkspaceError(
        `Failed to initialize isolated workspace: ${err?.message || String(err)}`,
        this.remediationId
      );
    }
  }

  /**
   * Resolves a relative file path safely within the workspace boundaries.
   */
  resolvePath(relativePath: string): string {
    const cleanRel = relativePath.replace(/\\/g, '/').replace(/^\.?\//, '');
    const resolved = path.resolve(this.workspacePath, cleanRel);

    if (!resolved.startsWith(path.resolve(this.workspacePath))) {
      throw new WorkspaceError(
        `Directory traversal attempt blocked: "${relativePath}"`,
        this.remediationId
      );
    }

    return resolved;
  }

  /**
   * Reads a file from the isolated workspace.
   */
  async readFile(relativePath: string): Promise<string | null> {
    try {
      const fullPath = this.resolvePath(relativePath);
      if (!fs.existsSync(fullPath)) return null;
      return fs.readFileSync(fullPath, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * Writes a file to the isolated workspace.
   */
  async writeFile(relativePath: string, content: string): Promise<void> {
    const fullPath = this.resolvePath(relativePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content, 'utf-8');
  }

  /**
   * Safely removes the workspace and all contained files.
   */
  async cleanup(): Promise<void> {
    if (this.isCleanedUp) return;
    try {
      if (fs.existsSync(this.workspacePath)) {
        fs.rmSync(this.workspacePath, { recursive: true, force: true });
      }
      this.isCleanedUp = true;
    } catch {
      // Gracefully ignore cleanup errors
    }
  }
}
