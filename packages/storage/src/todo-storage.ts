import { FinitoDatabase } from './database';
import type { Todo, TodoEmailLink } from '@finito/types';

export class TodoStorage {
  constructor(private db: FinitoDatabase) {}

  async getTodos(completed?: boolean): Promise<Todo[]> {
    if (completed === undefined) {
      return this.db.todos.orderBy('createdAt').reverse().toArray();
    }

    return this.db.todos
      .where('[completed+createdAt]')
      .between([completed ? 1 : 0, 0], [completed ? 1 : 0, Infinity])
      .reverse()
      .toArray();
  }

  async getTodo(id: string): Promise<Todo | undefined> {
    return this.db.todos.get(id);
  }

  async getTodosByEmail(emailId: string): Promise<Todo[]> {
    const links = await this.db.todoEmailLinks.where('emailId').equals(emailId).toArray();
    const todoIds = links.map(link => link.todoId);
    return this.db.todos.where('id').anyOf(todoIds).toArray();
  }

  async getTodosByThread(threadId: string): Promise<Todo[]> {
    return this.db.todos.where('threadId').equals(threadId).toArray();
  }

  async createTodo(todo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date();
    
    const newTodo: Todo = {
      ...todo,
      id,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.transaction('rw', this.db.todos, this.db.todoEmailLinks, async () => {
      await this.db.todos.add(newTodo);
      
      // Create email link if emailId is provided
      if (todo.emailId) {
        await this.db.todoEmailLinks.add({
          todoId: id,
          emailId: todo.emailId,
          linkType: 'action',
        });
      }
    });

    return id;
  }

  async updateTodo(id: string, updates: Partial<Todo>): Promise<void> {
    await this.db.todos.update(id, {
      ...updates,
      updatedAt: new Date(),
    });
  }

  async deleteTodo(id: string): Promise<void> {
    await this.db.transaction('rw', this.db.todos, this.db.todoEmailLinks, async () => {
      await this.db.todos.delete(id);
      await this.db.todoEmailLinks.where('todoId').equals(id).delete();
    });
  }

  async toggleTodoComplete(id: string): Promise<void> {
    const todo = await this.db.todos.get(id);
    if (todo) {
      await this.updateTodo(id, { completed: !todo.completed });
    }
  }

  async linkTodoToEmail(todoId: string, emailId: string, linkType: 'reference' | 'action' = 'reference'): Promise<void> {
    const existingLink = await this.db.todoEmailLinks
      .where('[todoId+emailId]')
      .equals([todoId, emailId])
      .first();

    if (!existingLink) {
      await this.db.todoEmailLinks.add({
        todoId,
        emailId,
        linkType,
      });
    }
  }

  async unlinkTodoFromEmail(todoId: string, emailId: string): Promise<void> {
    await this.db.todoEmailLinks
      .where('[todoId+emailId]')
      .equals([todoId, emailId])
      .delete();
  }

  async extractTodosFromEmail(emailId: string, content: string): Promise<string[]> {
    const todoPatterns = [
      /(?:todo|task|action item):\s*(.+?)(?:\n|$)/gi,
      /\[\s*\]\s*(.+?)(?:\n|$)/g,
      /(?:please|could you|can you|need to|should|must)\s+(.+?)(?:\.|!|\?|$)/gi,
    ];

    const extractedTodos: string[] = [];
    
    for (const pattern of todoPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const todoText = match[1].trim();
        if (todoText.length > 5 && todoText.length < 200) {
          extractedTodos.push(todoText);
        }
      }
    }

    const createdTodoIds: string[] = [];
    
    for (const todoText of extractedTodos) {
      const id = await this.createTodo({
        title: todoText,
        emailId,
        completed: false,
        priority: 'medium',
        labels: ['auto-extracted'],
      });
      createdTodoIds.push(id);
    }

    return createdTodoIds;
  }
}