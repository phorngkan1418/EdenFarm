import type { DateFilterType } from "../types/order";
import DateInput from "./DateInput";

export interface FiltersValue {
  type: DateFilterType;
  specific: string;
  from: string;
  to: string;
  search: string;
  product: string;
  minKg: string;
  maxKg: string;
  minPrice: string;
  maxPrice: string;
}

export const EMPTY_FILTERS: FiltersValue = {
  type: "all",
  specific: "",
  from: "",
  to: "",
  search: "",
  product: "",
  minKg: "",
  maxKg: "",
  minPrice: "",
  maxPrice: "",
};

export default function Filters({
  value,
  onChange,
}: {
  value: FiltersValue;
  onChange: (value: FiltersValue) => void;
}) {
  const set = (patch: Partial<FiltersValue>) =>
    onChange({ ...value, ...patch });
  const numeric = (input: string) => input.replace(/[^0-9.]/g, "");

  return (
    <section className="filters advanced-filters">
      <div className="filter-search-row">
        <label className="search-field">
          Search all records
          <input
            className="search"
            placeholder="Customer, phone, product, order number..."
            value={value.search}
            onChange={(event) => set({ search: event.target.value })}
          />
        </label>
        <label>
          Product code
          <input
            placeholder="C, L, O..."
            value={value.product}
            onChange={(event) =>
              set({ product: event.target.value.toUpperCase() })
            }
          />
        </label>
      </div>

      <div className="filter-group">
        
        <div className="quick">
          {(["all", "today", "week", "month"] as DateFilterType[]).map(
            (type) => (
              <button
                type="button"
                key={type}
                className={value.type === type ? "active ghost" : "ghost"}
                onClick={() => set({ type })}
              >
                {type === "all"
                  ? "All dates"
                  : type === "today"
                    ? "Today"
                    : type === "week"
                      ? "This week"
                      : "This month"}
              </button>
            ),
          )}
        </div>
        <label>
          Specific day
          <DateInput
            value={value.specific}
            onChange={(specific) => set({ specific, type: "specific-day" })}
          />
        </label>
        <label>
          From date
          <DateInput
            value={value.from}
            onChange={(from) => set({ from, type: "custom" })}
          />
        </label>
        <label>
          To date
          <DateInput
            value={value.to}
            onChange={(to) => set({ to, type: "custom" })}
          />
        </label>
      </div>

     {/* <div className="filter-group measure-group">
        <div className="filter-group-title">
          <strong>Kg & price</strong>
          <span>Filter product lines</span>
        </div>
        <label>
          Minimum Kg
          <div className="suffix-input">
            <input
              inputMode="decimal"
              placeholder="0"
              value={value.minKg}
              onChange={(event) => set({ minKg: numeric(event.target.value) })}
            />
            <b>Kg</b>
          </div>
        </label>
        <label>
          Maximum Kg
          <div className="suffix-input">
            <input
              inputMode="decimal"
              placeholder="Any"
              value={value.maxKg}
              onChange={(event) => set({ maxKg: numeric(event.target.value) })}
            />
            <b>Kg</b>
          </div>
        </label>
        <label>
          Minimum price / Kg
          <div className="prefix-input">
            <b>$</b>
            <input
              inputMode="decimal"
              placeholder="0.00"
              value={value.minPrice}
              onChange={(event) =>
                set({ minPrice: numeric(event.target.value) })
              }
            />
          </div>
        </label>
        <label>
          Maximum price / Kg
          <div className="prefix-input">
            <b>$</b>
            <input
              inputMode="decimal"
              placeholder="Any"
              value={value.maxPrice}
              onChange={(event) =>
                set({ maxPrice: numeric(event.target.value) })
              }
            />
          </div>
        </label>
        <button
          type="button"
          className="ghost reset-button"
          onClick={() => onChange(EMPTY_FILTERS)}
        >
          Reset all
        </button>
      </div> */}
    </section>
  );
}
