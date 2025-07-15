import { FinitoDatabase, SyncMetadata } from './database';

export class SyncMetadataStorage {
  constructor(private db: FinitoDatabase) {}

  async getSyncMetadata(accountId: string): Promise<SyncMetadata | undefined> {
    return this.db.syncMetadata.where('accountId').equals(accountId).first();
  }

  async updateSyncMetadata(accountId: string, updates: Partial<SyncMetadata>): Promise<void> {
    const existing = await this.getSyncMetadata(accountId);
    
    if (existing) {
      await this.db.syncMetadata.update(existing.id, updates);
    } else {
      const metadata: SyncMetadata = {
        id: crypto.randomUUID(),
        accountId,
        lastSyncTime: new Date(),
        ...updates,
      };
      await this.db.syncMetadata.add(metadata);
    }
  }

  async getLastSyncTime(accountId: string): Promise<Date | null> {
    const metadata = await this.getSyncMetadata(accountId);
    return metadata?.lastSyncTime || null;
  }

  async updateSyncToken(accountId: string, syncToken?: string, historyId?: string, deltaLink?: string): Promise<void> {
    await this.updateSyncMetadata(accountId, {
      syncToken,
      historyId,
      deltaLink,
      lastSyncTime: new Date(),
    });
  }

  async clearSyncMetadata(accountId: string): Promise<void> {
    await this.db.syncMetadata.where('accountId').equals(accountId).delete();
  }
}