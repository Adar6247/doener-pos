"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Product = {
  id: number;
  name: string;
  price: number;
  category: string;
  created_at: string;
};

type Order = {
  id: number;
  table_number: number;
  waiter_id: string;
  status: "offen" | "fertig";
  created_at: string;
  finished_at: string | null;
};

type OrderItem = {
  id: number;
  order_id: number;
  product_name: string;
  quantity: number;
  paid_quantity: number;
  paid_at: string | null;
};

type CartItem = {
  product: Product;
  quantity: number;
};

type PaymentSelection = {
  itemId: number;
  quantity: number;
};

const TABLES = Array.from({ length: 25 }, (_, index) => index + 1);

const categoryNames = [
  "Alle",
  "Döner",
  "Dürüm",
  "Teller",
  "Pizza",
  "Burger",
  "Beilagen",
  "Getränke",
  "Sonstiges",
];

export default function DashboardPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedTable, setSelectedTable] = useState<number | null>(
    null
  );

  const [cart, setCart] = useState<CartItem[]>([]);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Alle");

  const [showAddOrder, setShowAddOrder] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  const [paymentSelection, setPaymentSelection] = useState<
    PaymentSelection[]
  >([]);

  const [paymentMethod, setPaymentMethod] = useState<"bar" | "karte">(
    "bar"
  );

  const [cashGiven, setCashGiven] = useState("");

  const [currentUserId, setCurrentUserId] = useState<string | null>(
    null
  );

  const [currentUserName, setCurrentUserName] =
    useState("Kellner");

  const [message, setMessage] = useState("");

  // ==================================================
  // DATEN LADEN
  // ==================================================

  async function loadData() {
    setLoading(true);

    const [
      productsResult,
      ordersResult,
      orderItemsResult,
      userResult,
    ] = await Promise.all([
      supabase
        .from("products")
        .select("*")
        .order("category")
        .order("name"),

      supabase
        .from("orders")
        .select("*")
        .order("created_at", {
          ascending: true,
        }),

      supabase
        .from("order_items")
        .select("*")
        .order("id", {
          ascending: true,
        }),

      supabase.auth.getUser(),
    ]);

    if (productsResult.error) {
      console.error(productsResult.error);
    }

    if (ordersResult.error) {
      console.error(ordersResult.error);
    }

    if (orderItemsResult.error) {
      console.error(orderItemsResult.error);
    }

    setProducts(productsResult.data ?? []);
    setOrders(ordersResult.data ?? []);
    setOrderItems(orderItemsResult.data ?? []);

    const user = userResult.data.user;

    if (user) {
      setCurrentUserId(user.id);

      const profileResult = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .maybeSingle();

      if (profileResult.data?.name) {
        setCurrentUserName(profileResult.data.name);
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();

    const ordersChannel = supabase
      .channel("waiter-orders")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    const itemsChannel = supabase
      .channel("waiter-order-items")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "order_items",
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(itemsChannel);
    };
  }, []);

  // ==================================================
  // PRODUKTE
  // ==================================================

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch = product.name
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesCategory =
        category === "Alle" ||
        product.category.toLowerCase() ===
          category.toLowerCase();

      return matchesSearch && matchesCategory;
    });
  }, [products, search, category]);

  // ==================================================
  // TISCHDATEN
  // ==================================================

  function getTableOrders(tableNumber: number) {
    return orders.filter(
      (order) => order.table_number === tableNumber
    );
  }

  function getTableItems(tableNumber: number) {
    const orderIds = getTableOrders(tableNumber).map(
      (order) => order.id
    );

    return orderItems.filter((item) =>
      orderIds.includes(item.order_id)
    );
  }

  function getTableStatus(tableNumber: number) {
    const tableOrders = getTableOrders(tableNumber);
    const tableItems = getTableItems(tableNumber);

    const hasOpenOrder = tableOrders.some(
      (order) => order.status === "offen"
    );

    if (hasOpenOrder) {
      return "offen";
    }

    const hasUnpaidItems = tableItems.some(
      (item) => item.paid_quantity < item.quantity
    );

    if (hasUnpaidItems) {
      return "fertig";
    }

    return "frei";
  }

  const freeTables = TABLES.filter(
    (table) => getTableStatus(table) === "frei"
  ).length;

  const openTables = TABLES.filter(
    (table) => getTableStatus(table) === "offen"
  ).length;

  const readyTables = TABLES.filter(
    (table) => getTableStatus(table) === "fertig"
  ).length;

  // ==================================================
  // TISCH ÖFFNEN
  // ==================================================

  function openTable(tableNumber: number) {
    setSelectedTable(tableNumber);
    setCart([]);
    setSearch("");
    setCategory("Alle");
    setShowAddOrder(false);
    setShowPayment(false);
    setPaymentSelection([]);
    setCashGiven("");
    setMessage("");
  }

  function closeTable() {
    setSelectedTable(null);
    setCart([]);
    setShowAddOrder(false);
    setShowPayment(false);
    setPaymentSelection([]);
    setCashGiven("");
    setMessage("");
  }

  // ==================================================
  // WARENKORB
  // ==================================================

  function addToCart(product: Product) {
    setCart((current) => {
      const existing = current.find(
        (item) => item.product.id === product.id
      );

      if (existing) {
        return current.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item
        );
      }

      return [
        ...current,
        {
          product,
          quantity: 1,
        },
      ];
    });
  }

  function increaseCartItem(productId: number) {
    setCart((current) =>
      current.map((item) =>
        item.product.id === productId
          ? {
              ...item,
              quantity: item.quantity + 1,
            }
          : item
      )
    );
  }

  function decreaseCartItem(productId: number) {
    setCart((current) =>
      current
        .map((item) =>
          item.product.id === productId
            ? {
                ...item,
                quantity: item.quantity - 1,
              }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  // ==================================================
  // BESTELLUNG SPEICHERN
  // ==================================================

  async function submitOrder() {
    if (!selectedTable || cart.length === 0) {
      return;
    }

    if (!currentUserId) {
      setMessage("Kein Benutzer angemeldet.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const openOrder = orders.find(
        (order) =>
          order.table_number === selectedTable &&
          order.status === "offen"
      );

      let orderId: number;

      if (openOrder) {
        orderId = openOrder.id;
      } else {
        const { data, error } = await supabase
          .from("orders")
          .insert({
            table_number: selectedTable,
            waiter_id: currentUserId,
            status: "offen",
          })
          .select("id")
          .single();

        if (error || !data) {
          console.error(error);
          throw new Error(
            "Bestellung konnte nicht erstellt werden."
          );
        }

        orderId = data.id;
      }

      const itemsToInsert = cart.map((item) => ({
        order_id: orderId,
        product_name: item.product.name,
        quantity: item.quantity,
        paid_quantity: 0,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(itemsToInsert);

      if (itemsError) {
        console.error(itemsError);
        throw new Error(
          "Produkte konnten nicht gespeichert werden."
        );
      }

      setCart([]);
      setShowAddOrder(false);
      setMessage("Bestellung wurde gespeichert.");

      await loadData();
    } catch (error) {
      console.error(error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Es ist ein Fehler aufgetreten."
      );
    } finally {
      setSaving(false);
    }
  }

  // ==================================================
  // BESTELLUNG FERTIG
  // ==================================================

  async function finishOrder() {
    if (!selectedTable) {
      return;
    }

    const openOrder = orders.find(
      (order) =>
        order.table_number === selectedTable &&
        order.status === "offen"
    );

    if (!openOrder) {
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("orders")
      .update({
        status: "fertig",
        finished_at: new Date().toISOString(),
      })
      .eq("id", openOrder.id);

    if (error) {
      console.error(error);
      setMessage(
        "Bestellung konnte nicht fertiggestellt werden."
      );
    } else {
      setMessage("Tisch ist jetzt bezahlbereit.");
      await loadData();
    }

    setSaving(false);
  }

  // ==================================================
  // ZAHLUNG
  // ==================================================

  function getPaymentItemsForTable(tableNumber: number) {
    const tableOrderIds = getTableOrders(tableNumber).map(
      (order) => order.id
    );

    /*
      WICHTIG:
      Hier werden vollständig bezahlte Artikel NICHT mehr
      angezeigt.

      Wenn z.B. 2 Döner vorhanden sind und 1 bezahlt wurde,
      wird weiterhin nur 1 Döner angezeigt.
    */

    return orderItems
      .filter(
        (item) =>
          tableOrderIds.includes(item.order_id) &&
          item.paid_quantity < item.quantity
      )
      .map((item) => ({
        ...item,
        quantity:
          item.quantity - item.paid_quantity,
        paid_quantity: 0,
      }));
  }

  function getProductPrice(productName: string) {
    const product = products.find(
      (item) => item.name === productName
    );

    return product?.price ?? 0;
  }

  const paymentItems =
    selectedTable !== null
      ? getPaymentItemsForTable(selectedTable)
      : [];

  const selectedPaymentItems = paymentItems.filter(
    (item) =>
      paymentSelection.some(
        (selection) =>
          selection.itemId === item.id &&
          selection.quantity > 0
      )
  );

  const paymentTotal = selectedPaymentItems.reduce(
    (total, item) => {
      const selection = paymentSelection.find(
        (entry) => entry.itemId === item.id
      );

      const quantity = selection?.quantity ?? 0;

      return (
        total +
        quantity * getProductPrice(item.product_name)
      );
    },
    0
  );

  const cashValue =
    Number.parseFloat(
      cashGiven.replace(",", ".")
    ) || 0;

  const change =
    paymentMethod === "bar"
      ? Math.max(0, cashValue - paymentTotal)
      : 0;

  function startPayment() {
    setShowPayment(true);
    setShowAddOrder(false);
    setPaymentSelection([]);
    setCashGiven("");
    setMessage("");
  }

  function cancelPayment() {
    setShowPayment(false);
    setPaymentSelection([]);
    setCashGiven("");
  }

  function togglePaymentItem(item: OrderItem) {
    const remaining =
      item.quantity - item.paid_quantity;

    const existing = paymentSelection.find(
      (selection) => selection.itemId === item.id
    );

    if (existing) {
      setPaymentSelection((current) =>
        current.filter(
          (selection) =>
            selection.itemId !== item.id
        )
      );

      return;
    }

    setPaymentSelection((current) => [
      ...current,
      {
        itemId: item.id,
        quantity: remaining,
      },
    ]);
  }

  function increasePaymentItem(item: OrderItem) {
    const remaining =
      item.quantity - item.paid_quantity;

    setPaymentSelection((current) =>
      current.map((selection) =>
        selection.itemId === item.id
          ? {
              ...selection,
              quantity: Math.min(
                selection.quantity + 1,
                remaining
              ),
            }
          : selection
      )
    );
  }

  function decreasePaymentItem(item: OrderItem) {
    setPaymentSelection((current) =>
      current
        .map((selection) =>
          selection.itemId === item.id
            ? {
                ...selection,
                quantity: selection.quantity - 1,
              }
            : selection
        )
        .filter(
          (selection) => selection.quantity > 0
        )
    );
  }

  function getSelectedPaymentQuantity(itemId: number) {
    return (
      paymentSelection.find(
        (selection) =>
          selection.itemId === itemId
      )?.quantity ?? 0
    );
  }

  async function completePayment() {
    if (!selectedTable) {
      return;
    }

    if (paymentSelection.length === 0) {
      setMessage(
        "Bitte mindestens einen Artikel auswählen."
      );
      return;
    }

    if (
      paymentMethod === "bar" &&
      cashValue < paymentTotal
    ) {
      setMessage(
        "Der gegebene Betrag ist zu niedrig."
      );
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      for (const selection of paymentSelection) {
        const item = orderItems.find(
          (orderItem) =>
            orderItem.id === selection.itemId
        );

        if (!item) {
          continue;
        }

        const newPaidQuantity =
          item.paid_quantity +
          selection.quantity;

        const { error } = await supabase
          .from("order_items")
          .update({
            paid_quantity: newPaidQuantity,
            paid_at:
              newPaidQuantity >= item.quantity
                ? new Date().toISOString()
                : item.paid_at,
          })
          .eq("id", item.id);

        if (error) {
          console.error(error);

          throw new Error(
            "Zahlung konnte nicht gespeichert werden."
          );
        }
      }

      /*
        WICHTIG:
        Zahlungsauswahl komplett zurücksetzen.
        Danach werden die Daten neu geladen.

        Dadurch verschwinden vollständig bezahlte
        Produkte direkt aus der Zahlungsansicht.
      */

      setPaymentSelection([]);
      setCashGiven("");

      await loadData();

      setMessage(
        paymentMethod === "bar"
          ? `Zahlung gespeichert. Rückgeld: ${change
              .toFixed(2)
              .replace(".", ",")} €`
          : "Kartenzahlung gespeichert."
      );

      /*
        Nur wenn noch unbezahlte Artikel vorhanden sind,
        bleiben wir in der Zahlungsansicht.

        Wenn alles bezahlt ist, gehen wir automatisch
        zurück zur Tischansicht.
      */

      const remainingItems =
        getPaymentItemsForTable(
          selectedTable
        );

      if (remainingItems.length === 0) {
        setShowPayment(false);
      }
    } catch (error) {
      console.error(error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Zahlung konnte nicht gespeichert werden."
      );
    } finally {
      setSaving(false);
    }
  }

  // ==================================================
  // AUSGEWÄHLTER TISCH
  // ==================================================

  const selectedTableOrders =
    selectedTable !== null
      ? getTableOrders(selectedTable)
      : [];

  const selectedTableItems =
    selectedTable !== null
      ? getTableItems(selectedTable)
      : [];

  const selectedOpenOrder =
    selectedTableOrders.find(
      (order) => order.status === "offen"
    );

  const selectedStatus =
    selectedTable !== null
      ? getTableStatus(selectedTable)
      : "frei";

  const cartTotal = cart.reduce(
    (total, item) =>
      total +
      item.product.price * item.quantity,
    0
  );

  // ==================================================
  // LOADING
  // ==================================================

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="bg-white rounded-3xl shadow-xl px-8 py-6 text-slate-700">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 rounded-full border-2 border-slate-300 border-t-slate-800 animate-spin" />

            <span className="font-semibold">
              POS wird geladen...
            </span>
          </div>
        </div>
      </main>
    );
  }

  // ==================================================
  // TISCHANSICHT
  // ==================================================

  if (selectedTable !== null) {
    return (
      <main className="min-h-screen bg-slate-100 text-slate-900">
        {/* HEADER */}

        <header className="bg-slate-900 text-white shadow-lg">
          <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={closeTable}
                className="h-11 w-11 rounded-xl bg-white/10 hover:bg-white/20 transition flex items-center justify-center text-xl"
              >
                ←
              </button>

              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider">
                  Tisch
                </p>

                <h1 className="text-2xl font-bold">
                  Tisch {selectedTable}
                </h1>
              </div>

              <span
                className={`ml-2 px-3 py-1.5 rounded-full text-xs font-bold ${
                  selectedStatus === "offen"
                    ? "bg-orange-500/20 text-orange-300"
                    : selectedStatus === "fertig"
                    ? "bg-blue-500/20 text-blue-300"
                    : "bg-emerald-500/20 text-emerald-300"
                }`}
              >
                {selectedStatus === "offen"
                  ? "BESTELLUNG OFFEN"
                  : selectedStatus === "fertig"
                  ? "BEZAHLBEREIT"
                  : "FREI"}
              </span>
            </div>

            <div className="text-right">
              <p className="text-xs text-slate-400">
                Angemeldet als
              </p>

              <p className="font-semibold">
                {currentUserName}
              </p>
            </div>
          </div>
        </header>

        {/* MESSAGE */}

        {message && (
          <div className="max-w-[1600px] mx-auto px-6 pt-5">
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl px-5 py-4 flex items-center justify-between">
              <span className="font-medium text-slate-700">
                {message}
              </span>

              <button
                onClick={() => setMessage("")}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* ==================================================
            ZAHLUNG
        ================================================== */}

        {showPayment ? (
          <div className="max-w-[1200px] mx-auto px-6 py-8">
            <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
              <div className="px-7 py-6 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">
                    Tisch {selectedTable}
                  </p>

                  <h2 className="text-2xl font-bold mt-1">
                    Zahlung
                  </h2>

                  <p className="text-sm text-slate-500 mt-1">
                    Wähle die Produkte aus, die jetzt
                    bezahlt werden.
                  </p>
                </div>

                <button
                  onClick={cancelPayment}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 font-semibold transition"
                >
                  Zurück
                </button>
              </div>

              <div className="p-7">
                {paymentItems.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-3xl">
                      ✓
                    </div>

                    <h3 className="text-xl font-bold mt-5">
                      Alles bezahlt
                    </h3>

                    <p className="text-slate-500 mt-2">
                      Für diesen Tisch sind keine
                      offenen Artikel mehr vorhanden.
                    </p>

                    <button
                      onClick={cancelPayment}
                      className="mt-6 px-6 py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition"
                    >
                      Zur Tischübersicht
                    </button>
                  </div>
                ) : (
                  <div className="grid lg:grid-cols-[1fr_360px] gap-7">
                    {/* ARTIKEL */}

                    <div className="space-y-3">
                      {paymentItems.map((item) => {
                        const selectedQuantity =
                          getSelectedPaymentQuantity(
                            item.id
                          );

                        const remaining =
                          item.quantity;

                        const isSelected =
                          selectedQuantity > 0;

                        const price =
                          getProductPrice(
                            item.product_name
                          );

                        return (
                          <div
                            key={item.id}
                            className={`rounded-2xl border-2 p-4 transition ${
                              isSelected
                                ? "border-slate-900 bg-slate-50"
                                : "border-slate-200 bg-white hover:border-slate-300"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-4">
                              <button
                                onClick={() =>
                                  togglePaymentItem(
                                    item
                                  )
                                }
                                className="flex-1 text-left"
                              >
                                <div className="font-bold text-lg">
                                  {item.product_name}
                                </div>

                                <div className="text-sm text-slate-500 mt-1">
                                  {remaining} Stück offen ·{" "}
                                  {price
                                    .toFixed(2)
                                    .replace(".", ",")}{" "}
                                  € / Stück
                                </div>
                              </button>

                              {isSelected && (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() =>
                                      decreasePaymentItem(
                                        item
                                      )
                                    }
                                    className="h-9 w-9 rounded-lg bg-slate-200 hover:bg-slate-300 font-bold"
                                  >
                                    −
                                  </button>

                                  <div className="w-8 text-center font-bold">
                                    {selectedQuantity}
                                  </div>

                                  <button
                                    onClick={() =>
                                      increasePaymentItem(
                                        item
                                      )
                                    }
                                    className="h-9 w-9 rounded-lg bg-slate-900 text-white hover:bg-slate-800 font-bold"
                                  >
                                    +
                                  </button>
                                </div>
                              )}
                            </div>

                            {isSelected && (
                              <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between text-sm">
                                <span className="text-slate-500">
                                  Ausgewählt
                                </span>

                                <span className="font-bold">
                                  {(
                                    selectedQuantity *
                                    price
                                  )
                                    .toFixed(2)
                                    .replace(
                                      ".",
                                      ","
                                    )}{" "}
                                  €
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* ZAHLUNGSBOX */}

                    <div className="bg-slate-900 text-white rounded-3xl p-6 h-fit">
                      <h3 className="text-lg font-bold mb-5">
                        Zahlung abschließen
                      </h3>

                      <div className="grid grid-cols-2 gap-3 mb-6">
                        <button
                          onClick={() =>
                            setPaymentMethod("bar")
                          }
                          className={`rounded-xl p-4 font-bold transition ${
                            paymentMethod === "bar"
                              ? "bg-white text-slate-900"
                              : "bg-white/10 hover:bg-white/20"
                          }`}
                        >
                          💶 Bar
                        </button>

                        <button
                          onClick={() =>
                            setPaymentMethod("karte")
                          }
                          className={`rounded-xl p-4 font-bold transition ${
                            paymentMethod === "karte"
                              ? "bg-white text-slate-900"
                              : "bg-white/10 hover:bg-white/20"
                          }`}
                        >
                          💳 Karte
                        </button>
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between text-slate-300">
                          <span>Ausgewählt</span>

                          <span>
                            {selectedPaymentItems.length}{" "}
                            Positionen
                          </span>
                        </div>

                        <div className="flex justify-between items-end border-t border-white/10 pt-4">
                          <span className="text-slate-300">
                            Gesamt
                          </span>

                          <span className="text-3xl font-black">
                            {paymentTotal
                              .toFixed(2)
                              .replace(".", ",")}{" "}
                            €
                          </span>
                        </div>

                        {paymentMethod === "bar" && (
                          <>
                            <div>
                              <label className="block text-sm text-slate-300 mb-2">
                                Gegeben
                              </label>

                              <input
                                type="text"
                                inputMode="decimal"
                                value={cashGiven}
                                onChange={(event) =>
                                  setCashGiven(
                                    event.target.value
                                  )
                                }
                                placeholder="0,00 €"
                                className="w-full bg-white text-slate-900 rounded-xl px-4 py-3 text-lg font-bold outline-none focus:ring-2 focus:ring-slate-400"
                              />
                            </div>

                            <div className="rounded-xl bg-white/10 p-4 flex justify-between">
                              <span className="text-slate-300">
                                Rückgeld
                              </span>

                              <span className="font-bold text-xl">
                                {change
                                  .toFixed(2)
                                  .replace(
                                    ".",
                                    ","
                                  )}{" "}
                                €
                              </span>
                            </div>
                          </>
                        )}

                        <button
                          onClick={completePayment}
                          disabled={
                            saving ||
                            paymentSelection.length ===
                              0 ||
                            (paymentMethod ===
                              "bar" &&
                              cashValue <
                                paymentTotal)
                          }
                          className="w-full mt-2 py-4 rounded-xl bg-white text-slate-900 font-black text-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                        >
                          {saving
                            ? "Wird gespeichert..."
                            : paymentMethod === "bar"
                            ? "Barzahlung bestätigen"
                            : "Kartenzahlung bestätigen"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* ==================================================
                TISCHINHALT
            ================================================== */}

            <div className="max-w-[1600px] mx-auto px-6 py-6">
              <div className="grid xl:grid-cols-[1fr_400px] gap-6">
                <div>
                  {/* AKTIONEN */}

                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-6 flex flex-wrap gap-3">
                    <button
                      onClick={() => {
                        setShowAddOrder(true);
                        setShowPayment(false);
                      }}
                      className="px-5 py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition"
                    >
                      ＋ Weitere Bestellung
                    </button>

                    {selectedStatus === "fertig" &&
                      paymentItems.length > 0 && (
                        <button
                          onClick={startPayment}
                          className="px-5 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition"
                        >
                          💳 Zur Bezahlung
                        </button>
                      )}

                    {selectedStatus === "offen" && (
                      <button
                        onClick={finishOrder}
                        disabled={saving}
                        className="px-5 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50 transition"
                      >
                        ✓ Bestellung fertig
                      </button>
                    )}
                  </div>

                  {/* BESTELLÜBERSICHT */}

                  <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-slate-200">
                      <h2 className="text-xl font-bold">
                        Aktuelle Artikel
                      </h2>

                      <p className="text-sm text-slate-500 mt-1">
                        Alle Bestellungen dieses Tisches
                      </p>
                    </div>

                    <div className="p-6">
                      {selectedTableItems.length ===
                      0 ? (
                        <div className="text-center py-12 text-slate-400">
                          Noch keine Artikel bestellt.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {selectedTableItems.map(
                            (item) => {
                              const price =
                                getProductPrice(
                                  item.product_name
                                );

                              const unpaid =
                                item.quantity -
                                item.paid_quantity;

                              return (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between rounded-2xl bg-slate-50 border border-slate-200 px-5 py-4"
                                >
                                  <div>
                                    <div className="font-bold">
                                      {
                                        item.product_name
                                      }
                                    </div>

                                    <div className="text-sm text-slate-500 mt-1">
                                      {item.quantity} ×{" "}
                                      {price
                                        .toFixed(2)
                                        .replace(
                                          ".",
                                          ","
                                        )}{" "}
                                      €
                                    </div>
                                  </div>

                                  <div className="text-right">
                                    {item.paid_quantity >
                                      0 && (
                                      <div className="text-xs font-bold text-emerald-600 mb-1">
                                        {
                                          item.paid_quantity
                                        }{" "}
                                        bezahlt
                                      </div>
                                    )}

                                    {unpaid > 0 ? (
                                      <div className="font-bold">
                                        {unpaid} offen
                                      </div>
                                    ) : (
                                      <div className="font-bold text-emerald-600">
                                        Bezahlt ✓
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            }
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* PRODUKTE */}

                  {showAddOrder && (
                    <div className="mt-6 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="px-6 py-5 border-b border-slate-200">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <h2 className="text-xl font-bold">
                              Weitere Artikel
                            </h2>

                            <p className="text-sm text-slate-500 mt-1">
                              Produkte zur Bestellung
                              hinzufügen
                            </p>
                          </div>

                          <button
                            onClick={() =>
                              setShowAddOrder(false)
                            }
                            className="h-10 w-10 rounded-xl bg-slate-100 hover:bg-slate-200"
                          >
                            ✕
                          </button>
                        </div>

                        <div className="mt-5">
                          <input
                            value={search}
                            onChange={(event) =>
                              setSearch(
                                event.target.value
                              )
                            }
                            placeholder="Produkt suchen..."
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:ring-2 focus:ring-slate-900"
                          />
                        </div>

                        <div className="flex gap-2 overflow-x-auto mt-4 pb-1">
                          {categoryNames.map(
                            (categoryName) => (
                              <button
                                key={categoryName}
                                onClick={() =>
                                  setCategory(
                                    categoryName
                                  )
                                }
                                className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-bold transition ${
                                  category ===
                                  categoryName
                                    ? "bg-slate-900 text-white"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                }`}
                              >
                                {categoryName}
                              </button>
                            )
                          )}
                        </div>
                      </div>

                      <div className="p-6">
                        {filteredProducts.length ===
                        0 ? (
                          <div className="text-center py-12 text-slate-400">
                            Keine Produkte gefunden.
                          </div>
                        ) : (
                          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredProducts.map(
                              (product) => (
                                <button
                                  key={product.id}
                                  onClick={() =>
                                    addToCart(
                                      product
                                    )
                                  }
                                  className="text-left rounded-2xl border border-slate-200 bg-white p-5 hover:border-slate-900 hover:shadow-md transition"
                                >
                                  <div className="font-bold text-lg">
                                    {product.name}
                                  </div>

                                  <div className="text-sm text-slate-400 mt-1">
                                    {
                                      product.category
                                    }
                                  </div>

                                  <div className="mt-4 font-black text-lg">
                                    {product.price
                                      .toFixed(2)
                                      .replace(
                                        ".",
                                        ","
                                      )}{" "}
                                    €
                                  </div>
                                </button>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* ==================================================
                    RECHTE BESTELLBOX
                ================================================== */}

                <aside className="xl:sticky xl:top-6 h-fit">
                  <div className="bg-slate-900 text-white rounded-3xl shadow-xl overflow-hidden">
                    <div className="p-6 border-b border-white/10">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-xs text-slate-400 uppercase tracking-wider">
                            Tisch
                          </p>

                          <h2 className="text-2xl font-black">
                            {selectedTable}
                          </h2>
                        </div>

                        <div className="text-right">
                          <p className="text-xs text-slate-400">
                            Neue Bestellung
                          </p>

                          <p className="font-bold">
                            {cart.length} Positionen
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-6">
                      {cart.length === 0 ? (
                        <div className="text-center py-10 text-slate-500">
                          <div className="text-4xl mb-3">
                            🛒
                          </div>

                          <p>
                            Noch keine neuen Artikel
                          </p>

                          <p className="text-sm mt-1">
                            Wähle links Produkte aus.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {cart.map((item) => (
                            <div
                              key={item.product.id}
                              className="rounded-2xl bg-white/5 p-4"
                            >
                              <div className="flex justify-between gap-3">
                                <div className="font-bold">
                                  {
                                    item.product.name
                                  }
                                </div>

                                <div className="font-bold">
                                  {(
                                    item.product
                                      .price *
                                    item.quantity
                                  )
                                    .toFixed(2)
                                    .replace(
                                      ".",
                                      ","
                                    )}{" "}
                                  €
                                </div>
                              </div>

                              <div className="flex items-center justify-between mt-3">
                                <div className="text-sm text-slate-400">
                                  {item.product.price
                                    .toFixed(2)
                                    .replace(
                                      ".",
                                      ","
                                    )}{" "}
                                  € / Stück
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() =>
                                      decreaseCartItem(
                                        item.product.id
                                      )
                                    }
                                    className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 font-bold"
                                  >
                                    −
                                  </button>

                                  <span className="w-6 text-center font-bold">
                                    {
                                      item.quantity
                                    }
                                  </span>

                                  <button
                                    onClick={() =>
                                      increaseCartItem(
                                        item.product.id
                                      )
                                    }
                                    className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 font-bold"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {cart.length > 0 && (
                        <>
                          <div className="border-t border-white/10 mt-6 pt-5 flex justify-between items-end">
                            <span className="text-slate-400">
                              Neue Bestellung
                            </span>

                            <span className="text-3xl font-black">
                              {cartTotal
                                .toFixed(2)
                                .replace(
                                  ".",
                                  ","
                                )}{" "}
                              €
                            </span>
                          </div>

                          <button
                            onClick={submitOrder}
                            disabled={saving}
                            className="w-full mt-5 py-4 rounded-xl bg-white text-slate-900 font-black text-lg hover:bg-slate-100 disabled:opacity-50 transition"
                          >
                            {saving
                              ? "Wird gespeichert..."
                              : "Bestellung speichern"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {selectedOpenOrder && (
                    <div className="mt-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                      <div className="text-xs text-slate-400 uppercase font-bold">
                        Aktive Bestellung
                      </div>

                      <div className="mt-1 font-bold">
                        Bestellung #
                        {selectedOpenOrder.id}
                      </div>

                      <div className="text-sm text-slate-500 mt-1">
                        Noch nicht fertiggestellt
                      </div>
                    </div>
                  )}
                </aside>
              </div>
            </div>
          </>
        )}
      </main>
    );
  }

  // ==================================================
  // TISCHPLAN
  // ==================================================

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="bg-slate-900 text-white shadow-xl">
        <div className="max-w-[1600px] mx-auto px-6 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div>
              <p className="text-sm text-slate-400">
                Döner POS
              </p>

              <h1 className="text-3xl font-black mt-1">
                Tischübersicht
              </h1>

              <p className="text-slate-400 mt-1">
                Willkommen, {currentUserName}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-white/10 px-5 py-4 min-w-[110px]">
                <div className="text-2xl font-black">
                  {freeTables}
                </div>

                <div className="text-xs text-emerald-300 font-bold mt-1">
                  FREI
                </div>
              </div>

              <div className="rounded-2xl bg-white/10 px-5 py-4 min-w-[110px]">
                <div className="text-2xl font-black">
                  {openTables}
                </div>

                <div className="text-xs text-orange-300 font-bold mt-1">
                  OFFEN
                </div>
              </div>

              <div className="rounded-2xl bg-white/10 px-5 py-4 min-w-[110px]">
                <div className="text-2xl font-black">
                  {readyTables}
                </div>

                <div className="text-xs text-blue-300 font-bold mt-1">
                  BEZAHLBEREIT
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-6 py-8">
        <div className="flex flex-wrap items-center gap-5 mb-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <span className="h-3 w-3 rounded-full bg-emerald-500" />
            Frei
          </div>

          <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <span className="h-3 w-3 rounded-full bg-orange-500" />
            Bestellung offen
          </div>

          <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <span className="h-3 w-3 rounded-full bg-blue-500" />
            Bezahlbereit
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-5">
          {TABLES.map((tableNumber) => {
            const status =
              getTableStatus(tableNumber);

            const tableItems =
              getTableItems(tableNumber);

            const unpaidItems =
              tableItems.reduce(
                (total, item) =>
                  total +
                  Math.max(
                    0,
                    item.quantity -
                      item.paid_quantity
                  ),
                0
              );

            return (
              <button
                key={tableNumber}
                onClick={() =>
                  openTable(tableNumber)
                }
                className={`relative text-left rounded-3xl border-2 p-6 min-h-[170px] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all ${
                  status === "frei"
                    ? "bg-white border-emerald-200 hover:border-emerald-400"
                    : status === "offen"
                    ? "bg-orange-50 border-orange-300 hover:border-orange-500"
                    : "bg-blue-50 border-blue-300 hover:border-blue-500"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-wider font-bold text-slate-400">
                      Tisch
                    </div>

                    <div className="text-4xl font-black mt-1">
                      {tableNumber}
                    </div>
                  </div>

                  <span
                    className={`h-4 w-4 rounded-full ${
                      status === "frei"
                        ? "bg-emerald-500"
                        : status === "offen"
                        ? "bg-orange-500"
                        : "bg-blue-500"
                    }`}
                  />
                </div>

                <div className="absolute bottom-6 left-6 right-6">
                  <div
                    className={`text-xs font-black tracking-wide ${
                      status === "frei"
                        ? "text-emerald-600"
                        : status === "offen"
                        ? "text-orange-600"
                        : "text-blue-600"
                    }`}
                  >
                    {status === "frei"
                      ? "FREI"
                      : status === "offen"
                      ? "BESTELLUNG OFFEN"
                      : "BEZAHLBEREIT"}
                  </div>

                  {status === "fertig" &&
                    unpaidItems > 0 && (
                      <div className="text-xs text-slate-500 mt-1">
                        {unpaidItems} Artikel offen
                      </div>
                    )}

                  {status === "offen" && (
                    <div className="text-xs text-slate-500 mt-1">
                      Bestellung läuft
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}