import { Status } from "./models.js";

// A box with a label: one repository for any type that has an id (generics).
// The data is private: outside code accesses it through the repository methods.
export class Repository<T extends { id: string }> {
  private items: T[];

  constructor(items: T[] = []) {
    this.items = [...items];
  }

  add(item: T): void {
    this.items.push(item);
  }

  getAll(): T[] {
    return [...this.items]; // a copy, so nobody can change the original list
  }

  findById(id: string): T | undefined {
    return this.items.find((item) => item.id === id);
  }

  update(id: string, status: Status): T | undefined {
    const item = this.findById(id);

    if (item === undefined) {
      return undefined;
    }

    if (!("status" in item)) {
      return undefined;
    }

    item.status = status;
    return item;
  }

  remove(id: string): boolean {
    const index = this.items.findIndex((item) => item.id === id);

    if (index === -1) {
      return false;
    }

    this.items.splice(index, 1);
    return true;
  }
}
