"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useTheme } from "../components/ThemeProvider";

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

type TableStatus = "frei" | "offen" | "fertig";

const TABLE_COUNT = 25;

const categoryNames: Record<string, string> = {
  alle: "Alle",
  doener: "Döner",
  duerum: "Dürüm",
  pizza: "Pizza",
  burger: "Burger",
  pommes: "Pommes",
  getraenke: "Getränke",
  sonstiges: "Sonstiges",
};

function formatPrice(price: number): string {
  return `${price.toFixed(2).replace(".", ",")} €`;
}

function getTableStatus(
  tableNumber: number,
  orders: Order[],
  orderItems: OrderItem[]
): TableStatus {
  const tableOrders = orders.filter(
    (order) => order.table_number === tableNumber
  );

  if (tableOrders.length === 0) {
    return "frei";
  }

  const hasOpenOrder = tableOrders.some(
    (order) => order.status === "offen"
  );

  if (hasOpenOrder) {
    return "offen";
  }

  const orderIds = tableOrders.map(
    (order) => order.id
  );

  const hasUnpaidItems = orderItems.some(
    (item) =>
      orderIds.includes(item.order_id) &&
      item.paid_quantity < item.quantity
  );

  if (hasUnpaidItems) {
    return "fertig";
  }

  return "frei";
}

