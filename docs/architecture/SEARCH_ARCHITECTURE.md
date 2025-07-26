# Search Architecture

This document details Finito Mail's hybrid search implementation, combining instant client-side results with comprehensive server-proxy fallback.

## Overview

Our search architecture provides the best of both worlds:
- **Instant results** from local IndexedDB cache
- **Complete results** via server proxy to Gmail API
- **No server-side index** needed (unlike traditional email clients)
- **Consistent experience** across all devices

## Architecture Diagram

```
User Types Query
       ↓
┌──────────────────────────────────────┐
│     Search Orchestrator              │
├──────────────┬───────────────────────┤
│ Local Search │  Server Proxy Search  │
│  (Instant)   │    (Complete)         │
└──────┬───────┴────────┬──────────────┘
       ↓                ↓
  IndexedDB         Minimal API
  (MiniSearch)      (Vercel Edge)
       ↓                ↓
  Cached Emails    Gmail Search API
       ↓                ↓
  Instant Results  Complete Results
       └────────┬───────┘
                ↓
          Merged Results
```

## Implementation

### 1. Search Orchestrator

The main search controller that coordinates local and server searches:

```typescript
// packages/core/src/search/search-orchestrator.ts
export class SearchOrchestrator {
  private localSearch: LocalSearch;
  private serverSearch: ServerProxySearch;
  private activeSearchId: string | null = null;
  
  constructor() {
    this.localSearch = new LocalSearch();
    this.serverSearch = new ServerProxySearch();
  }
  
  async search(query: string): Promise<SearchResults> {
    // Generate unique ID for this search
    const searchId = crypto.randomUUID();
    this.activeSearchId = searchId;
    
    // Start both searches in parallel
    const [localResults, serverResults] = await Promise.allSettled([
      this.searchLocal(query, searchId),
      this.searchServer(query, searchId)
    ]);
    
    // Return combined results
    return this.mergeResults(localResults, serverResults);
  }
  
  private async searchLocal(query: string, searchId: string): Promise<Email[]> {
    // Search IndexedDB with MiniSearch
    const results = await this.localSearch.search(query);
    
    // If this search was cancelled, return empty
    if (this.activeSearchId !== searchId) {
      return [];
    }
    
    // Emit provisional results immediately
    this.onProvisionalResults?.(results);
    
    return results;
  }
  
  private async searchServer(query: string, searchId: string): Promise<Email[]> {
    try {
      // Server proxies to Gmail API
      const results = await this.serverSearch.search(query);
      
      // If search was cancelled, don't update
      if (this.activeSearchId !== searchId) {
        return [];
      }
      
      // Cache results locally for next time
      await this.cacheServerResults(results);
      
      return results;
    } catch (error) {
      console.error('Server search failed:', error);
      // Fall back to local results only
      return [];
    }
  }
  
  private mergeResults(
    local: PromiseSettledResult<Email[]>,
    server: PromiseSettledResult<Email[]>
  ): SearchResults {
    const localEmails = local.status === 'fulfilled' ? local.value : [];
    const serverEmails = server.status === 'fulfilled' ? server.value : [];
    
    // Deduplicate by email ID
    const emailMap = new Map<string, Email>();
    
    // Local results first (instant display)
    localEmails.forEach(email => emailMap.set(email.id, email));
    
    // Server results override/add (more complete)
    serverEmails.forEach(email => emailMap.set(email.id, email));
    
    return {
      emails: Array.from(emailMap.values()),
      isComplete: server.status === 'fulfilled',
      totalResults: emailMap.size,
      source: server.status === 'fulfilled' ? 'server' : 'local'
    };
  }
}
```

### 2. Local Search Implementation

Fast client-side search using MiniSearch in a Web Worker:

```typescript
// packages/core/src/search/local-search.ts
import MiniSearch from 'minisearch';

export class LocalSearch {
  private worker: Worker;
  private searchIndex?: MiniSearch;
  
  constructor() {
    // Initialize search in Web Worker for non-blocking
    this.worker = new Worker(
      new URL('./search.worker.ts', import.meta.url)
    );
  }
  
  async initialize() {
    // Build index from IndexedDB
    const emails = await db.email_headers.toArray();
    
    this.worker.postMessage({
      type: 'INIT_INDEX',
      emails: emails.map(email => ({
        id: email.id,
        subject: email.subject,
        from: email.from.email,
        fromName: email.from.name,
        snippet: email.snippet,
        labels: email.labels.join(' ')
      }))
    });
  }
  
  async search(query: string): Promise<Email[]> {
    return new Promise((resolve) => {
      const messageHandler = (event: MessageEvent) => {
        if (event.data.type === 'SEARCH_RESULTS') {
          this.worker.removeEventListener('message', messageHandler);
          resolve(event.data.results);
        }
      };
      
      this.worker.addEventListener('message', messageHandler);
      
      this.worker.postMessage({
        type: 'SEARCH',
        query
      });
    });
  }
  
  async updateIndex(emails: Email[]) {
    // Incrementally update search index
    this.worker.postMessage({
      type: 'UPDATE_INDEX',
      emails
    });
  }
}

// search.worker.ts
import MiniSearch from 'minisearch';

let miniSearch: MiniSearch;

self.addEventListener('message', (event) => {
  const { type, ...data } = event.data;
  
  switch (type) {
    case 'INIT_INDEX':
      miniSearch = new MiniSearch({
        fields: ['subject', 'from', 'fromName', 'snippet', 'labels'],
        searchOptions: {
          boost: { subject: 2, from: 1.5 },
          fuzzy: 0.2,
          prefix: true
        }
      });
      
      miniSearch.addAll(data.emails);
      break;
      
    case 'SEARCH':
      const results = miniSearch.search(data.query);
      self.postMessage({
        type: 'SEARCH_RESULTS',
        results: results.slice(0, 100) // Limit results
      });
      break;
      
    case 'UPDATE_INDEX':
      // Remove old versions
      data.emails.forEach((email: any) => {
        try {
          miniSearch.remove(email);
        } catch (e) {
          // Email wasn't in index
        }
      });
      
      // Add updated versions
      miniSearch.addAll(data.emails);
      break;
  }
});
```

