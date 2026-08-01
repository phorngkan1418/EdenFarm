export type PaymentStatus = "Paid" | "Unpaid" | "Partial";
export type DateFilterType =
  | "all"
  | "today"
  | "week"
  | "month"
  | "specific-day"
  | "custom";
export interface OrderItem {
  id: string;
  product: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}
export interface Order {
  id: string;
  orderNumber: number;
  orderDate: string;
  deliveredDate: string;
  customerName: string;
  phoneNumber: string;
  items: OrderItem[];
  paymentStatus: PaymentStatus;
  note: string;
  createdAt: string;
  updatedAt: string;
}
export type OrderInput = Omit<
  Order,
  "id" | "orderNumber" | "createdAt" | "updatedAt"
>;
