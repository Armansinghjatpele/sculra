// ==============================================================================
// Sculra Evidence Storage Abstraction (worker/src/storage.ts)
// ==============================================================================
// Uploads binary evidence (screenshots, traces) to Supabase Storage or local fallback.
// Avoids dumping binary blobs into PostgreSQL tables.

import * as fs from 'fs';
import * as path from 'path';

export interface StorageUploadResult {
  storagePath: string;
  publicUrl?: string;
}

export interface IEvidenceStorage {
  uploadScreenshot(
    testRunId: string,
    filename: string,
    buffer: Buffer,
    contentType?: string
  ): Promise<StorageUploadResult>;
}

export class SupabaseEvidenceStorage implements IEvidenceStorage {
  private supabaseClient: any;
  private bucketName: string;

  constructor(supabaseClient: any, bucketName = 'screenshots') {
    this.supabaseClient = supabaseClient;
    this.bucketName = bucketName;
  }

  async uploadScreenshot(
    testRunId: string,
    filename: string,
    buffer: Buffer,
    contentType = 'image/png'
  ): Promise<StorageUploadResult> {
    const storagePath = `${testRunId}/${Date.now()}_${filename}`;

    try {
      if (this.supabaseClient?.storage) {
        const { error } = await this.supabaseClient.storage
          .from(this.bucketName)
          .upload(storagePath, buffer, {
            contentType,
            upsert: true,
          });

        if (!error) {
          const { data } = this.supabaseClient.storage
            .from(this.bucketName)
            .getPublicUrl(storagePath);

          return {
            storagePath: `${this.bucketName}/${storagePath}`,
            publicUrl: data?.publicUrl,
          };
        }
      }
    } catch (err) {
      console.warn('[Storage Warning]: Failed uploading to Supabase Storage, using fallback.', err);
    }

    // Fallback: Generate inline data URL representation for UI rendering without breaking
    const base64 = buffer.toString('base64');
    const inlineDataUrl = `data:${contentType};base64,${base64}`;

    return {
      storagePath: `inline://${storagePath}`,
      publicUrl: inlineDataUrl,
    };
  }
}

export class LocalEvidenceStorage implements IEvidenceStorage {
  private baseDir: string;

  constructor(baseDir = path.join(process.cwd(), '.storage', 'screenshots')) {
    this.baseDir = baseDir;
    try {
      if (!fs.existsSync(this.baseDir)) {
        fs.mkdirSync(this.baseDir, { recursive: true });
      }
    } catch {
      // ignore
    }
  }

  async uploadScreenshot(
    testRunId: string,
    filename: string,
    buffer: Buffer,
    contentType = 'image/png'
  ): Promise<StorageUploadResult> {
    const safeFilename = `${testRunId}_${Date.now()}_${filename}`;
    const filePath = path.join(this.baseDir, safeFilename);

    try {
      fs.writeFileSync(filePath, buffer);
    } catch {
      // fallback
    }

    const base64 = buffer.toString('base64');
    const inlineDataUrl = `data:${contentType};base64,${base64}`;

    return {
      storagePath: filePath,
      publicUrl: inlineDataUrl,
    };
  }
}