### 3. Server Proxy Implementation

Minimal Edge Function that proxies to Gmail API:

```typescript
// apps/auth/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { query, pageToken } = await request.json();
    
    // Validate query
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
    }
    
    // Build Gmail search query
    const gmailQuery = buildGmailQuery(query);
    
    // Call Gmail API
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${new URLSearchParams({
        q: gmailQuery,
        maxResults: '50',
        ...(pageToken && { pageToken })
      })}`,
      {
        headers: {
          Authorization: `Bearer ${session.accessToken}`
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Gmail API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Return message IDs for client to fetch details
    return NextResponse.json({
      messages: data.messages || [],
      nextPageToken: data.nextPageToken,
      resultSizeEstimate: data.resultSizeEstimate
    });
  } catch (error) {
    console.error('Search proxy error:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}

function buildGmailQuery(userQuery: string): string {
  // Handle special search operators
  const operators = {
    'unread': 'is:unread',
    'starred': 'is:starred',
    'has attachment': 'has:attachment',
    'has attachments': 'has:attachment'
  };
  
  // Check for operators
  let gmailQuery = userQuery;
  for (const [key, value] of Object.entries(operators)) {
    if (userQuery.toLowerCase().includes(key)) {
      gmailQuery = gmailQuery.replace(new RegExp(key, 'gi'), value);
    }
  }
  
  return gmailQuery;
}
```

### 4. Natural Language Search (AI-Powered)

For complex queries, use Gemini to parse intent:

```typescript
// packages/core/src/search/ai-search.ts
export class AISearch {
  private geminiKey?: string;
  
  async parseNaturalLanguage(query: string): Promise<ParsedQuery> {
    // Simple queries don't need AI
    if (this.isSimpleQuery(query)) {
      return { gmailQuery: query };
    }
    
    // Complex queries use Gemini
    if (!this.geminiKey) {
      // Fallback to basic parsing
      return this.basicParse(query);
    }
    
    try {
      const response = await fetch('https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.geminiKey
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Convert this natural language email search query into a Gmail search query:
              
              User Query: "${query}"
              
              Return ONLY the Gmail search query string, nothing else.
              
              Examples:
              - "emails from john about the project" → "from:john project"
              - "unread emails with attachments this week" → "is:unread has:attachment after:${this.getDateString(7)}"
              - "emails I haven't replied to" → "is:unread -from:me"
              `
            }]
          }]
        })
      });
      
      const data = await response.json();
      const gmailQuery = data.candidates[0].content.parts[0].text.trim();
      
      return {
        gmailQuery,
        originalQuery: query,
        aiParsed: true
      };
    } catch (error) {
      console.error('AI search parse failed:', error);
      return this.basicParse(query);
    }
  }
  
  private isSimpleQuery(query: string): boolean {
    // Simple if just keywords or basic operators
    const hasComplexPhrases = /(\bfrom\s+\w+\s+about\b|\bhaven't\s+replied\b|\blast\s+week\b)/i.test(query);
    return !hasComplexPhrases;
  }
  
  private basicParse(query: string): ParsedQuery {
    // Basic keyword extraction
    let gmailQuery = query;
    
    // Handle common patterns
    const patterns = [
      { regex: /from\s+(\w+)/i, replace: 'from:$1' },
      { regex: /to\s+(\w+)/i, replace: 'to:$1' },
      { regex: /subject[:\s]+(.+?)(?=\s+from|\s+to|$)/i, replace: 'subject:$1' }
    ];
    
    patterns.forEach(({ regex, replace }) => {
      gmailQuery = gmailQuery.replace(regex, replace);
    });
    
    return { gmailQuery };
  }
}
```

## Search UI Components

### Search Input with Live Results

```typescript
// apps/web/src/components/search-bar.tsx
import { useState, useCallback, useRef } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { useSearch } from '@/hooks/use-search';

export function SearchBar() {
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const { results, isSearching } = useSearch(debouncedQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Cmd/Ctrl + K to focus search
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      inputRef.current?.focus();
    }
    
    // Escape to clear
    if (e.key === 'Escape') {
      setQuery('');
      setShowResults(false);
      inputRef.current?.blur();
    }
  }, []);
  
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
  
  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setShowResults(true);
        }}
        onFocus={() => setShowResults(true)}
        placeholder="Search emails... (⌘K)"
        className="w-full px-4 py-2 border rounded-lg"
      />
      
      {showResults && query && (
        <div className="absolute top-full mt-2 w-full bg-white border rounded-lg shadow-lg max-h-96 overflow-auto">
          {/* Local results (instant) */}
          {results.local.length > 0 && (
            <div>
              <div className="px-4 py-2 text-sm text-gray-500">
                Quick results
              </div>
              {results.local.map(email => (
                <SearchResult key={email.id} email={email} />
              ))}
            </div>
          )}
          
          {/* Loading server results */}
          {isSearching && (
            <div className="px-4 py-2 text-sm text-gray-500">
              Searching all emails...
            </div>
          )}
          
          {/* Complete results */}
          {results.isComplete && (
            <div>
              <div className="px-4 py-2 text-sm text-gray-500">
                All results ({results.totalResults})
              </div>
              {results.server.map(email => (
                <SearchResult key={email.id} email={email} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

## Performance Optimizations

### 1. Search Result Caching

Cache search results to avoid redundant API calls:

```typescript
// packages/core/src/search/search-cache.ts
export class SearchCache {
  private cache = new Map<string, CachedResult>();
  private readonly MAX_CACHE_SIZE = 100;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  get(query: string): Email[] | null {
    const cached = this.cache.get(query);
    
    if (!cached) return null;
    
    // Check if expired
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(query);
      return null;
    }
    
    // Move to end (LRU)
    this.cache.delete(query);
    this.cache.set(query, cached);
    
    return cached.results;
  }
  
  set(query: string, results: Email[]) {
    // Enforce cache size limit
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      // Remove oldest (first) entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(query, {
      results,
      timestamp: Date.now()
    });
  }
}
```

### 2. Search Indexing Strategy

Keep search index updated efficiently:

```typescript
// packages/core/src/search/index-manager.ts
export class SearchIndexManager {
  private updateQueue: Email[] = [];
  private updateTimer?: NodeJS.Timeout;
  
  async onEmailsChanged(emails: Email[]) {
    // Queue index updates
    this.updateQueue.push(...emails);
    
    // Debounce updates
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
    }
    
    this.updateTimer = setTimeout(() => {
      this.flushUpdates();
    }, 1000); // Wait 1 second for more changes
  }
  
  private async flushUpdates() {
    if (this.updateQueue.length === 0) return;
    
    // Take current queue
    const updates = this.updateQueue.splice(0);
    
    // Update search index in worker
    await this.localSearch.updateIndex(updates);
    
    // Clear timer
    this.updateTimer = undefined;
  }
}
```

## Testing Search Functionality

```typescript
// packages/core/src/search/__tests__/search-orchestrator.test.ts
describe('SearchOrchestrator', () => {
  it('should return local results immediately', async () => {
    const orchestrator = new SearchOrchestrator();
    const provisionalResults: Email[] = [];
    
    orchestrator.onProvisionalResults = (results) => {
      provisionalResults.push(...results);
    };
    
    const results = await orchestrator.search('test query');
    
    // Should have provisional results before final
    expect(provisionalResults.length).toBeGreaterThan(0);
    expect(results.isComplete).toBe(true);
  });
  
  it('should merge and deduplicate results', async () => {
    const localResults = [
      { id: '1', subject: 'Local 1' },
      { id: '2', subject: 'Local 2' }
    ];
    
    const serverResults = [
      { id: '2', subject: 'Server 2' }, // Duplicate
      { id: '3', subject: 'Server 3' }  // New
    ];
    
    const merged = orchestrator.mergeResults(localResults, serverResults);
    
    expect(merged.emails).toHaveLength(3);
    expect(merged.emails[1].subject).toBe('Server 2'); // Server overrides
  });
});
```

## Implementation Timeline

### Phase 1 (MVP)
- [x] Local search with MiniSearch
- [ ] Basic server proxy endpoint
- [ ] Simple query parsing
- [ ] Search UI component

### Phase 2
- [ ] Natural language parsing with Gemini
- [ ] Search result caching
- [ ] Advanced search operators
- [ ] Search suggestions

### Phase 3
- [ ] Distributed search index
- [ ] Phonetic/typo tolerance
- [ ] Search analytics
- [ ] Saved searches

## Key Benefits

1. **Instant Results**: Local search provides sub-10ms results
2. **Complete Coverage**: Server proxy ensures nothing is missed
3. **No Infrastructure**: No Elasticsearch or search servers needed
4. **Privacy**: Search queries can stay local when possible
5. **Cost Efficient**: Only pay for Gmail API calls, not search infrastructure

---

This hybrid approach gives users the responsiveness of local search with the completeness of server search, all while maintaining our client-first architecture.