export default function DashboardPage() {
  const { theme, setTheme } = useTheme();

  const dark = theme === "dark";

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  const [selectedTable, setSelectedTable] = useState<number | null>(
    null
  );

  const [cart, setCart] = useState<CartItem[]>([]);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("alle");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showAddOrder, setShowAddOrder] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState<
    "bar" | "karte"
  >("bar");

  const [cashReceived, setCashReceived] = useState("");

  const [paymentSelection, setPaymentSelection] = useState<
    PaymentSelection[]
  >([]);

  const [currentUserName, setCurrentUserName] = useState("");

  async function loadData() {
    const [
      productsResult,
      ordersResult,
      orderItemsResult,
    ] = await Promise.all([
      supabase
        .from("products")
        .select("*")
        .order("category", { ascending: true })
        .order("name", { ascending: true }),

      supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: true }),

      supabase
        .from("order_items")
        .select("*")
        .order("id", { ascending: true }),
    ]);

    if (productsResult.error) {
      console.error(
        "Fehler beim Laden der Produkte:",
        productsResult.error
      );
    }

    if (ordersResult.error) {
      console.error(
        "Fehler beim Laden der Bestellungen:",
        ordersResult.error
      );
    }

    if (orderItemsResult.error) {
      console.error(
        "Fehler beim Laden der Bestellartikel:",
        orderItemsResult.error
      );
    }

    if (productsResult.data) {
      setProducts(productsResult.data as Product[]);
    }

    if (ordersResult.data) {
      setOrders(ordersResult.data as Order[]);
    }

    if (orderItemsResult.data) {
      setOrderItems(
        orderItemsResult.data as OrderItem[]
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (user) {
        const { data: profile, error } =
          await supabase
            .from("profiles")
            .select("name")
            .eq("id", user.id)
            .maybeSingle();

        if (error) {
          console.error(
            "Fehler beim Laden des Profils:",
            error
          );
        }

        if (profile && mounted) {
          setCurrentUserName(profile.name);
        }
      }

      if (mounted) {
        await loadData();
      }
    }

    initialize();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const ordersChannel = supabase
      .channel("waiter-orders-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        async () => {
          await loadData();
        }
      )
      .subscribe();

    const itemsChannel = supabase
      .channel("waiter-order-items-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "order_items",
        },
        async () => {
          await loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(itemsChannel);
    };
  }, []);

  const tableStatuses = useMemo(() => {
    const result: Record<number, TableStatus> = {};

    for (let table = 1; table <= TABLE_COUNT; table++) {
      result[table] = getTableStatus(
        table,
        orders,
        orderItems
      );
    }

    return result;
  }, [orders, orderItems]);

  const freeTables = Object.values(tableStatuses).filter(
    (status) => status === "frei"
  ).length;

  const openTables = Object.values(tableStatuses).filter(
    (status) => status === "offen"
  ).length;

  const readyTables = Object.values(tableStatuses).filter(
    (status) => status === "fertig"
  ).length;

  const selectedTableOrders = useMemo(() => {
    if (selectedTable === null) {
      return [];
    }

    return orders.filter(
      (order) =>
        order.table_number === selectedTable
    );
  }, [orders, selectedTable]);

  const selectedTableOrderIds = useMemo(() => {
    return selectedTableOrders.map(
      (order) => order.id
    );
  }, [selectedTableOrders]);

  const selectedTableItems = useMemo(() => {
    return orderItems.filter((item) =>
      selectedTableOrderIds.includes(
        item.order_id
      )
    );
  }, [orderItems, selectedTableOrderIds]);

  const openOrder = useMemo(() => {
    return selectedTableOrders.find(
      (order) => order.status === "offen"
    );
  }, [selectedTableOrders]);

  const paymentItems = useMemo(() => {
    return selectedTableItems
      .filter(
        (item) =>
          item.paid_quantity < item.quantity
      )
      .map((item) => ({
        ...item,
        remainingQuantity:
          item.quantity - item.paid_quantity,
      }));
  }, [selectedTableItems]);

  const filteredProducts = useMemo(() => {
    const searchText = search
      .trim()
      .toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        searchText === "" ||
        product.name
          .toLowerCase()
          .includes(searchText);

      const matchesCategory =
        category === "alle" ||
        product.category === category;

      return (
        matchesSearch && matchesCategory
      );
    });
  }, [products, search, category]);

  const cartTotal = useMemo(() => {
    return cart.reduce(
      (total, item) =>
        total +
        item.product.price * item.quantity,
      0
    );
  }, [cart]);

  const paymentTotal = useMemo(() => {
    let total = 0;

    for (const selection of paymentSelection) {
      const item = paymentItems.find(
        (paymentItem) =>
          paymentItem.id === selection.itemId
      );

      if (!item) continue;

      const product = products.find(
        (productItem) =>
          productItem.name ===
          item.product_name
      );

      if (!product) continue;

      total +=
        product.price *
        selection.quantity;
    }

    return total;
  }, [
    paymentSelection,
    paymentItems,
    products,
  ]);

  const numericCashReceived =
    Number(
      cashReceived.replace(",", ".")
    ) || 0;

  const changeAmount =
    paymentMethod === "bar"
      ? Math.max(
          0,
          numericCashReceived -
            paymentTotal
        )
      : 0;

  function addToCart(product: Product) {
    setCart((currentCart) => {
      const existing = currentCart.find(
        (item) =>
          item.product.id === product.id
      );

      if (existing) {
        return currentCart.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantity:
                  item.quantity + 1,
              }
            : item
        );
      }

      return [
        ...currentCart,
        {
          product,
          quantity: 1,
        },
      ];
    });
  }

  function changeCartQuantity(
    productId: number,
    amount: number
  ) {
    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.product.id === productId
            ? {
                ...item,
                quantity:
                  item.quantity + amount,
              }
            : item
        )
        .filter(
          (item) => item.quantity > 0
        )
    );
  }

  async function createNewOrder() {
    if (
      selectedTable === null ||
      cart.length === 0
    ) {
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "Kein Benutzer eingeloggt."
        );
      }

      let orderId: number;

      if (openOrder) {
        orderId = openOrder.id;
      } else {
        const { data: newOrder, error } =
          await supabase
            .from("orders")
            .insert({
              table_number: selectedTable,
              waiter_id: user.id,
              status: "offen",
            })
            .select("*")
            .single();

        if (error) {
          throw error;
        }

        if (!newOrder) {
          throw new Error(
            "Bestellung konnte nicht erstellt werden."
          );
        }

        orderId = newOrder.id;
      }

      for (const cartItem of cart) {
        const { data: existingItem, error } =
          await supabase
            .from("order_items")
            .select("*")
            .eq("order_id", orderId)
            .eq(
              "product_name",
              cartItem.product.name
            )
            .maybeSingle();

        if (error) {
          throw error;
        }

        if (existingItem) {
          const { error: updateError } =
            await supabase
              .from("order_items")
              .update({
                quantity:
                  existingItem.quantity +
                  cartItem.quantity,
              })
              .eq(
                "id",
                existingItem.id
              );

          if (updateError) {
            throw updateError;
          }
        } else {
          const { error: insertError } =
            await supabase
              .from("order_items")
              .insert({
                order_id: orderId,
                product_name:
                  cartItem.product.name,
                quantity:
                  cartItem.quantity,
                paid_quantity: 0,
              });

          if (insertError) {
            throw insertError;
          }
        }
      }

      setCart([]);
      setShowAddOrder(false);
      setSearch("");
      setCategory("alle");

      await loadData();
    } catch (error) {
      console.error(
        "Fehler beim Speichern:",
        error
      );

      alert(
        "Die Bestellung konnte nicht gespeichert werden."
      );
    } finally {
      setSaving(false);
    }
  }

  async function finishOrder() {
    if (
      selectedTable === null ||
      !openOrder
    ) {
      return;
    }

    setSaving(true);

    try {
      const { error } =
        await supabase
          .from("orders")
          .update({
            status: "fertig",
          })
          .eq("id", openOrder.id);

      if (error) {
        throw error;
      }

      await loadData();
    } catch (error) {
      console.error(
        "Fehler beim Abschließen:",
        error
      );

      alert(
        "Die Bestellung konnte nicht abgeschlossen werden."
      );
    } finally {
      setSaving(false);
    }
  }

  function openPayment() {
    if (paymentItems.length === 0) {
      return;
    }

    setShowAddOrder(false);
    setShowPayment(true);
    setPaymentSelection([]);
    setPaymentMethod("bar");
    setCashReceived("");
  }

  function closePayment() {
    setShowPayment(false);
    setPaymentSelection([]);
    setCashReceived("");
  }

  function getSelectedQuantity(
    itemId: number
  ) {
    return (
      paymentSelection.find(
        (item) =>
          item.itemId === itemId
      )?.quantity ?? 0
    );
  }

  function changePaymentQuantity(
    itemId: number,
    amount: number
  ) {
    const item = paymentItems.find(
      (paymentItem) =>
        paymentItem.id === itemId
    );

    if (!item) {
      return;
    }

    setPaymentSelection(
      (currentSelection) => {
        const existing =
          currentSelection.find(
            (selection) =>
              selection.itemId === itemId
          );

        const oldQuantity =
          existing?.quantity ?? 0;

        const newQuantity = Math.max(
          0,
          Math.min(
            item.remainingQuantity,
            oldQuantity + amount
          )
        );

        if (newQuantity === 0) {
          return currentSelection.filter(
            (selection) =>
              selection.itemId !==
              itemId
          );
        }

        if (existing) {
          return currentSelection.map(
            (selection) =>
              selection.itemId === itemId
                ? {
                    ...selection,
                    quantity:
                      newQuantity,
                  }
                : selection
          );
        }

        return [
          ...currentSelection,
          {
            itemId,
            quantity: newQuantity,
          },
        ];
      }
    );
  }

  async function completePayment() {
    if (
      paymentSelection.length === 0 ||
      paymentTotal <= 0
    ) {
      return;
    }

    if (
      paymentMethod === "bar" &&
      numericCashReceived < paymentTotal
    ) {
      alert(
        "Der gegebene Geldbetrag ist zu niedrig."
      );
      return;
    }

    setSaving(true);

    try {
      const updatedItems = [
        ...orderItems,
      ];

      for (const selection of paymentSelection) {
        const currentItem =
          updatedItems.find(
            (item) =>
              item.id === selection.itemId
          );

        if (!currentItem) {
          continue;
        }

        const remaining =
          currentItem.quantity -
          currentItem.paid_quantity;

        const quantityToPay = Math.min(
          selection.quantity,
          remaining
        );

        if (quantityToPay <= 0) {
          continue;
        }

        const newPaidQuantity =
          currentItem.paid_quantity +
          quantityToPay;

        const fullyPaid =
          newPaidQuantity >=
          currentItem.quantity;

        const { data, error } =
          await supabase
            .from("order_items")
            .update({
              paid_quantity:
                newPaidQuantity,
              paid_at: fullyPaid
                ? new Date().toISOString()
                : currentItem.paid_at,
            })
            .eq("id", currentItem.id)
            .select("*")
            .single();

        if (error) {
          console.error(
            "Supabase Zahlungsfehler:",
            error
          );
          throw error;
        }

        if (!data) {
          throw new Error(
            "Der bezahlte Artikel wurde nicht zurückgegeben."
          );
        }

        const index =
          updatedItems.findIndex(
            (item) =>
              item.id === data.id
          );

        if (index !== -1) {
          updatedItems[index] =
            data as OrderItem;
        }
      }

      setOrderItems(updatedItems);

      setPaymentSelection([]);
      setCashReceived("");

      const remainingItems =
        updatedItems.filter((item) => {
          if (
            !selectedTableOrderIds.includes(
              item.order_id
            )
          ) {
            return false;
          }

          return (
            item.paid_quantity <
            item.quantity
          );
        });

      if (remainingItems.length > 0) {
        return;
      }

      const finishedOrders =
        selectedTableOrders.filter(
          (order) =>
            order.status === "fertig" &&
            order.finished_at === null
        );

      for (const order of finishedOrders) {
        const { error } =
          await supabase
            .from("orders")
            .update({
              finished_at:
                new Date().toISOString(),
            })
            .eq("id", order.id);

        if (error) {
          console.error(
            "finished_at Fehler:",
            error
          );
        }
      }

      setShowPayment(false);

      await loadData();
    } catch (error) {
      console.error(
        "Fehler bei der Zahlung:",
        error
      );

      alert(
        "Die Zahlung konnte nicht gespeichert werden. Bitte Konsole prüfen."
      );
    } finally {
      setSaving(false);
    }
  }

  function startAddingOrder() {
    setShowPayment(false);
    setShowAddOrder(true);
    setCart([]);
    setSearch("");
    setCategory("alle");
  }

  function cancelAddingOrder() {
    setShowAddOrder(false);
    setCart([]);
    setSearch("");
    setCategory("alle");
  }

  function closeTable() {
    setSelectedTable(null);
    setCart([]);
    setShowAddOrder(false);
    setShowPayment(false);
    setPaymentSelection([]);
    setCashReceived("");
    setSearch("");
    setCategory("alle");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 px-8 py-6 shadow-xl">
          <div className="text-lg font-semibold">
            Kassensystem wird geladen...
          </div>
        </div>
      </main>
    );
  }

  const panelClass = dark
    ? "rounded-2xl border border-slate-800 bg-slate-900 shadow-xl"
    : "rounded-2xl border border-slate-200 bg-white shadow-sm";

  const secondaryButton = dark
    ? "border-slate-700 hover:bg-slate-800"
    : "border-slate-300 hover:bg-slate-100";

  return (
    <main
      className={
        dark
          ? "min-h-screen bg-slate-950 text-white"
          : "min-h-screen bg-slate-100 text-slate-900"
      }
    >
      {/* HEADER */}

      <header
        className={
          dark
            ? "border-b border-slate-800 bg-slate-900"
            : "border-b border-slate-200 bg-white"
        }
      >
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-2xl font-bold">
              Döner POS
            </h1>

            <p className="mt-1 text-sm text-slate-400">
              Willkommen,{" "}
              {currentUserName ||
                "Mitarbeiter"}
            </p>
          </div>

          <button
            onClick={() =>
              setTheme(
                dark ? "light" : "dark"
              )
            }
            className={`rounded-xl border px-4 py-2 text-sm transition ${secondaryButton}`}
          >
            {dark
              ? "☀️ Hell"
              : "🌙 Dunkel"}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-6 py-6">
        {/* STATUS */}

        <div className="mb-7 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className={`${panelClass} p-5`}>
            <div className="text-sm text-slate-400">
              Freie Tische
            </div>

            <div className="mt-2 text-3xl font-bold text-green-500">
              {freeTables}
            </div>
          </div>

          <div className={`${panelClass} p-5`}>
            <div className="text-sm text-slate-400">
              Offene Bestellungen
            </div>

            <div className="mt-2 text-3xl font-bold text-orange-500">
              {openTables}
            </div>
          </div>

          <div className={`${panelClass} p-5`}>
            <div className="text-sm text-slate-400">
              Bezahlbereit
            </div>

            <div className="mt-2 text-3xl font-bold text-blue-500">
              {readyTables}
            </div>
          </div>
        </div>

        {/* TISCHE */}

        {selectedTable === null && (
          <section>
            <div className="mb-5">
              <h2 className="text-xl font-bold">
                Tische
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Wähle einen Tisch aus
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10">
              {Array.from(
                { length: TABLE_COUNT },
                (_, index) => {
                  const tableNumber =
                    index + 1;

                  const status =
                    tableStatuses[
                      tableNumber
                    ];

                  const classes =
                    status === "frei"
                      ? "border-green-500/40 bg-green-500/10 hover:bg-green-500/20"
                      : status === "offen"
                      ? "border-orange-500/40 bg-orange-500/10 hover:bg-orange-500/20"
                      : "border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20";

                  const text =
                    status === "frei"
                      ? "Frei"
                      : status === "offen"
                      ? "Bestellung offen"
                      : "Bezahlbereit";

                  return (
                    <button
                      key={tableNumber}
                      onClick={() =>
                        setSelectedTable(
                          tableNumber
                        )
                      }
                      className={`rounded-2xl border p-5 text-left transition hover:-translate-y-0.5 ${classes}`}
                    >
                      <div className="text-lg font-bold">
                        Tisch{" "}
                        {tableNumber}
                      </div>

                      <div className="mt-2 text-sm text-slate-400">
                        {text}
                      </div>
                    </button>
                  );
                }
              )}
            </div>
          </section>
        )}

        {/* AUSGEWÄHLTER TISCH */}

        {selectedTable !== null && (
          <section>
            <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <button
                  onClick={closeTable}
                  className="mb-2 text-sm text-slate-400 transition hover:text-slate-900 dark:hover:text-white"
                >
                  ← Zurück zu den Tischen
                </button>

                <h2 className="text-2xl font-bold">
                  Tisch {selectedTable}
                </h2>
              </div>

              <div className="flex flex-wrap gap-3">
                {!showPayment &&
                  !showAddOrder && (
                    <>
                      <button
                        onClick={
                          startAddingOrder
                        }
                        className="rounded-xl bg-orange-500 px-5 py-3 font-semibold text-white shadow-lg shadow-orange-500/10 transition hover:bg-orange-600"
                      >
                        + Weitere Artikel
                      </button>

                      {paymentItems.length >
                        0 && (
                        <button
                          onClick={
                            openPayment
                          }
                          className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
                        >
                          💳 Zur Bezahlung
                        </button>
                      )}
                    </>
                  )}
              </div>
            </div>

            {/* ZAHLUNG */}

            {showPayment && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
                <div
                  className={`${panelClass} p-6`}
                >
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold">
                        Zahlung
                      </h3>

                      <p className="mt-1 text-sm text-slate-400">
                        Wähle die Artikel aus,
                        die jetzt bezahlt werden.
                      </p>
                    </div>

                    <button
                      onClick={
                        closePayment
                      }
                      className="rounded-lg px-3 py-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-3">
                    {paymentItems.map(
                      (item) => {
                        const selected =
                          getSelectedQuantity(
                            item.id
                          );

                        const product =
                          products.find(
                            (productItem) =>
                              productItem.name ===
                              item.product_name
                          );

                        const price =
                          product?.price ?? 0;

                        return (
                          <div
                            key={item.id}
                            className={
                              dark
                                ? "rounded-xl border border-slate-700 bg-slate-800 p-4"
                                : "rounded-xl border border-slate-200 bg-slate-50 p-4"
                            }
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <div className="font-semibold">
                                  {
                                    item.product_name
                                  }
                                </div>

                                <div className="mt-1 text-sm text-slate-400">
                                  Noch{" "}
                                  {
                                    item.remainingQuantity
                                  }{" "}
                                  Stück ·{" "}
                                  {formatPrice(
                                    price
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() =>
                                    changePaymentQuantity(
                                      item.id,
                                      -1
                                    )
                                  }
                                  className="h-11 w-11 rounded-xl bg-slate-700 text-xl transition hover:bg-slate-600"
                                >
                                  −
                                </button>

                                <div className="w-12 text-center text-lg font-bold">
                                  {selected}
                                </div>

                                <button
                                  onClick={() =>
                                    changePaymentQuantity(
                                      item.id,
                                      1
                                    )
                                  }
                                  className="h-11 w-11 rounded-xl bg-slate-700 text-xl transition hover:bg-slate-600"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {selected >
                              0 && (
                              <div className="mt-3 rounded-lg bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-500">
                                Ausgewählt:{" "}
                                {selected} ×{" "}
                                {formatPrice(
                                  price
                                )}
                              </div>
                            )}
                          </div>
                        );
                      }
                    )}
                  </div>

                  {paymentItems.length ===
                    0 && (
                    <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-6 text-center">
                      <div className="text-3xl">
                        ✓
                      </div>

                      <div className="mt-2 font-semibold">
                        Alles bezahlt
                      </div>
                    </div>
                  )}
                </div>

                {/* ZAHLUNGSSEITE */}

                <div
                  className={`${panelClass} h-fit p-6`}
                >
                  <h3 className="mb-4 text-lg font-bold">
                    Zahlungsart
                  </h3>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() =>
                        setPaymentMethod(
                          "bar"
                        )
                      }
                      className={`rounded-xl border p-4 font-semibold transition ${
                        paymentMethod ===
                        "bar"
                          ? "border-green-500 bg-green-500/10 text-green-500"
                          : secondaryButton
                      }`}
                    >
                      💶 Bar
                    </button>

                    <button
                      onClick={() =>
                        setPaymentMethod(
                          "karte"
                        )
                      }
                      className={`rounded-xl border p-4 font-semibold transition ${
                        paymentMethod ===
                        "karte"
                          ? "border-blue-500 bg-blue-500/10 text-blue-500"
                          : secondaryButton
                      }`}
                    >
                      💳 Karte
                    </button>
                  </div>

                  <div
                    className={`mt-6 border-t pt-5 ${
                      dark
                        ? "border-slate-800"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">
                        Zu bezahlen
                      </span>

                      <span className="text-2xl font-bold">
                        {formatPrice(
                          paymentTotal
                        )}
                      </span>
                    </div>

                    {paymentMethod ===
                      "bar" && (
                      <>
                        <label className="mb-2 mt-6 block text-sm font-medium text-slate-400">
                          Gegeben
                        </label>

                        <input
                          type="text"
                          inputMode="decimal"
                          value={
                            cashReceived
                          }
                          onChange={(event) =>
                            setCashReceived(
                              event.target
                                .value
                            )
                          }
                          placeholder="0,00 €"
                          className={
                            dark
                              ? "w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-4 text-lg outline-none transition focus:border-blue-500"
                              : "w-full rounded-xl border border-slate-300 bg-white px-4 py-4 text-lg outline-none transition focus:border-blue-500"
                          }
                        />

                        <div className="mt-5 flex items-center justify-between">
                          <span className="text-slate-400">
                            Rückgeld
                          </span>

                          <span className="text-2xl font-bold text-green-500">
                            {formatPrice(
                              changeAmount
                            )}
                          </span>
                        </div>
                      </>
                    )}

                    {paymentMethod ===
                      "karte" && (
                      <div className="mt-5 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-sm text-blue-500">
                        Die Kartenzahlung wird
                        außerhalb des
                        Kassensystems
                        durchgeführt.
                      </div>
                    )}
                  </div>

                  <button
                    onClick={
                      completePayment
                    }
                    disabled={
                      saving ||
                      paymentSelection.length ===
                        0 ||
                      paymentTotal <= 0 ||
                      (paymentMethod ===
                        "bar" &&
                        numericCashReceived <
                          paymentTotal)
                    }
                    className="mt-6 w-full rounded-xl bg-green-600 px-5 py-4 text-lg font-bold text-white shadow-lg shadow-green-600/20 transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {saving
                      ? "Speichere..."
                      : `✓ ${formatPrice(
                          paymentTotal
                        )} bezahlen`}
                  </button>

                  <button
                    onClick={
                      closePayment
                    }
                    disabled={saving}
                    className={`mt-3 w-full rounded-xl border px-5 py-3 font-semibold transition ${secondaryButton}`}
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            )}

            {/* BESTELLUNG HINZUFÜGEN */}

            {showAddOrder && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
                <div>
                  <div
                    className={`${panelClass} mb-5 p-5`}
                  >
                    <div className="flex flex-col gap-3 md:flex-row">
                      <input
                        value={search}
                        onChange={(event) =>
                          setSearch(
                            event.target
                              .value
                          )
                        }
                        placeholder="Produkt suchen..."
                        className={
                          dark
                            ? "flex-1 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 outline-none focus:border-blue-500"
                            : "flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500"
                        }
                      />

                      <button
                        onClick={() => {
                          setSearch("");
                          setCategory(
                            "alle"
                          );
                        }}
                        className={`rounded-xl border px-4 py-3 transition ${secondaryButton}`}
                      >
                        Zurücksetzen
                      </button>
                    </div>

                    <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                      {Object.entries(
                        categoryNames
                      ).map(
                        ([key, name]) => (
                          <button
                            key={key}
                            onClick={() =>
                              setCategory(
                                key
                              )
                            }
                            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition ${
                              category ===
                              key
                                ? "bg-blue-600 text-white"
                                : dark
                                ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            {name}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                    {filteredProducts.map(
                      (product) => (
                        <button
                          key={product.id}
                          onClick={() =>
                            addToCart(
                              product
                            )
                          }
                          className={`${panelClass} p-5 text-left transition hover:-translate-y-0.5 hover:border-blue-500`}
                        >
                          <div className="font-semibold">
                            {
                              product.name
                            }
                          </div>

                          <div className="mt-2 font-bold text-blue-500">
                            {formatPrice(
                              product.price
                            )}
                          </div>

                          <div className="mt-2 text-xs text-slate-500">
                            {
                              categoryNames[
                                product
                                  .category
                              ] ??
                              product.category
                            }
                          </div>
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div
                  className={`${panelClass} h-fit p-6`}
                >
                  <div className="mb-5 flex items-center justify-between">
                    <h3 className="text-lg font-bold">
                      Neue Artikel
                    </h3>

                    <button
                      onClick={
                        cancelAddingOrder
                      }
                      className="rounded-lg px-3 py-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>

                  {cart.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
                      Klicke links auf
                      Produkte, um sie
                      hinzuzufügen.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {cart.map(
                        (cartItem) => (
                          <div
                            key={
                              cartItem
                                .product
                                .id
                            }
                            className={
                              dark
                                ? "rounded-xl border border-slate-800 bg-slate-800/50 p-3"
                                : "rounded-xl border border-slate-200 bg-slate-50 p-3"
                            }
                          >
                            <div className="flex justify-between gap-3">
                              <span className="font-medium">
                                {
                                  cartItem
                                    .product
                                    .name
                                }
                              </span>

                              <span className="font-semibold">
                                {formatPrice(
                                  cartItem
                                    .product
                                    .price *
                                    cartItem.quantity
                                )}
                              </span>
                            </div>

                            <div className="mt-3 flex items-center gap-2">
                              <button
                                onClick={() =>
                                  changeCartQuantity(
                                    cartItem
                                      .product
                                      .id,
                                    -1
                                  )
                                }
                                className="h-9 w-9 rounded-lg bg-slate-700 transition hover:bg-slate-600"
                              >
                                −
                              </button>

                              <span className="w-8 text-center font-semibold">
                                {
                                  cartItem.quantity
                                }
                              </span>

                              <button
                                onClick={() =>
                                  changeCartQuantity(
                                    cartItem
                                      .product
                                      .id,
                                    1
                                  )
                                }
                                className="h-9 w-9 rounded-lg bg-slate-700 transition hover:bg-slate-600"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}

                  <div
                    className={`mt-5 border-t pt-5 ${
                      dark
                        ? "border-slate-800"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="flex justify-between text-lg font-bold">
                      <span>Gesamt</span>

                      <span>
                        {formatPrice(
                          cartTotal
                        )}
                      </span>
                    </div>

                    <button
                      disabled={
                        saving ||
                        cart.length === 0
                      }
                      onClick={
                        createNewOrder
                      }
                      className="mt-5 w-full rounded-xl bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {saving
                        ? "Speichere..."
                        : "Bestellung speichern"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* NORMALE TISCHANSICHT */}

            {!showPayment &&
              !showAddOrder && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
                  <div
                    className={`${panelClass} p-6`}
                  >
                    <h3 className="mb-5 text-lg font-bold">
                      Bestellung
                    </h3>

                    {selectedTableItems.length ===
                    0 ? (
                      <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-400">
                        Für diesen Tisch
                        gibt es noch keine
                        Bestellung.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedTableItems.map(
                          (item) => {
                            const remaining =
                              item.quantity -
                              item.paid_quantity;

                            return (
                              <div
                                key={
                                  item.id
                                }
                                className={
                                  dark
                                    ? "rounded-xl border border-slate-800 bg-slate-800/40 p-4"
                                    : "rounded-xl border border-slate-200 bg-slate-50 p-4"
                                }
                              >
                                <div className="flex items-center justify-between gap-4">
                                  <div>
                                    <div className="font-semibold">
                                      {
                                        item.product_name
                                      }
                                    </div>

                                    <div className="mt-1 text-sm text-slate-400">
                                      Gesamt:{" "}
                                      {
                                        item.quantity
                                      }
                                    </div>
                                  </div>

                                  <div className="text-right">
                                    <div className="text-lg font-bold">
                                      {
                                        remaining
                                      }
                                    </div>

                                    <div className="text-xs text-slate-500">
                                      offen
                                    </div>
                                  </div>
                                </div>

                                {item.paid_quantity >
                                  0 && (
                                  <div className="mt-2 text-sm font-medium text-green-500">
                                    Bezahlt:{" "}
                                    {
                                      item.paid_quantity
                                    }
                                  </div>
                                )}
                              </div>
                            );
                          }
                        )}
                      </div>
                    )}
                  </div>

                  <div
                    className={`${panelClass} h-fit p-6`}
                  >
                    <h3 className="mb-5 text-lg font-bold">
                      Tisch{" "}
                      {selectedTable}
                    </h3>

                    {selectedTableItems.length >
                    0 ? (
                      <div className="space-y-3">
                        {selectedTableItems.map(
                          (item) => {
                            const remaining =
                              item.quantity -
                              item.paid_quantity;

                            return (
                              <div
                                key={
                                  item.id
                                }
                                className={`flex items-center justify-between border-b pb-3 ${
                                  dark
                                    ? "border-slate-800"
                                    : "border-slate-200"
                                }`}
                              >
                                <div>
                                  <div className="font-medium">
                                    {
                                      item.product_name
                                    }
                                  </div>

                                  <div className="mt-1 text-xs text-slate-500">
                                    Gesamt:{" "}
                                    {
                                      item.quantity
                                    }
                                  </div>
                                </div>

                                <div className="text-right">
                                  <div className="font-bold">
                                    {
                                      remaining
                                    }
                                  </div>

                                  <div className="text-xs text-slate-500">
                                    offen
                                  </div>
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-400">
                        Keine Artikel
                        vorhanden.
                      </div>
                    )}

                    {openOrder && (
                      <button
                        onClick={
                          finishOrder
                        }
                        disabled={saving}
                        className="mt-6 w-full rounded-xl bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {saving
                          ? "Speichere..."
                          : "✓ Bestellung fertig"}
                      </button>
                    )}

                    {paymentItems.length >
                      0 && (
                      <button
                        onClick={
                          openPayment
                        }
                        className="mt-3 w-full rounded-xl bg-green-600 px-5 py-3 font-bold text-white shadow-lg shadow-green-600/10 transition hover:bg-green-700"
                      >
                        💳 Bezahlen
                      </button>
                    )}

                    <button
                      onClick={
                        startAddingOrder
                      }
                      className={`mt-3 w-full rounded-xl border px-5 py-3 font-semibold transition ${secondaryButton}`}
                    >
                      + Weitere Artikel
                    </button>
                  </div>
                </div>
              )}
          </section>
        )}
      </div>
    </main>
  );
}