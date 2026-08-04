import { useEffect, useState, type FormEvent } from "react";
import type {
  Order,
  OrderInput,
  OrderItem,
  PaymentStatus,
} from "../types/order";
import DateInput from "./DateInput";

const blankItem = (): OrderItem => ({
  id: crypto.randomUUID(),
  product: "",
  quantity: 0,
  unit: "Kg",
  unitPrice: 0,
  total: 0,
});
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const empty = (): OrderInput => ({
  orderDate: today(),
  deliveredDate: "",
  customerName: "",
  phoneNumber: "",
  items: [blankItem()],
  paymentStatus: "Unpaid",
  note: "",
});

export default function OrderForm({
  editing,
  onSave,
  onCancel,
}: {
  editing: Order | null;
  onSave: (value: OrderInput) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<OrderInput>(empty());
  const [error, setError] = useState("");
  useEffect(() => {
    setForm(
      editing
        ? {
            orderDate: editing.orderDate,
            deliveredDate: editing.deliveredDate,
            customerName: editing.customerName,
            phoneNumber: editing.phoneNumber,
            items: editing.items.map((item) => ({ ...item, unit: "Kg" })),
            paymentStatus: editing.paymentStatus,
            note: editing.note,
          }
        : empty(),
    );
    setError("");
  }, [editing]);

  const updateItem = (
    id: string,
    field: "product" | "quantity" | "unitPrice",
    value: string | number,
  ) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, [field]: value, unit: "Kg" } as OrderItem;
        next.total = Number(next.quantity) * Number(next.unitPrice);
        return next;
      }),
    }));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.orderDate)
      return setError("Order date is required in DD/MM/YYYY format.");
    if (form.deliveredDate && form.deliveredDate < form.orderDate)
      return setError("Delivered date cannot be earlier than order date.");
    if (!form.customerName.trim())
      return setError("Customer name is required.");
    if (
      form.items.some(
        (item) =>
          !item.product.trim() || item.quantity <= 0 || item.unitPrice < 0,
      )
    )
      return setError("Check product, Kg quantity, and unit price.");
    onSave({
      ...form,
      customerName: form.customerName.trim(),
      phoneNumber: form.phoneNumber.trim(),
      note: form.note.trim(),
      items: form.items.map((item) => ({
        ...item,
        product: item.product.trim().toUpperCase(),
        unit: "Kg",
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        total: Number(item.quantity) * Number(item.unitPrice),
      })),
    });
    setForm(empty());
    setError("");
  };

  const totalKg = form.items.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0,
  );
  const orderTotal = form.items.reduce((sum, item) => sum + item.total, 0);

  return (
    <form className="order-form" onSubmit={submit}>
      <div className="form-head">
        <div>
          <h2>{editing ? "Edit order" : "Record farm order"}</h2>
          <p className="form-subtitle">
            Dates are Day / Month / Year
          </p>
        </div>
        {editing && (
          <button type="button" className="ghost" onClick={onCancel}>
            Cancel Edit
          </button>
        )}
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="form-grid">
        <label>
          Order Date{" "}
          <DateInput
            required
            label="Order date"
            value={form.orderDate}
            onChange={(orderDate) => setForm({ ...form, orderDate })}
          />
        </label>
        <label>
          Delivered Date{" "}
          <DateInput
            label="Delivered date"
            value={form.deliveredDate}
            onChange={(deliveredDate) => setForm({ ...form, deliveredDate })}
          />
        </label>
        <label>
          Customer Name
          <input
            required
            placeholder="Customer name"
            value={form.customerName}
            onChange={(event) =>
              setForm({ ...form, customerName: event.target.value })
            }
          />
        </label>
        <label>
          Phone Number
          <input
            type="tel"
            inputMode="tel"
            placeholder="Phone number"
            value={form.phoneNumber}
            onChange={(event) =>
              setForm({ ...form, phoneNumber: event.target.value })
            }
          />
        </label>
        <label>
          Payment status
          <select
            value={form.paymentStatus}
            onChange={(event) =>
              setForm({
                ...form,
                paymentStatus: event.target.value as PaymentStatus,
              })
            }
          >
            <option>Paid</option>
            <option>Unpaid</option>
            <option>Partial</option>
          </select>
        </label>
        <label>
          Note
          <input
            placeholder="Optional note"
            value={form.note}
            onChange={(event) => setForm({ ...form, note: event.target.value })}
          />
        </label>
      </div>
      <div className="products-heading">
        <div>
          <h3>Products and Kilograms</h3>
        </div>
        <button
          type="button"
          className="soft"
          onClick={() =>
            setForm({ ...form, items: [...form.items, blankItem()] })
          }
        >
          + Add product
        </button>
      </div>
      
      <div className="product-list">
        {form.items.map((item, index) => (
          <div className="item-row" key={item.id}>
            <span className="item-number">{index + 1}</span>
            <label className="mobile-field">
              <span className="mobile-label">Product</span>
              <input
                placeholder="Product Name"
                value={item.product}
                onChange={(event) =>
                  updateItem(item.id, "product", event.target.value)
                }
              />
            </label>
            <label className="mobile-field">
              <span className="mobile-label">Quantity (Kg)</span>
              <div className="kg-input">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0.00"
                  step="0.00"
                  value={item.quantity}
                  onChange={(event) =>
                    updateItem(item.id, "quantity", Number(event.target.value))
                  }
                />
                <b>Kg</b>
              </div>
            </label>
            <label className="mobile-field">
              <span className="mobile-label">Price / Kg</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={item.unitPrice}
                onChange={(event) =>
                  updateItem(item.id, "unitPrice", Number(event.target.value))
                }
              />
            </label>
            <strong className="item-total">${item.total.toFixed(2)}</strong>
            <button
              type="button"
              className="danger small"
              disabled={form.items.length === 1}
              onClick={() =>
                setForm({
                  ...form,
                  items: form.items.filter((current) => current.id !== item.id),
                })
              }
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <div className="order-summary">
        <span>
          Total weight <strong>{totalKg.toFixed(2)} Kg</strong>
        </span>
        <span>
          Order total <strong>${orderTotal.toFixed(2)}</strong>
        </span>
      </div>
      <div className="form-actions">
        <button
          type="button"
          className="soft"
          onClick={() =>
            setForm({ ...form, items: [...form.items, blankItem()] })
          }
        >
          + Add another product
        </button>
        <button type="submit">{editing ? "Save changes" : "Save order"}</button>
      </div>
    </form>
  );
}
