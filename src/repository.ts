// A box with a label: one repository for any type that has an id (generics).

import { Booking } from "./models.js";
import type { UpdateBook } from "./updated-book.js";
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
    return [...this.items]; // a copy, so nobody can change the original list
  }

  findById(id: string): T | undefined {
    return this.items.find((item) => item.id === id);
  }
  remove(id : string) : void  {
    const index = this.items.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error (`LOI KHONG CO ID ${id}`);
    }
    this.items.splice(index,1);
  }
  update (id : string , dto : UpdateBook) : T {
     const index = this.items.findIndex((item) => item.id === id);
    if (index === -1) {
       throw new Error (`LOI KHONG CO ID ${id}`);
    }
      const current =  this.items[index] 
       const updated = {...current , ... dto};
       this.items[index] = updated;
       return updated;
    }
  }
 
