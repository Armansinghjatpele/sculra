// ==============================================================================
// Sculra Source Adapter Registry & Factory (worker/src/sources/source-registry.ts)
// ==============================================================================

import { ISourceAdapter } from './source-adapter';
import { SourceType } from './types';
import { WebsiteSourceAdapter } from './adapters/website-adapter';
import { GitHubSourceAdapter } from './adapters/github-adapter';
import { ApiSourceAdapter } from './adapters/api-adapter';
import { ZipSourceAdapter } from './adapters/zip-adapter';
import { DesktopSourceAdapter } from './adapters/desktop-adapter';
import { SourceUnsupportedError } from './source-errors';

export class SourceAdapterRegistry {
  private static adapters = new Map<SourceType, ISourceAdapter>([
    ['WEBSITE', new WebsiteSourceAdapter()],
    ['GITHUB', new GitHubSourceAdapter()],
    ['API', new ApiSourceAdapter()],
    ['ZIP', new ZipSourceAdapter()],
    ['DESKTOP', new DesktopSourceAdapter()],
  ]);

  /**
   * Retrieves the adapter corresponding to a specific source type.
   */
  static getAdapter(type: SourceType): ISourceAdapter {
    const normalizedType = String(type).toUpperCase() as SourceType;
    const adapter = this.adapters.get(normalizedType);
    if (!adapter) {
      throw new SourceUnsupportedError(
        type,
        `No adapter registered for source type "${type}". Supported types: WEBSITE, GITHUB, API, ZIP, DESKTOP.`
      );
    }
    return adapter;
  }

  /**
   * Registers or overrides an adapter (e.g. for testing with mock adapters).
   */
  static registerAdapter(type: SourceType, adapter: ISourceAdapter): void {
    this.adapters.set(type, adapter);
  }
}
