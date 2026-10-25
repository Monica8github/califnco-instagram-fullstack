import { useEffect, useState } from "react";
import { clientId } from "./id";
import {
  ShoppingBag,
  Search,
  Plus,
  Minus,
  ArrowRight,
  LogOut,
  Package,
  Wrench,
  User,
  Leaf,
  X,
} from "lucide-react";
import { api, isBrowserDemo, type Session } from "./api";
import {
  Brand,
  Badge,
  Empty,
  Modal,
  Field,
  FormError,
  Loading,
  date,
} from "./components";
import {
  retail,
  money,
  categories,
  type Product,
  type Order,
  type Address,
  type ServiceRequest,
} from "../../../shared/types";
import AddressFields from "./AddressFields";
export default function Shop({ session }: { session: Session }) {
  const [page, setPage] = useState("shop"),
    [products, setProducts] = useState<Product[]>([]),
    [orders, setOrders] = useState<Order[]>([]),
    [services, setServices] = useState<ServiceRequest[]>([]),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("All"),
    [sort, setSort] = useState("featured"),
    [cart, setCart] = useState<Record<string, number>>(() =>
      JSON.parse(localStorage.getItem("cart-" + session.profile!.id) || "{}"),
    ),
    [modal, setModal] = useState<string | null>(null),
    [product, setProduct] = useState<Product | null>(null),
    [error, setError] = useState(""),
    [info, setInfo] = useState(""),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false);
  const profile = session.profile!,
    dealer = profile.role === "dealer" && profile.dealerStatus === "approved";
  const price = (p: Product) =>
    dealer ? p.wholesalePrice || p.price : p.price;
  async function refresh() {
    const [p, o, s] = await Promise.all([
      api("/products"),
      api("/orders"),
      api("/services"),
    ]);
    setProducts(p.products);
    setOrders(o.orders);
    setServices(s.services);
    setReady(true);
  }
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, []);
  useEffect(
    () => localStorage.setItem("cart-" + profile.id, JSON.stringify(cart)),
    [cart, profile.id],
  );
  function add(p: Product, delta?: number) {
    const d = delta ?? (dealer ? p.minDealerQty : 1);
    setCart((c) => ({
      ...c,
      [p.id]: Math.max(0, Math.min(p.stock, (c[p.id] || 0) + d)),
    }));
    setInfo("Cart updated");
  }
  const items = products.filter((p) => cart[p.id] > 0),
    total = items.reduce((s, p) => s + price(p) * cart[p.id], 0);
  const filtered = products
    .filter(
      (p) =>
        (category === "All" || p.category === category) &&
        (p.name + " " + p.description)
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "low"
        ? price(a) - price(b)
        : sort === "high"
          ? price(b) - price(a)
          : Number(b.featured) - Number(a.featured),
    );
  async function checkout(address: Address) {
    setBusy(true);
    setError("");
    try {
      const r = await api("/checkout", "POST", {
        items: items.map((p) => ({ productId: p.id, quantity: cart[p.id] })),
        address,
        idempotencyKey: clientId(),
      });
      if (r.demo) {
        await api("/demo/pay", "POST", { orderId: r.order.id });
        setInfo("Demo order recorded. No payment was charged.");
        setCart({});
        setModal(null);
        setPage("orders");
        await refresh();
      } else {
        if (!(window as any).Razorpay)
          await new Promise<void>((resolve, reject) => {
            const s = document.createElement("script");
            s.src = "https://checkout.razorpay.com/v1/checkout.js";
            s.onload = () => resolve();
            s.onerror = () =>
              reject(
                new Error(
                  "Checkout failed to load. Your unpaid order appears in order history.",
                ),
              );
            document.head.appendChild(s);
          });
        new (window as any).Razorpay({
          key: r.keyId,
          amount: r.order.amount,
          currency: "INR",
          name: "Califnco Water Care",
          order_id: r.order.razorpayOrderId,
          prefill: {
            name: profile.name,
            email: profile.email,
            contact: address.phone,
          },
          theme: { color: "#145c48" },
          handler: async (result: any) => {
            try {
              await api("/payments/verify", "POST", {
                orderId: r.order.id,
                razorpay_payment_id: result.razorpay_payment_id,
                razorpay_signature: result.razorpay_signature,
              });
              setCart({});
              setModal(null);
              setPage("orders");
              setInfo("Payment verified and order confirmed.");
              await refresh();
            } catch (e) {
              setError(
                (e as Error).message +
                  " Check your order history before trying again.",
              );
            }
          },
          modal: {
            ondismiss: () => {
              setInfo(
                "Checkout closed. Your unpaid order is in order history; cancel it to release stock.",
              );
              refresh().catch((e) => setError(e.message));
            },
          },
        }).open();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="shop">
      <header className="shop-header">
        <Brand />
        <nav>
          {[
            ["shop", "Shop"],
            ["orders", "My orders"],
            ["services", "Service"],
            ["profile", "Account"],
          ].map(([p, label]) => (
            <button
              key={p}
              className={page === p ? "active" : ""}
              onClick={() => setPage(p)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="row-actions">
          <button className="secondary" onClick={() => setModal("cart")}>
            <ShoppingBag size={17} />
            Cart ({Object.values(cart).reduce((s, n) => s + n, 0)})
          </button>
          <button
            className="icon-button"
            onClick={session.logout}
            aria-label="Sign out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <main className="shop-main">
        {profile.role === "dealer" && (
          <div className="demo-banner">
            Dealer account: <Badge value={profile.dealerStatus} />
            {dealer
              ? "Wholesale prices and bulk quantities are active."
              : "Your application must be approved before you can place orders."}
            <button
              className="text-link"
              onClick={async () => {
                await session.refresh();
                await refresh();
              }}
            >
              Refresh status
            </button>
          </div>
        )}
        <FormError error={error} />
        {info && (
          <div className="success">
            {info}
            <button
              className="icon-button"
              aria-label="Dismiss"
              onClick={() => setInfo("")}
            >
              <X size={14} />
            </button>
          </div>
        )}
        {!ready ? (
          <Loading />
        ) : (
          <>
            {page === "shop" && (
              <>
                <div className="shop-hero">
                  <div>
                    <div className="eyebrow">
                      <Leaf size={15} /> THOUGHTFUL WATER CARE
                    </div>
                    <h1>
                      Good water.
                      <br />A better everyday.
                    </h1>
                    <p>
                      Find the right essentials for your home or business.
                      <br />
                      From your first purifier to its next filter.
                    </p>
                    <span className="pill">
                      {products.length} catalogue products
                    </span>
                  </div>
                  <img
                    src={
                      products.find((p) => p.category === "Purifiers")?.image
                    }
                    alt="Water purifier"
                  />
                </div>
                <div className="toolbar">
                  <div className="search-field">
                    <Search size={18} />
                    <input
                      placeholder="Find your water care essentials…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                  <select
                    aria-label="Sort products"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="featured">Featured first</option>
                    <option value="low">Price: low to high</option>
                    <option value="high">Price: high to low</option>
                  </select>
                </div>
                <div className="category-tabs">
                  {["All", ...categories].map((c) => (
                    <button
                      className={c === category ? "active" : ""}
                      key={c}
                      onClick={() => setCategory(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div className="product-grid">
                  {filtered.map((p) => (
                    <article className="product-card" key={p.id}>
                      <button
                        className="product-image"
                        onClick={() => setProduct(p)}
                      >
                        <img src={p.image} alt={p.name} loading="lazy" />
                        <span className="category-chip">{p.category}</span>
                      </button>
                      <div className="product-body">
                        <h3>
                          <button
                            className="product-title"
                            onClick={() => setProduct(p)}
                          >
                            {p.name}
                          </button>
                        </h3>
                        <div className="product-prices">
                          <strong>{retail(price(p))}</strong>
                          <span>{dealer ? "Wholesale" : "Retail"} price</span>
                        </div>
                        <div className="product-footer">
                          <span className="stock">
                            <i />
                            {p.stock} available
                          </span>
                          <button
                            className="secondary"
                            disabled={!p.stock}
                            onClick={() => add(p)}
                          >
                            <Plus size={15} />
                            Add
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
                {!filtered.length && <Empty title="No matching products" />}
              </>
            )}
            {page === "orders" && (
              <>
                <div className="page-head">
                  <div>
                    <h1>Your orders</h1>
                    <p>Follow every step of your delivery.</p>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => refresh().catch((e) => setError(e.message))}
                  >
                    Refresh
                  </button>
                </div>
                {orders.length ? (
                  orders.map((o) => (
                    <section className="panel order-summary" key={o.id}>
                      <div className="detail-heading">
                        <div>
                          <strong>{o.id}</strong>
                          <small>{date(o.createdAt)}</small>
                        </div>
                        <Badge value={o.status} />
                        <strong>{money(o.amount)}</strong>
                      </div>
                      {o.items.map((i) => (
                        <div className="order-line" key={i.productId}>
                          <img src={i.image} alt="" />
                          <div>
                            {i.name}
                            <small>
                              {i.quantity} × {money(i.unitPrice)}
                            </small>
                          </div>
                        </div>
                      ))}
                      <div className="timeline">
                        {o.history.map((h, i) => (
                          <div key={i}>
                            <i />
                            <span>{h.status.replaceAll("_", " ")}</span>
                            <small>{date(h.at)}</small>
                          </div>
                        ))}
                      </div>
                      {o.status === "awaiting_payment" && (
                        <button
                          className="secondary"
                          onClick={async () => {
                            try {
                              await api(
                                "/orders/" + o.id + "/cancel",
                                "POST",
                                {},
                              );
                              await refresh();
                            } catch (e) {
                              setError((e as Error).message);
                            }
                          }}
                        >
                          Cancel unpaid order
                        </button>
                      )}
                    </section>
                  ))
                ) : (
                  <Empty
                    title="Your first order is waiting"
                    text="Explore the catalogue to find your essentials."
                  />
                )}
              </>
            )}
            {page === "services" && (
              <>
                <div className="page-head">
                  <div>
                    <h1>A little care goes a long way.</h1>
                    <p>Book an installation, repair, or filter replacement.</p>
                  </div>
                  <button
                    className="primary"
                    onClick={() => setModal("service")}
                  >
                    <Wrench size={17} />
                    Book a service
                  </button>
                </div>
                {services.length ? (
                  services.map((s) => (
                    <section className="panel order-summary" key={s.id}>
                      <Badge value={s.status} />
                      <h3>
                        {s.type} · {s.productName}
                      </h3>
                      <p>{s.description}</p>
                      <small>Preferred date: {s.preferredDate}</small>
                      {s.notes && <p>Service note: {s.notes}</p>}
                    </section>
                  ))
                ) : (
                  <Empty title="No service requests yet" />
                )}
              </>
            )}
            {page === "profile" && (
              <div className="panel profile-panel">
                <h1>Your account</h1>
                <p>
                  {profile.email} · <Badge value={profile.role} />
                </p>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setBusy(true);
                    const fd = new FormData(e.currentTarget);
                    try {
                      await api("/me", "PATCH", {
                        name: fd.get("name"),
                        phone: fd.get("phone"),
                        address: readAddress(fd),
                      });
                      await session.refresh();
                      setInfo("Profile saved");
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <Field label="Name">
                    <input name="name" defaultValue={profile.name} required />
                  </Field>
                  <Field label="Phone">
                    <input name="phone" defaultValue={profile.phone} required />
                  </Field>
                  <h3>Saved delivery address</h3>
                  <AddressFields value={profile.address} />
                  <button className="primary" disabled={busy}>
                    Save profile
                  </button>
                </form>
              </div>
            )}
          </>
        )}
      </main>
      {product && (
        <Modal title={product.name} onClose={() => setProduct(null)}>
          <img
            className="detail-product-image"
            src={product.image}
            alt={product.name}
          />
          <p>{product.description}</p>
          <dl className="specs">
            {Object.entries(product.specs).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <div className="total-row">
            <strong>{retail(price(product))}</strong>
            <button
              className="primary"
              disabled={!product.stock}
              onClick={() => add(product)}
            >
              Add to cart
              <Plus size={16} />
            </button>
          </div>
          {dealer && <p>Minimum dealer order: {product.minDealerQty} units.</p>}
        </Modal>
      )}
      {modal && (
        <Modal
          title={
            modal === "cart"
              ? "Your shopping bag"
              : modal === "checkout"
                ? "Delivery & checkout"
                : "Book a service"
          }
          onClose={() => setModal(null)}
        >
          {modal === "cart" && (
            <>
              {items.length ? (
                items.map((p) => (
                  <div className="order-line" key={p.id}>
                    <img src={p.image} alt="" />
                    <div>
                      {p.name}
                      <small>{retail(price(p))} each</small>
                      <div className="quantity">
                        <button
                          aria-label={"Remove one " + p.name}
                          onClick={() => add(p, -1)}
                        >
                          <Minus size={14} />
                        </button>
                        <span>{cart[p.id]}</span>
                        <button
                          aria-label={"Add one " + p.name}
                          onClick={() => add(p, 1)}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                    <strong>{retail(price(p) * cart[p.id])}</strong>
                  </div>
                ))
              ) : (
                <Empty title="Your bag is empty" />
              )}
              <div className="total-row">
                <strong>Total</strong>
                <strong>{retail(total)}</strong>
              </div>
              <button
                className="primary full"
                disabled={
                  !items.length || (profile.role === "dealer" && !dealer)
                }
                onClick={() => setModal("checkout")}
              >
                Continue to checkout
                <ArrowRight size={16} />
              </button>
            </>
          )}
          {modal === "checkout" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void checkout(readAddress(new FormData(e.currentTarget)));
              }}
            >
              <AddressFields value={profile.address} />
              <div className="total-row">
                <strong>Order total</strong>
                <strong>{retail(total)}</strong>
              </div>
              <p className="muted">
                {isBrowserDemo()
                  ? "Sample checkout only. No payment provider is called and no real order is placed."
                  : "Test-mode checkout. The server verifies the final price and stock."}
              </p>
              <button className="primary full" disabled={busy}>
                {busy
                  ? "Preparing checkout…"
                  : isBrowserDemo()
                    ? "Place sample order"
                    : "Pay with Razorpay (test)"}
              </button>
            </form>
          )}
          {modal === "service" && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                const fd = new FormData(e.currentTarget);
                try {
                  await api("/services", "POST", {
                    type: fd.get("type"),
                    productName: fd.get("productName"),
                    description: fd.get("description"),
                    preferredDate: fd.get("preferredDate"),
                    address: readAddress(fd),
                  });
                  setModal(null);
                  await refresh();
                  setInfo(
                    isBrowserDemo()
                      ? "Sample service request saved in this browser. No booking was sent."
                      : "Service request received. The team will confirm your slot.",
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Field label="Service type">
                <select name="type">
                  {[
                    "Installation",
                    "Filter replacement",
                    "Repair",
                    "Annual maintenance",
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Product">
                <input name="productName" required minLength={3} />
              </Field>
              <Field label="Tell us what you need">
                <textarea name="description" required minLength={10} />
              </Field>
              <Field label="Preferred date">
                <input
                  type="date"
                  name="preferredDate"
                  required
                  min={new Date().toISOString().slice(0, 10)}
                />
              </Field>
              <AddressFields value={profile.address} />
              <button className="primary full" disabled={busy}>
                Request service
              </button>
            </form>
          )}
          <FormError error={error} />
        </Modal>
      )}
    </div>
  );
}
function readAddress(fd: FormData): Address {
  const a: any = {};
  for (const key of ["name", "phone", "line1", "city", "state", "pincode"])
    a[key] = fd.get("address_" + key);
  for (const key of ["lat", "lng"])
    if (fd.get("address_" + key)) a[key] = Number(fd.get("address_" + key));
  return a;
}
