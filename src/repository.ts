// A box with a label: one repository for any type that has an id (generics).
// The data is private: outside code can only use add / getAll / findById.
export class Repository<T extends { id: string }> {
  private items: T[];

  constructor(items: T[] = []) {
    this.items = [...items];
  }

  add(item: T): void {
    this.items.push(item);
  }

  getAll(): T[] {
    return [...this.items]; 
  }

  findById(id: string): T | undefined {
    return this.items.find((item) => item.id === id);
  }
  removeAll(): void {
    this.items = [];
  }
  removeById(id: string): void {
    const exists = this.items.some((item) => item.id === id);

    if (!exists) {
      throw new Error(`Cannot remove: item with id "${id}" was not found`);
    }

    this.items = this.items.filter((item) => item.id !== id);
  }

  updateById(id: string, updatedItem: Partial<Omit<T, "id">>): void {
    const index = this.items.findIndex((item) => item.id === id);

    if (index === -1) {
      throw new Error(`Cannot update: item with id "${id}" was not found`);
    }

    this.items[index] = { ...this.items[index], ...updatedItem };
  }
}
