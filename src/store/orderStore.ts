import { create } from "zustand";
import type { Order, OrderInput } from "../types/order";
import { storageService } from "../services/storage.service";
const KEY = "customer-orders-v1";
interface Store {
  orders: Order[];
  addOrder: (input: OrderInput) => void;
  updateOrder: (id: string, input: OrderInput) => void;
  deleteOrder: (id: string) => void;
  replaceOrders: (orders: Order[]) => void;
  appendOrders: (orders: Order[]) => void;
}
const persist = (orders: Order[]) => {
  storageService.set(KEY, orders);
  return orders;
};
export const useOrderStore = create<Store>((set) => ({
  orders: storageService.get<Order[]>(KEY, []),
  addOrder: (input) =>
    set((s) => {
      const now = new Date().toISOString();
      const next = Math.max(0, ...s.orders.map((o) => o.orderNumber)) + 1;
      const order: Order = {
        ...input,
        id: crypto.randomUUID(),
        orderNumber: next,
        createdAt: now,
        updatedAt: now,
      };
      return { orders: persist([order, ...s.orders]) };
    }),
  updateOrder: (id, input) =>
    set((s) => ({
      orders: persist(
        s.orders.map((o) =>
          o.id === id
            ? { ...o, ...input, updatedAt: new Date().toISOString() }
            : o,
        ),
      ),
    })),
  deleteOrder: (id) =>
    set((s) => ({ orders: persist(s.orders.filter((o) => o.id !== id)) })),
  replaceOrders: (orders) => set({ orders: persist(orders) }),
  appendOrders: (incoming) =>
    set((s) => {
      const fingerprints = new Set(
        s.orders.map(
          (o) =>
            `${o.orderDate}|${o.customerName.toLowerCase()}|${o.orderNumber}`,
        ),
      );
      let next = Math.max(0, ...s.orders.map((o) => o.orderNumber));
      const unique = incoming
        .filter(
          (o) =>
            !fingerprints.has(
              `${o.orderDate}|${o.customerName.toLowerCase()}|${o.orderNumber}`,
            ),
        )
        .map((o) => ({ ...o, orderNumber: ++next }));
      return { orders: persist([...s.orders, ...unique]) };
    }),
}));
