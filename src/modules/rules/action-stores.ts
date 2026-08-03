/**
 * In-memory customer tag store for rule action stubs (Phase 8 C-03).
 * Live customer tagging / segment membership can wire later.
 */
export class CustomerTagStore {
  private readonly tagsByCustomer = new Map<string, Set<string>>();

  add(customerId: string, tag: string): void {
    const id = customerId.trim();
    const normalized = tag.trim().toLowerCase();
    if (!id || !normalized) {
      return;
    }
    let set = this.tagsByCustomer.get(id);
    if (!set) {
      set = new Set();
      this.tagsByCustomer.set(id, set);
    }
    set.add(normalized);
  }

  list(customerId: string): string[] {
    const set = this.tagsByCustomer.get(customerId.trim());
    return set ? [...set].sort() : [];
  }

  clear(): void {
    this.tagsByCustomer.clear();
  }
}

export const customerTagStore = new CustomerTagStore();

export type EmittedNotificationStub = {
  ruleCode: string;
  channel: string;
  template: string;
  customerId: string | null;
  eventName: string;
  at: Date;
};

/**
 * In-memory notification emit stub for rule actions (Phase 8 C-03).
 */
export class NotificationEmitStore {
  private readonly items: EmittedNotificationStub[] = [];

  push(item: EmittedNotificationStub): void {
    this.items.push(item);
  }

  list(): readonly EmittedNotificationStub[] {
    return [...this.items];
  }

  clear(): void {
    this.items.length = 0;
  }
}

export const notificationEmitStore = new NotificationEmitStore();
