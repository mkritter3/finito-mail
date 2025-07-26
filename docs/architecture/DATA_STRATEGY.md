# Data Strategy & Durability

## Overview

This document defines how Finito Mail handles data storage, backup, synchronization, and recovery in a client-first architecture. With all data stored in the browser, we must address durability concerns while maintaining our zero-server-storage principle.

## Data Lifecycle

### 1. Initial Sync
```typescript
// Progressive sync strategy
class InitialSync {
  async syncAccount(account: EmailAccount) {
    // Phase 1: Last 30 days (immediate)
    await this.syncRecent(account, 30);
    
    // Phase 2: Last 6 months (background)
    await this.syncInBackground(account, 180);
    
    // Phase 3: Full history (low priority)
    await this.syncFullHistory(account);
  }
  
  private async syncRecent(account: EmailAccount, days: number) {
    const messages = await account.provider.listMessages({
      after: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    });
    
    // Store in IndexedDB with progress tracking
    await this.batchStore(messages, {
      onProgress: (percent) => this.updateUI(percent)
    });
  }
}
```

### 2. Storage Management

#### IndexedDB Capacity
- **Available**: 50GB+ on modern browsers
- **Usage**: ~1KB per email (metadata), ~100KB with attachments
- **Capacity**: 500,000+ emails with attachments

#### Storage Monitoring
```typescript
interface StorageMonitor {
  async checkUsage() {
    const estimate = await navigator.storage.estimate();
    return {
      used: estimate.usage || 0,
      total: estimate.quota || 0,
      percentage: (estimate.usage! / estimate.quota!) * 100
    };
  }
  
  async requestPersistence() {
    // Request persistent storage to prevent eviction
    if (navigator.storage.persist) {
      const isPersisted = await navigator.storage.persist();
      return isPersisted;
    }
  }
}
```

### 3. Eviction Prevention

#### Browser Eviction Policies
- **Default**: LRU eviction when low on space
- **Persistent Storage**: Prevents automatic eviction
- **User Warning**: Alert when >80% capacity

```typescript
class EvictionProtection {
  async protectData() {
    // 1. Request persistent storage
    const persisted = await navigator.storage.persist();
    
    // 2. Monitor usage
    const usage = await this.checkUsage();
    if (usage.percentage > 80) {
      this.showStorageWarning();
    }
    
    // 3. Implement smart cleanup
    if (usage.percentage > 90) {
      await this.cleanupOldAttachments();
    }
  }
  
  private async cleanupOldAttachments() {
    // Remove attachments >1 year old
    // Keep email metadata always
    const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;
    await db.attachments
      .where('timestamp').below(cutoff)
      .delete();
  }
}
```

## Backup Strategy

### 1. Automatic Local Backup
```typescript
class LocalBackup {
  async scheduleBackups() {
    // Daily incremental
    this.scheduleDaily(() => this.incrementalBackup());
    
    // Weekly full backup
    this.scheduleWeekly(() => this.fullBackup());
  }
  
  private async incrementalBackup() {
    const lastBackup = await this.getLastBackupTime();
    const changes = await db.emails
      .where('modifiedAt').above(lastBackup)
      .toArray();
    
    await this.saveToFile(changes, 'incremental');
  }
  
  private async fullBackup() {
    const allData = {
      emails: await db.emails.toArray(),
      todos: await db.todos.toArray(),
      settings: await db.settings.toArray()
    };
    
    await this.saveToFile(allData, 'full');
  }
}
```

### 2. User-Initiated Export
```typescript
class UserExport {
  async exportToFile(format: 'json' | 'mbox' | 'pst') {
    const data = await this.prepareExport();
    
    switch(format) {
      case 'json':
        return this.exportJSON(data);
      case 'mbox':
        return this.exportMBOX(data);
      case 'pst':
        return this.exportPST(data);
    }
  }
  
  private async exportJSON(data: any) {
    const blob = new Blob(
      [JSON.stringify(data, null, 2)], 
      { type: 'application/json' }
    );
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finito-backup-${Date.now()}.json`;
    a.click();
  }
}
```

### 3. Cloud Backup (User's Cloud)
```typescript
class CloudBackup {
  // Backup to user's own cloud storage
  async backupToUserCloud(provider: 'google' | 'dropbox' | 'onedrive') {
    const data = await this.prepareBackup();
    const encrypted = await this.encrypt(data);
    
    switch(provider) {
      case 'google':
        await this.uploadToGoogleDrive(encrypted);
        break;
      case 'dropbox':
        await this.uploadToDropbox(encrypted);
        break;
      case 'onedrive':
        await this.uploadToOneDrive(encrypted);
        break;
    }
  }
  
