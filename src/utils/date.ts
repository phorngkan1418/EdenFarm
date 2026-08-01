import type { DateFilterType, Order } from "../types/order";
const parse = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const startDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const endDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};
export function filterOrders(
  orders: Order[],
  type: DateFilterType,
  specific: string,
  from: string,
  to: string,
) {
  if (type === "all") return orders;
  const now = new Date();
  let a: Date, b: Date;
  if (type === "today") {
    a = startDay(now);
    b = endDay(now);
  } else if (type === "week") {
    a = startDay(now);
    const day = a.getDay();
    a.setDate(a.getDate() - (day === 0 ? 6 : day - 1));
    b = endDay(a);
    b.setDate(b.getDate() + 6);
  } else if (type === "month") {
    a = new Date(now.getFullYear(), now.getMonth(), 1);
    b = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  } else if (type === "specific-day" && specific) {
    a = startDay(parse(specific));
    b = endDay(parse(specific));
  } else if (type === "custom" && from && to) {
    a = startDay(parse(from));
    b = endDay(parse(to));
  } else return orders;
  return orders.filter((o) => {
    const d = parse(o.orderDate);
    return d >= a && d <= b;
  });
}
export const formatDateDMY = (dateString: string) => {
  if (!dateString) return "—";
  const [year, month, day] = dateString.split("-");
  if (!year || !month || !day) return dateString;
  return `${day}/${month}/${year}`;
};
export const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n,
  );
