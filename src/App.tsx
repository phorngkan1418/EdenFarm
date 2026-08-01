import { useMemo, useRef, useState, type ChangeEvent } from "react";
import OrderForm from "./components/OrderForm";
import Filters, {
  EMPTY_FILTERS,
  type FiltersValue,
} from "./components/Filters";
import { useOrderStore } from "./store/orderStore";
import { exportOrders, importOrders } from "./services/excel.service";
import { filterOrders, formatDateDMY, money } from "./utils/date";
import type { Order, OrderInput } from "./types/order";
import "./styles.css";

type View = "dashboard" | "create" | "manage" | "customers" | "reports";

const navItems: { id: View; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "◫" },
  { id: "create", label: "Create Order", icon: "+" },
  { id: "manage", label: "Manage Orders", icon: "▤" },
  { id: "customers", label: "Customers", icon: "♙" },
  { id: "reports", label: "Reports", icon: "↗" },
];

export default function App() {
  const orders = useOrderStore((state) => state.orders);
  const addOrder = useOrderStore((state) => state.addOrder);
  const updateOrder = useOrderStore((state) => state.updateOrder);
  const deleteOrder = useOrderStore((state) => state.deleteOrder);
  const appendOrders = useOrderStore((state) => state.appendOrders);
  const replaceOrders = useOrderStore((state) => state.replaceOrders);

  const [view, setView] = useState<View>("dashboard");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [message, setMessage] = useState("");
  const [filters, setFilters] = useState<FiltersValue>(EMPTY_FILTERS);

  const importRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);

  const visibleOrders = useMemo(() => {
    const dated = filterOrders(
      orders,
      filters.type,
      filters.specific,
      filters.from,
      filters.to,
    );
    const query = filters.search.trim().toLowerCase();
    const productQuery = filters.product.trim().toLowerCase();
    const minKg = filters.minKg === "" ? null : Number(filters.minKg);
    const maxKg = filters.maxKg === "" ? null : Number(filters.maxKg);
    const minPrice = filters.minPrice === "" ? null : Number(filters.minPrice);
    const maxPrice = filters.maxPrice === "" ? null : Number(filters.maxPrice);

    return dated
      .filter((order) => {
        if (!query) return true;
        return [
          order.orderNumber,
          order.customerName,
          order.phoneNumber,
          order.paymentStatus,
          order.note,
          ...order.items.map((item) => item.product),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .map((order) => ({
        ...order,
        items: order.items.filter((item) => {
          if (
            productQuery &&
            !item.product.toLowerCase().includes(productQuery)
          )
            return false;
          if (minKg !== null && item.quantity < minKg) return false;
          if (maxKg !== null && item.quantity > maxKg) return false;
          if (minPrice !== null && item.unitPrice < minPrice) return false;
          if (maxPrice !== null && item.unitPrice > maxPrice) return false;
          return true;
        }),
      }))
      .filter((order) => order.items.length > 0);
  }, [orders, filters]);

  const stats = useMemo(() => {
    const revenue = visibleOrders.reduce(
      (sum, order) =>
        sum + order.items.reduce((sub, item) => sub + item.total, 0),
      0,
    );
    const paid = visibleOrders.filter(
      (order) => order.paymentStatus === "Paid",
    ).length;
    const unpaid = visibleOrders.filter(
      (order) => order.paymentStatus !== "Paid",
    ).length;
    const customers = new Set(
      visibleOrders.map((order) => order.customerName.trim().toLowerCase()),
    ).size;
    const totalKg = visibleOrders.reduce(
      (sum, order) =>
        sum + order.items.reduce((sub, item) => sub + item.quantity, 0),
      0,
    );
    const productLines = visibleOrders.reduce(
      (sum, order) => sum + order.items.length,
      0,
    );
    const weightedPrice = totalKg > 0 ? revenue / totalKg : 0;
    return {
      revenue,
      paid,
      unpaid,
      customers,
      totalKg,
      productLines,
      weightedPrice,
    };
  }, [visibleOrders]);

  const customers = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        phone: string;
        orders: number;
        spent: number;
        lastDate: string;
      }
    >();
    orders.forEach((order) => {
      const key = `${order.customerName.trim().toLowerCase()}|${order.phoneNumber.trim()}`;
      const total = order.items.reduce((sum, item) => sum + item.total, 0);
      const current = map.get(key);
      if (current) {
        current.orders += 1;
        current.spent += total;
        if (order.orderDate > current.lastDate)
          current.lastDate = order.orderDate;
      } else {
        map.set(key, {
          name: order.customerName,
          phone: order.phoneNumber,
          orders: 1,
          spent: total,
          lastDate: order.orderDate,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.spent - a.spent);
  }, [orders]);

  const products = useMemo(() => {
    const map = new Map<
      string,
      { name: string; quantity: number; revenue: number }
    >();
    visibleOrders.forEach((order) =>
      order.items.forEach((item) => {
        const key = item.product.trim().toLowerCase();
        const current = map.get(key) ?? {
          name: item.product,
          quantity: 0,
          revenue: 0,
        };
        current.quantity += item.quantity;
        current.revenue += item.total;
        map.set(key, current);
      }),
    );
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [visibleOrders]);

  const saveOrder = (input: OrderInput) => {
    if (editing) {
      updateOrder(editing.id, input);
      setMessage(`Order #${editing.orderNumber} updated successfully.`);
    } else {
      addOrder(input);
      setMessage("New order saved successfully.");
    }
    setEditing(null);
    setView("manage");
  };

  const editOrder = (order: Order) => {
    const completeOrder =
      orders.find((current) => current.id === order.id) ?? order;
    setEditing(completeOrder);
    setView("create");
    window.setTimeout(
      () => window.scrollTo({ top: 0, behavior: "smooth" }),
      50,
    );
  };

  const removeOrder = (order: Order) => {
    if (!window.confirm(`Delete order #${order.orderNumber}?`)) return;
    deleteOrder(order.id);
    setMessage(`Order #${order.orderNumber} deleted.`);
  };

  const exportExcel = async () => {
    try {
      await exportOrders(visibleOrders);
      setMessage(`${visibleOrders.length} order(s) exported to Excel.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Export failed.");
    }
  };

  const readExcel = async (
    event: ChangeEvent<HTMLInputElement>,
    replace: boolean,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importOrders(file);
      if (replace) {
        if (!window.confirm("Replace all current orders with this Excel file?"))
          return;
        replaceOrders(imported);
      } else {
        appendOrders(imported);
      }
      setMessage(`${imported.length} order(s) imported successfully.`);
      setView("manage");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed.");
    } finally {
      event.target.value = "";
    }
  };

  const go = (next: View) => {
    setView(next);
    setMobileMenu(false);
  };

  return (
    <div className="shell">
      <aside className={`sidebar ${mobileMenu ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">EF</div>
          <div>
            <strong>Eden Farm</strong>
            <span>Order Manager</span>
          </div>
        </div>
        <nav>
          {navItems.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "nav-active" : ""}
              onClick={() => go(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <button
            className="menu-button"
            onClick={() => setMobileMenu((value) => !value)}
          >
            ☰
          </button>
          <div>
            <p className="crumb">Eden Farm / {view}</p>
            <h1>{navItems.find((item) => item.id === view)?.label}</h1>
          </div>
          <div className="top-actions">
            <button className="soft" onClick={() => importRef.current?.click()}>
              Import
            </button>
            <button onClick={exportExcel} disabled={!visibleOrders.length}>
              Export Excel
            </button>
          </div>
          <input
            ref={importRef}
            hidden
            type="file"
            accept=".xlsx"
            onChange={(event) => readExcel(event, false)}
          />
          <input
            ref={replaceRef}
            hidden
            type="file"
            accept=".xlsx"
            onChange={(event) => readExcel(event, true)}
          />
        </header>

        {message && (
          <div className="toast">
            <span>{message}</span>
            <button onClick={() => setMessage("")}>×</button>
          </div>
        )}

        {view === "dashboard" && (
          <>
            <section className="welcome">
              <div>
                <span className="pill">EDEN FARM </span>
                <h2>Good Work Starts With Clear Records.</h2>
                
              </div>
              <button onClick={() => go("create")}>+ New Order</button>
            </section>
            <Kpis
              orders={visibleOrders.length}
              revenue={stats.revenue}
              customers={stats.customers}
              unpaid={stats.unpaid}
            />
            <section className="dashboard-grid">
              <div className="panel">
                <div className="panel-head">
                  <div>
                    <h3>Recent orders</h3>
                    <p>Latest activity across Eden Farm</p>
                  </div>
                  <button className="link-button" onClick={() => go("manage")}>
                    View all
                  </button>
                </div>
                <RecentOrders orders={orders.slice(0, 6)} onEdit={editOrder} />
              </div>
              <div className="panel">
                <div className="panel-head">
                  <div>
                    <h3>Top products</h3>
                    <p>Based on visible order revenue</p>
                  </div>
                </div>
                <ProductBars products={products.slice(0, 5)} />
              </div>
            </section>
          </>
        )}

        {view === "create" && (
          <>
            <section className="page-intro create-intro">
              <div>
                <span className="pill">ORDER ENTRY</span>
                <h2>
                  {editing
                    ? `Edit Order #${editing.orderNumber}`
                    : "Create a New farm order"}
                </h2>
                
              </div>
              <div className="intro-actions">
                <button className="soft" onClick={() => go("manage")}>
                  View All Orders
                </button>
                <button
                  className="soft"
                  onClick={() => replaceRef.current?.click()}
                >
                  Replace from Excel
                </button>
              </div>
            </section>
            <OrderForm
              editing={editing}
              onSave={saveOrder}
              onCancel={() => {
                setEditing(null);
                go("manage");
              }}
            />
          </>
        )}

        {view === "manage" && (
          <>
            <section className="page-intro manage-intro">
              
              <div className="intro-actions">
                <button
                  onClick={() => {
                    setEditing(null);
                    go("create");
                  }}
                >
                  + Create Order
                </button>
                <button
                  className="soft"
                  onClick={() => importRef.current?.click()}
                >
                  Import Excel
                </button>
              </div>
            </section>
            <Filters value={filters} onChange={setFilters} />
            <ResultSummary
              orders={visibleOrders.length}
              lines={stats.productLines}
              totalKg={stats.totalKg}
              revenue={stats.revenue}
              averagePrice={stats.weightedPrice}
            />
            <OrderTable
              orders={visibleOrders}
              onEdit={editOrder}
              onDelete={removeOrder}
            />
          </>
        )}

        {view === "customers" && (
          <section className="panel page-panel">
            <div className="panel-head">
              <div>
                <h2>Customer Directory</h2>
                <p>Created from order history.</p>
              </div>
              <span className="count-pill">{customers.length} customers</span>
            </div>
            <div className="customer-grid">
              {customers.map((customer) => (
                <article
                  className="customer-card"
                  key={`${customer.name}-${customer.phone}`}
                >
                  <div className="avatar">
                    {customer.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3>{customer.name}</h3>
                    <p>{customer.phone || "No phone number"}</p>
                  </div>
                  <dl>
                    <div>
                      <dt>Orders</dt>
                      <dd>{customer.orders}</dd>
                    </div>
                    <div>
                      <dt>Total</dt>
                      <dd>{money(customer.spent)}</dd>
                    </div>
                    <div>
                      <dt>Last order</dt>
                      <dd>{formatDateDMY(customer.lastDate)}</dd>
                    </div>
                  </dl>
                </article>
              ))}
              {!customers.length && (
                <Empty text="No customers yet. Create or import an order first." />
              )}
            </div>
          </section>
        )}

        {view === "reports" && (
          <>
            <Filters value={filters} onChange={setFilters} />
            <ResultSummary
              orders={visibleOrders.length}
              lines={stats.productLines}
              totalKg={stats.totalKg}
              revenue={stats.revenue}
              averagePrice={stats.weightedPrice}
            />
            <Kpis
              orders={visibleOrders.length}
              revenue={stats.revenue}
              customers={stats.customers}
              unpaid={stats.unpaid}
            />
            <section className="dashboard-grid reports-grid">
              <div className="panel">
                <div className="panel-head">
                  <div>
                    <h3>Product performance</h3>
                    <p>Quantity and revenue for the selected period</p>
                  </div>
                </div>
                <ProductBars products={products} />
              </div>
              <div className="panel">
                <div className="panel-head">
                  <div>
                    <h3>Payment overview</h3>
                    <p>Order payment status</p>
                  </div>
                </div>
                <div className="payment-overview">
                  <div
                    className="donut"
                    style={
                      {
                        "--paid": `${visibleOrders.length ? (stats.paid / visibleOrders.length) * 100 : 0}%`,
                      } as React.CSSProperties
                    }
                  >
                    <span>
                      {visibleOrders.length
                        ? Math.round((stats.paid / visibleOrders.length) * 100)
                        : 0}
                      %<small>paid</small>
                    </span>
                  </div>
                  <div className="legend">
                    <p>
                      <i className="green" />
                      Paid <strong>{stats.paid}</strong>
                    </p>
                    <p>
                      <i className="amber" />
                      Need payment <strong>{stats.unpaid}</strong>
                    </p>
                  </div>
                </div>
                <button
                  className="wide"
                  onClick={exportExcel}
                  disabled={!visibleOrders.length}
                >
                  Export this report to Excel
                </button>
              </div>
            </section>
          </>
        )}

        <footer>
          Eden Farm ·Cambodia
        </footer>
      </main>
      {mobileMenu && (
        <button
          className="scrim"
          aria-label="Close menu"
          onClick={() => setMobileMenu(false)}
        />
      )}
    </div>
  );
}

function ResultSummary({
  orders,
  lines,
  totalKg,
  revenue,
  averagePrice,
}: {
  orders: number;
  lines: number;
  totalKg: number;
  revenue: number;
  averagePrice: number;
}) {
  return (
    <section className="result-summary">
      <article>
        <span>Orders found</span>
        <strong>{orders}</strong>
      </article>
      <article>
        <span>Product lines</span>
        <strong>{lines}</strong>
      </article>
      <article className="kg-result">
        <span>Total weight</span>
        <strong>{totalKg.toFixed(2)} Kg</strong>
      </article>
      <article>
        <span>Total price</span>
        <strong>{money(revenue)}</strong>
      </article>
      <article>
        
      </article>
    </section>
  );
}

function Kpis({
  orders,
  revenue,
  customers,
  unpaid,
}: {
  orders: number;
  revenue: number;
  customers: number;
  unpaid: number;
}) {
  return (
    <section className="kpis">
      <article>
        <span className="kpi-icon green-bg">▤</span>
        <div>
          <p>Total orders</p>
          <strong>{orders}</strong>
         
        </div>
      </article>
      <article>
        <span className="kpi-icon blue-bg">$</span>
        <div>
          <p>Revenue</p>
          <strong>{money(revenue)}</strong>
        
        </div>
      </article>
      <article>
        <span className="kpi-icon purple-bg">♙</span>
        <div>
          <p>Customers</p>
          <strong>{customers}</strong>
          
        </div>
      </article>
      <article>
        <span className="kpi-icon amber-bg">!</span>
        <div>
          <p>Need payment</p>
          <strong>{unpaid}</strong>
          
        </div>
      </article>
    </section>
  );
}

function RecentOrders({
  orders,
  onEdit,
}: {
  orders: Order[];
  onEdit: (order: Order) => void;
}) {
  if (!orders.length)
    return <Empty text="No orders yet. Record the first Eden Farm order." />;
  return (
    <div className="recent-list">
      {orders.map((order) => (
        <button key={order.id} onClick={() => onEdit(order)}>
          <span className="order-dot">#{order.orderNumber}</span>
          <span>
            <strong>{order.customerName}</strong>
            <small>{order.items.map((item) => item.product).join(", ")}</small>
          </span>
          <span>
            <strong>
              {money(order.items.reduce((sum, item) => sum + item.total, 0))}
            </strong>
            <small>{formatDateDMY(order.orderDate)}</small>
          </span>
        </button>
      ))}
    </div>
  );
}

function ProductBars({
  products,
}: {
  products: { name: string; quantity: number; revenue: number }[];
}) {
  if (!products.length)
    return (
      <Empty text="Product performance will appear after orders are added." />
    );
  const max = Math.max(...products.map((item) => item.revenue), 1);
  return (
    <div className="product-bars">
      {products.map((item) => (
        <div key={item.name}>
          <div>
            <strong>{item.name}</strong>
            <span>{money(item.revenue)}</span>
          </div>
          <div className="bar">
            <i
              style={{ width: `${Math.max(6, (item.revenue / max) * 100)}%` }}
            />
          </div>
          <small>{item.quantity} units sold</small>
        </div>
      ))}
    </div>
  );
}

function OrderTable({
  orders,
  onEdit,
  onDelete,
}: {
  orders: Order[];
  onEdit: (order: Order) => void;
  onDelete: (order: Order) => void;
}) {
  return (
    <section className="table-card">
      <div className="table-title">
        <div>
          <h3>Order records</h3>
          <p>{orders.length} order(s) shown</p>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {[
                "No",
                "Order date",
                "Delivered",
                "Customer",
                "Phone",
                "Product",
                "Quantity",
                "Unit price",
                "Total",
                "Payment",
                "Note",
                "Actions",
              ].map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map((order) =>
              order.items.map((item, index) => (
                <tr key={item.id} className={index === 0 ? "group-start" : ""}>
                  {index === 0 && (
                    <>
                      <td data-label="No" rowSpan={order.items.length}>
                        <span className="order-number">
                          #{order.orderNumber}
                        </span>
                      </td>
                      <td data-label="Order date" rowSpan={order.items.length}>
                        {formatDateDMY(order.orderDate)}
                      </td>
                      <td data-label="Delivered" rowSpan={order.items.length}>
                        {formatDateDMY(order.deliveredDate)}
                      </td>
                      <td data-label="Customer" rowSpan={order.items.length}>
                        <strong>{order.customerName}</strong>
                      </td>
                      <td data-label="Phone" rowSpan={order.items.length}>
                        {order.phoneNumber || "—"}
                      </td>
                    </>
                  )}
                  <td data-label="Product">{item.product}</td>
                  <td data-label="Quantity">
                    {item.quantity} {item.unit}
                  </td>
                  <td data-label="Unit price">{money(item.unitPrice)}</td>
                  <td data-label="Total">
                    <strong>{money(item.total)}</strong>
                  </td>
                  {index === 0 && (
                    <>
                      <td data-label="Payment" rowSpan={order.items.length}>
                        <span
                          className={`badge ${order.paymentStatus.toLowerCase()}`}
                        >
                          {order.paymentStatus}
                        </span>
                      </td>
                      <td data-label="Note" rowSpan={order.items.length}>
                        {order.note || "—"}
                      </td>
                      <td data-label="Actions" rowSpan={order.items.length}>
                        <div className="row-actions">
                          <button
                            className="small soft"
                            onClick={() => onEdit(order)}
                          >
                            Edit
                          </button>
                          <button
                            className="small danger"
                            onClick={() => onDelete(order)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              )),
            )}
            {!orders.length && (
              <tr>
                <td colSpan={12}>
                  <Empty text="No orders match the selected filters." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <span>🌱</span>
      <p>{text}</p>
    </div>
  );
}