  private async encrypt(data: any): Promise<ArrayBuffer> {
    const passphrase = await this.getUserPassphrase();
    const key = await this.deriveKey(passphrase);
    
    return crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: crypto.getRandomValues(new Uint8Array(12)) },
      key,
      new TextEncoder().encode(JSON.stringify(data))
    );
  }
}
```

## Multi-Device Sync

### 1. Sync Architecture (Phase 2)
```
Device A                    Device B
   ↓                           ↓
IndexedDB                  IndexedDB
   ↓                           ↓
Sync Engine ←─────────────→ Sync Engine
         ↓                 ↓
      WebRTC Data Channel
         (P2P Connection)
```

### 2. Metadata-Only Sync
```typescript
interface SyncStrategy {
  // Only sync metadata, not full emails
  syncMetadata: {
    lastSync: Date;
    readStatus: Map<string, boolean>;
    labels: Map<string, string[]>;
    deletedIds: Set<string>;
  };
  
  // Emails fetched from provider on demand
  fetchOnDemand: boolean;
}
```

### 3. Implementation Approach
```typescript
class P2PSync {
  async establishConnection(peerCode: string) {
    // Use WebRTC for direct connection
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    
    // Create data channel
    const channel = pc.createDataChannel('sync');
    
    // Exchange offer/answer via QR code
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    // Simplified - actual implementation needs signaling
    return channel;
  }
  
  async syncMetadata(channel: RTCDataChannel) {
    const localMeta = await this.getLocalMetadata();
    const remoteMeta = await this.getRemoteMetadata(channel);
    
    const merged = this.mergeMetadata(localMeta, remoteMeta);
    await this.applyMetadata(merged);
  }
}
```

## Recovery Procedures

### 1. Data Recovery Options
```typescript
class DataRecovery {
  async recoverData(source: RecoverySource) {
    switch(source) {
      case 'local_backup':
        return this.restoreFromLocalBackup();
      case 'cloud_backup':
        return this.restoreFromCloud();
      case 'provider':
        return this.resyncFromProvider();
      case 'peer_device':
        return this.syncFromPeer();
    }
  }
  
  private async restoreFromLocalBackup() {
    const file = await this.selectBackupFile();
    const data = await this.readBackupFile(file);
    
    // Validate backup integrity
    if (!this.validateBackup(data)) {
      throw new Error('Corrupt backup file');
    }
    
    // Clear existing data
    await this.clearLocalData();
    
    // Restore
    await this.importData(data);
  }
}
```

### 2. Failure Scenarios

#### Browser Data Cleared
- **Impact**: All local data lost
- **Recovery**: 
  1. Check for local backup files
  2. Restore from cloud backup
  3. Re-sync from email provider

#### Device Lost/Damaged
- **Impact**: No access to local data
- **Recovery**:
  1. Install on new device
  2. Authenticate with provider
  3. Restore from cloud backup or re-sync

#### Corruption
- **Impact**: IndexedDB corrupted
- **Recovery**:
  1. Export readable data
  2. Clear corrupted database
  3. Restore from backup or provider

## Best Practices

### For Users
1. **Enable Persistent Storage**: Prevents browser eviction
2. **Regular Backups**: Weekly cloud backup recommended
3. **Multiple Devices**: Sync across 2+ devices for redundancy
4. **Export Important Emails**: PST/MBOX for critical data

### For Developers
1. **Progressive Sync**: Don't download everything at once
2. **Efficient Storage**: Compress attachments, dedupe
3. **Clear Warnings**: Alert users about storage limits
4. **Backup Reminders**: Prompt for regular backups

## Implementation Priority

### Phase 1 (MVP)
- [x] Basic IndexedDB storage
- [x] Manual export (JSON, MBOX)
- [x] Storage monitoring
- [ ] Persistent storage request

### Phase 2
- [ ] Automatic local backups
- [ ] Cloud backup integration
- [ ] PST export support
- [ ] Backup encryption

### Phase 3
- [ ] P2P device sync
- [ ] Incremental sync
- [ ] Conflict resolution
- [ ] Sync history

### Phase 4
- [ ] Advanced compression
- [ ] Intelligent cleanup
- [ ] Predictive caching
- [ ] Offline-first sync

## Risk Mitigation

### Critical Risks
1. **Data Loss**: Mitigated by multiple backup options
2. **Storage Limits**: Smart cleanup and compression
3. **Sync Conflicts**: Last-write-wins with history
4. **Performance**: Progressive loading and indexing

### User Education
- Onboarding explains backup importance
- Regular backup reminders
- Clear storage indicators
- Easy recovery procedures

---

**Remember**: In a client-first architecture, user data durability is our shared responsibility. We provide the tools; users must use them.