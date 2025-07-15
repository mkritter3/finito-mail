import { useLiveQuery } from 'dexie-react-hooks';
import { FinitoDatabase } from './database';
import type { Email, Todo, EmailFolder, SearchFilters } from '@finito/types';

let db: FinitoDatabase;

export function initializeDatabase(): FinitoDatabase {
  if (!db) {
    db = new FinitoDatabase();
  }
  return db;
}

export function useDatabase(): FinitoDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

// Email hooks
export function useEmails(folder: EmailFolder = 'inbox', limit = 50): Email[] | undefined {
  const db = useDatabase();
  
  return useLiveQuery(async () => {
    if (folder === 'all') {
      return db.emails
        .orderBy('timestamp')
        .reverse()
        .limit(limit)
        .toArray();
    }
    
    return db.emails
      .where('[folder+timestamp]')
      .between([folder, 0], [folder, Infinity])
      .reverse()
      .limit(limit)
      .toArray();
  }, [folder, limit]);
}

export function useEmail(id: string): Email | undefined {
  const db = useDatabase();
  return useLiveQuery(() => db.emails.get(id), [id]);
}

export function useThreadEmails(threadId: string): Email[] | undefined {
  const db = useDatabase();
  
  return useLiveQuery(
    () => db.emails
      .where('[threadId+timestamp]')
      .between([threadId, 0], [threadId, Infinity])
      .toArray(),
    [threadId]
  );
}

export function useUnreadCount(): number {
  const db = useDatabase();
  
  const count = useLiveQuery(
    () => db.emails.where('isRead').equals(0).count(),
    []
  );
  
  return count || 0;
}

export function useSearchResults(filters: SearchFilters): Email[] | undefined {
  const db = useDatabase();
  
  return useLiveQuery(async () => {
    let collection = db.emails.toCollection();

    if (filters.folder && filters.folder !== 'all') {
      collection = db.emails.where('folder').equals(filters.folder);
    }

    if (filters.isRead !== undefined) {
      collection = collection.filter(email => email.isRead === filters.isRead);
    }

    if (filters.isStarred !== undefined) {
      collection = collection.filter(email => email.isStarred === filters.isStarred);
    }

    if (filters.from) {
      collection = collection.filter(email => 
        email.from.email.toLowerCase().includes(filters.from!.toLowerCase())
      );
    }

    return collection.reverse().sortBy('timestamp');
  }, [JSON.stringify(filters)]);
}

// Todo hooks
export function useTodos(completed?: boolean): Todo[] | undefined {
  const db = useDatabase();
  
  return useLiveQuery(() => {
    if (completed === undefined) {
      return db.todos.orderBy('createdAt').reverse().toArray();
    }

    return db.todos
      .where('[completed+createdAt]')
      .between([completed ? 1 : 0, 0], [completed ? 1 : 0, Infinity])
      .reverse()
      .toArray();
  }, [completed]);
}

export function useTodo(id: string): Todo | undefined {
  const db = useDatabase();
  return useLiveQuery(() => db.todos.get(id), [id]);
}

export function useTodosByEmail(emailId: string): Todo[] | undefined {
  const db = useDatabase();
  
  return useLiveQuery(async () => {
    const links = await db.todoEmailLinks.where('emailId').equals(emailId).toArray();
    const todoIds = links.map(link => link.todoId);
    return db.todos.where('id').anyOf(todoIds).toArray();
  }, [emailId]);
}

export function useTodoCount(): { total: number; active: number; completed: number } {
  const db = useDatabase();
  
  const counts = useLiveQuery(async () => {
    const [total, completed] = await Promise.all([
      db.todos.count(),
      db.todos.where('completed').equals(1).count(),
    ]);
    
    return {
      total,
      completed,
      active: total - completed,
    };
  }, []);
  
  return counts || { total: 0, active: 0, completed: 0 };
}