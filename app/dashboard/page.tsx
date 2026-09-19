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

function formatPrice(price: number) {
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

  const [selectedTable, setSelectedTable] =
    useState<number | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("alle");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showAddOrder, setShowAddOrder] =
    useState(false);

  const [showPayment, setShowPayment] =
    useState(false);

  const [paymentMethod, setPaymentMethod] =
    useState<"bar" | "karte">("bar");

  const [cashReceived, setCashReceived] =
    useState("");

  const [paymentSelection, setPaymentSelection] =
    useState<PaymentSelection[]>([]);

  const [currentUserName, setCurrentUserName] =
    useState("");

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

  const freeTables = Object.values(
    tableStatuses
  ).filter((status) => status === "frei").length;

  const openTables = Object.values(
    tableStatuses
  ).filter((status) => status === "offen").length;

  const readyTables = Object.values(
    tableStatuses
  ).filter((status) => status === "fertig").length;

  const selectedTableOrders = useMemo(() => {
    if (selectedTable === null) return [];

    return orders.filter(
      (order) =>
        order.table_number === selectedTable
    );
  }, [orders, selectedTable]);

  const selectedTableOrderIds = useMemo(
    () =>
      selectedTableOrders.map(
        (order) => order.id
      ),
    [selectedTableOrders]
  );

  const selectedTableItems = useMemo(
    () =>
      orderItems.filter((item) =>
        selectedTableOrderIds.includes(
          item.order_id
        )
      ),
    [orderItems, selectedTableOrderIds]
  );

  const openOrder = useMemo(
    () =>
      selectedTableOrders.find(
        (order) => order.status === "offen"
      ),
    [selectedTableOrders]
  );

  const paymentItems = useMemo(
    () =>
      selectedTableItems
        .filter(
          (item) =>
            item.paid_quantity < item.quantity
        )
        .map((item) => ({
          ...item,
          remainingQuantity:
            item.quantity -
            item.paid_quantity,
        })),
    [selectedTableItems]
  );

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

  const cartTotal = useMemo(
    () =>
      cart.reduce(
        (total, item) =>
          total +
          item.product.price * item.quantity,
        0
      ),
    [cart]
  );

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
        product.price * selection.quantity;
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

        if (error) throw error;

        if (!newOrder) {
          throw new Error(
            "Bestellung konnte nicht erstellt werden."
          );
        }

        orderId = newOrder.id;
      }

      for (const cartItem of cart) {
        const {
          data: existingItem,
          error,
        } = await supabase
          .from("order_items")
          .select("*")
          .eq("order_id", orderId)
          .eq(
            "product_name",
            cartItem.product.name
          )
          .maybeSingle();

        if (error) throw error;

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
          const {
            error: insertError,
          } = await supabase
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

      if (error) throw error;

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
    if (paymentItems.length === 0) return;

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

    if (!item) return;

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

        if (!currentItem) continue;

        const remaining =
          currentItem.quantity -
          currentItem.paid_quantity;

        const quantityToPay = Math.min(
          selection.quantity,
          remaining
        );

        if (quantityToPay <= 0) continue;

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

  const panel = dark
    ? "rounded-3xl border border-slate-800 bg-slate-900"
    : "rounded-3xl border border-slate-200 bg-white";

  const muted = dark
    ? "text-slate-400"
    : "text-slate-500";

  const input = dark
    ? "border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
    : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400";

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500" />
          <div className="text-lg font-semibold">
            Kassensystem wird geladen...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className={
        dark
          ? "min-h-screen bg-[#070b14] text-white"
          : "min-h-screen bg-slate-100 text-slate-900"
      }
    >
      {/* HEADER */}

      <header
        className={
          dark
            ? "sticky top-0 z-40 border-b border-slate-800 bg-[#0b101c]/95 backdrop-blur"
            : "sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur"
        }
      >
        <div className="mx-auto flex max-w-[1700px] items-center justify-between px-4 py-4 md:px-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-xl shadow-lg shadow-blue-600/20">
              🍽️
            </div>

            <div>
              <h1 className="text-xl font-black tracking-tight">
                Döner POS
              </h1>

              <p
                className={`text-sm ${muted}`}
              >
                Kellner ·{" "}
                {currentUserName ||
                  "Mitarbeiter"}
              </p>
            </div>
          </div>

          <button
            onClick={() =>
              setTheme(
                dark ? "light" : "dark"
              )
            }
            className={
              dark
                ? "rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold transition hover:bg-slate-700"
                : "rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold transition hover:bg-slate-100"
            }
          >
            {dark
              ? "☀️ Hell"
              : "🌙 Dunkel"}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1700px] px-4 py-6 md:px-6">
        {/* STATUSKARTEN */}

        <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div
            className={`${panel} p-5 transition hover:-translate-y-0.5`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p
                  className={`text-sm font-medium ${muted}`}
                >
                  Freie Tische
                </p>

                <p className="mt-2 text-3xl font-black">
                  {freeTables}
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-500/10 text-xl">
                🟢
              </div>
            </div>
          </div>

          <div
            className={`${panel} p-5 transition hover:-translate-y-0.5`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p
                  className={`text-sm font-medium ${muted}`}
                >
                  Offene Bestellungen
                </p>

                <p className="mt-2 text-3xl font-black">
                  {openTables}
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10 text-xl">
                🟠
              </div>
            </div>
          </div>

          <div
            className={`${panel} p-5 transition hover:-translate-y-0.5`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p
                  className={`text-sm font-medium ${muted}`}
                >
                  Bezahlbereit
                </p>

                <p className="mt-2 text-3xl font-black">
                  {readyTables}
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-xl">
                🔵
              </div>
            </div>
          </div>
        </div>

        {/* TISCHÜBERSICHT */}

        {selectedTable === null && (
          <section>
            <div className="mb-5">
              <h2 className="text-2xl font-black">
                Tische
              </h2>

              <p className={`mt-1 ${muted}`}>
                Wähle einen Tisch, um eine
                Bestellung aufzunehmen oder
                eine Zahlung durchzuführen.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8">
              {Array.from(
                { length: TABLE_COUNT },
                (_, index) => {
                  const tableNumber =
                    index + 1;

                  const status =
                    tableStatuses[
                      tableNumber
                    ];

                  const statusData =
                    status === "frei"
                      ? {
                          label: "Frei",
                          icon: "✓",
                          color:
                            "border-green-500/30 bg-green-500/[0.07] hover:border-green-500 hover:bg-green-500/[0.12]",
                          badge:
                            "bg-green-500/10 text-green-500",
                        }
                      : status === "offen"
                      ? {
                          label: "Bestellung offen",
                          icon: "●",
                          color:
                            "border-orange-500/30 bg-orange-500/[0.07] hover:border-orange-500 hover:bg-orange-500/[0.12]",
                          badge:
                            "bg-orange-500/10 text-orange-500",
                        }
                      : {
                          label: "Bezahlbereit",
                          icon: "€",
                          color:
                            "border-blue-500/30 bg-blue-500/[0.07] hover:border-blue-500 hover:bg-blue-500/[0.12]",
                          badge:
                            "bg-blue-500/10 text-blue-500",
                        };

                  return (
                    <button
                      key={tableNumber}
                      onClick={() =>
                        setSelectedTable(
                          tableNumber
                        )
                      }
                      className={`group min-h-[135px] rounded-3xl border p-4 text-left transition hover:-translate-y-1 hover:shadow-xl ${statusData.color}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="text-lg font-black">
                          Tisch{" "}
                          {tableNumber}
                        </div>

                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black ${statusData.badge}`}
                        >
                          {
                            statusData.icon
                          }
                        </div>
                      </div>

                      <div
                        className={`mt-8 inline-flex rounded-lg px-2.5 py-1 text-xs font-bold ${statusData.badge}`}
                      >
                        {statusData.label}
                      </div>
                    </button>
                  );
                }
              )}
            </div>
          </section>
        )}

        {/* TISCH */}

        {selectedTable !== null && (
          <section>
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <button
                  onClick={closeTable}
                  className={`mb-3 text-sm font-semibold transition hover:text-blue-500 ${muted}`}
                >
                  ← Tischübersicht
                </button>

                <div className="flex items-center gap-3">
                  <h2 className="text-3xl font-black">
                    Tisch {selectedTable}
                  </h2>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      tableStatuses[
                        selectedTable
                      ] === "frei"
                        ? "bg-green-500/10 text-green-500"
                        : tableStatuses[
                            selectedTable
                          ] === "offen"
                        ? "bg-orange-500/10 text-orange-500"
                        : "bg-blue-500/10 text-blue-500"
                    }`}
                  >
                    {
                      tableStatuses[
                        selectedTable
                      ] === "frei"
                        ? "Frei"
                        : tableStatuses[
                            selectedTable
                          ] === "offen"
                        ? "Offen"
                        : "Bezahlbereit"
                    }
                  </span>
                </div>
              </div>

              {!showPayment &&
                !showAddOrder && (
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={
                        startAddingOrder
                      }
                      className="rounded-2xl bg-orange-500 px-5 py-3 font-bold text-white shadow-lg shadow-orange-500/20 transition hover:-translate-y-0.5 hover:bg-orange-600"
                    >
                      + Artikel hinzufügen
                    </button>

                    {paymentItems.length >
                      0 && (
                      <button
                        onClick={
                          openPayment
                        }
                        className="rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-blue-700"
                      >
                        💳 Bezahlen
                      </button>
                    )}
                  </div>
                )}
            </div>

            {/* ZAHLUNG */}

            {showPayment && (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_430px]">
                <div className={`${panel} p-6`}>
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold uppercase tracking-wider text-blue-500">
                        Tisch {selectedTable}
                      </p>

                      <h3 className="mt-1 text-2xl font-black">
                        Zahlung
                      </h3>

                      <p
                        className={`mt-1 text-sm ${muted}`}
                      >
                        Wähle die Artikel,
                        die jetzt bezahlt
                        werden.
                      </p>
                    </div>

                    <button
                      onClick={
                        closePayment
                      }
                      className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                        dark
                          ? "bg-slate-800 hover:bg-slate-700"
                          : "bg-slate-100 hover:bg-slate-200"
                      }`}
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
                            (p) =>
                              p.name ===
                              item.product_name
                          );

                        const price =
                          product?.price ?? 0;

                        return (
                          <div
                            key={item.id}
                            className={
                              dark
                                ? "rounded-2xl border border-slate-800 bg-slate-800/50 p-4"
                                : "rounded-2xl border border-slate-200 bg-slate-50 p-4"
                            }
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div className="min-w-0">
                                <div className="truncate font-bold">
                                  {
                                    item.product_name
                                  }
                                </div>

                                <div
                                  className={`mt-1 text-sm ${muted}`}
                                >
                                  Noch{" "}
                                  {
                                    item.remainingQuantity
                                  }{" "}
                                  ·{" "}
                                  {formatPrice(
                                    price
                                  )}
                                </div>
                              </div>

                              <div className="flex shrink-0 items-center gap-2">
                                <button
                                  onClick={() =>
                                    changePaymentQuantity(
                                      item.id,
                                      -1
                                    )
                                  }
                                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-700 text-xl font-bold transition hover:bg-slate-600"
                                >
                                  −
                                </button>

                                <div className="w-8 text-center font-black">
                                  {selected}
                                </div>

                                <button
                                  onClick={() =>
                                    changePaymentQuantity(
                                      item.id,
                                      1
                                    )
                                  }
                                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-xl font-bold text-white transition hover:bg-blue-700"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {selected >
                              0 && (
                              <div className="mt-3 rounded-xl bg-blue-500/10 px-3 py-2 text-sm font-bold text-blue-500">
                                {selected} ×{" "}
                                {formatPrice(
                                  price
                                )}{" "}
                                ausgewählt
                              </div>
                            )}
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>

                <div
                  className={`${panel} h-fit p-6 xl:sticky xl:top-24`}
                >
                  <div className="mb-5">
                    <p
                      className={`text-sm ${muted}`}
                    >
                      Zahlungsart
                    </p>

                    <h3 className="mt-1 text-xl font-black">
                      Zahlung abschließen
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() =>
                        setPaymentMethod(
                          "bar"
                        )
                      }
                      className={`rounded-2xl border p-4 font-bold transition ${
                        paymentMethod ===
                        "bar"
                          ? "border-green-500 bg-green-500/10 text-green-500"
                          : dark
                          ? "border-slate-700 bg-slate-800 hover:bg-slate-700"
                          : "border-slate-300 bg-white hover:bg-slate-100"
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
                      className={`rounded-2xl border p-4 font-bold transition ${
                        paymentMethod ===
                        "karte"
                          ? "border-blue-500 bg-blue-500/10 text-blue-500"
                          : dark
                          ? "border-slate-700 bg-slate-800 hover:bg-slate-700"
                          : "border-slate-300 bg-white hover:bg-slate-100"
                      }`}
                    >
                      💳 Karte
                    </button>
                  </div>

                  <div
                    className={`my-6 border-t ${
                      dark
                        ? "border-slate-800"
                        : "border-slate-200"
                    }`}
                  />

                  <div className="flex items-end justify-between">
                    <span className={muted}>
                      Zu bezahlen
                    </span>

                    <span className="text-3xl font-black">
                      {formatPrice(
                        paymentTotal
                      )}
                    </span>
                  </div>

                  {paymentMethod ===
                    "bar" && (
                    <>
                      <label
                        className={`mt-6 mb-2 block text-sm font-bold ${muted}`}
                      >
                        Gegeben
                      </label>

                      <input
                        type="text"
                        inputMode="decimal"
                        value={
                          cashReceived
                        }
                        onChange={(e) =>
                          setCashReceived(
                            e.target.value
                          )
                        }
                        placeholder="0,00 €"
                        className={`w-full rounded-2xl border px-4 py-4 text-xl font-bold outline-none transition focus:border-blue-500 ${input}`}
                      />

                      <div className="mt-5 flex items-center justify-between rounded-2xl bg-green-500/10 p-4">
                        <span className="font-semibold text-green-500">
                          Rückgeld
                        </span>

                        <span className="text-2xl font-black text-green-500">
                          {formatPrice(
                            changeAmount
                          )}
                        </span>
                      </div>
                    </>
                  )}

                  {paymentMethod ===
                    "karte" && (
                    <div className="mt-5 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-blue-500">
                      💳 Kartenzahlung wird
                      außerhalb des
                      Kassensystems
                      durchgeführt.
                    </div>
                  )}

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
                    className="mt-6 w-full rounded-2xl bg-green-600 px-5 py-4 text-lg font-black text-white shadow-lg shadow-green-600/20 transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
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
                    className={`mt-3 w-full rounded-2xl border px-5 py-3 font-bold transition ${
                      dark
                        ? "border-slate-700 hover:bg-slate-800"
                        : "border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            )}

            {/* ARTIKEL HINZUFÜGEN */}

            {showAddOrder && (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_430px]">
                <div>
                  <div
                    className={`${panel} mb-5 p-5`}
                  >
                    <div className="flex gap-3">
                      <div className="relative flex-1">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                          🔎
                        </span>

                        <input
                          value={search}
                          onChange={(e) =>
                            setSearch(
                              e.target.value
                            )
                          }
                          placeholder="Produkt suchen..."
                          className={`w-full rounded-2xl border py-3 pl-11 pr-4 outline-none focus:border-blue-500 ${input}`}
                        />
                      </div>

                      <button
                        onClick={() => {
                          setSearch("");
                          setCategory(
                            "alle"
                          );
                        }}
                        className={`rounded-2xl border px-4 font-semibold transition ${
                          dark
                            ? "border-slate-700 hover:bg-slate-800"
                            : "border-slate-300 hover:bg-slate-100"
                        }`}
                      >
                        Reset
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
                            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition ${
                              category ===
                              key
                                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
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

                  {filteredProducts.length ===
                  0 ? (
                    <div
                      className={`${panel} p-10 text-center`}
                    >
                      <div className="text-4xl">
                        🔎
                      </div>

                      <h3 className="mt-3 font-bold">
                        Kein Produkt gefunden
                      </h3>

                      <p
                        className={`mt-1 text-sm ${muted}`}
                      >
                        Ändere deine Suche
                        oder Kategorie.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {filteredProducts.map(
                        (product) => (
                          <button
                            key={
                              product.id
                            }
                            onClick={() =>
                              addToCart(
                                product
                              )
                            }
                            className={`group rounded-3xl border p-4 text-left transition hover:-translate-y-1 hover:border-blue-500 hover:shadow-xl ${
                              dark
                                ? "border-slate-800 bg-slate-900 hover:bg-slate-800"
                                : "border-slate-200 bg-white hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex min-h-[105px] flex-col justify-between">
                              <div>
                                <div className="font-bold leading-snug">
                                  {
                                    product.name
                                  }
                                </div>

                                <div
                                  className={`mt-2 text-xs ${muted}`}
                                >
                                  {
                                    categoryNames[
                                      product
                                        .category
                                    ] ??
                                    product.category
                                  }
                                </div>
                              </div>

                              <div className="mt-4 flex items-center justify-between">
                                <span className="font-black text-blue-500">
                                  {formatPrice(
                                    product.price
                                  )}
                                </span>

                                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500 transition group-hover:bg-blue-600 group-hover:text-white">
                                  +
                                </span>
                              </div>
                            </div>
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>

                {/* WARENKORB */}

                <div
                  className={`${panel} h-fit p-6 xl:sticky xl:top-24`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p
                        className={`text-sm ${muted}`}
                      >
                        Tisch{" "}
                        {selectedTable}
                      </p>

                      <h3 className="text-xl font-black">
                        Neue Artikel
                      </h3>
                    </div>

                    <button
                      onClick={
                        cancelAddingOrder
                      }
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                        dark
                          ? "bg-slate-800 hover:bg-slate-700"
                          : "bg-slate-100 hover:bg-slate-200"
                      }`}
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mt-5 max-h-[480px] space-y-3 overflow-y-auto pr-1">
                    {cart.length === 0 ? (
                      <div
                        className={`rounded-2xl border border-dashed p-8 text-center ${dark ? "border-slate-700" : "border-slate-300"}`}
                      >
                        <div className="text-3xl">
                          🛒
                        </div>

                        <p
                          className={`mt-3 text-sm ${muted}`}
                        >
                          Wähle Produkte aus,
                          um sie hier
                          hinzuzufügen.
                        </p>
                      </div>
                    ) : (
                      cart.map(
                        (cartItem) => (
                          <div
                            key={
                              cartItem
                                .product
                                .id
                            }
                            className={
                              dark
                                ? "rounded-2xl border border-slate-800 bg-slate-800/50 p-4"
                                : "rounded-2xl border border-slate-200 bg-slate-50 p-4"
                            }
                          >
                            <div className="flex justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-bold">
                                  {
                                    cartItem
                                      .product
                                      .name
                                  }
                                </div>

                                <div
                                  className={`mt-1 text-sm ${muted}`}
                                >
                                  {formatPrice(
                                    cartItem
                                      .product
                                      .price
                                  )}{" "}
                                  pro Stück
                                </div>
                              </div>

                              <div className="font-black">
                                {formatPrice(
                                  cartItem
                                    .product
                                    .price *
                                    cartItem.quantity
                                )}
                              </div>
                            </div>

                            <div className="mt-4 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() =>
                                    changeCartQuantity(
                                      cartItem
                                        .product
                                        .id,
                                      -1
                                    )
                                  }
                                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-700 text-lg font-bold hover:bg-slate-600"
                                >
                                  −
                                </button>

                                <span className="w-8 text-center font-black">
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
                                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold text-white hover:bg-blue-700"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      )
                    )}
                  </div>

                  <div
                    className={`mt-5 border-t pt-5 ${
                      dark
                        ? "border-slate-800"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="flex items-end justify-between">
                      <span className={muted}>
                        Gesamt
                      </span>

                      <span className="text-2xl font-black">
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
                      className="mt-5 w-full rounded-2xl bg-blue-600 px-5 py-4 font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {saving
                        ? "Speichere..."
                        : "✓ Bestellung speichern"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* NORMALE TISCHANSICHT */}

            {!showPayment &&
              !showAddOrder && (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_430px]">
                  <div className={`${panel} p-6`}>
                    <div className="mb-5 flex items-center justify-between">
                      <div>
                        <p
                          className={`text-sm ${muted}`}
                        >
                          Aktuelle Bestellung
                        </p>

                        <h3 className="text-xl font-black">
                          Artikel
                        </h3>
                      </div>

                      <span
                        className={`rounded-xl px-3 py-2 text-sm font-bold ${
                          selectedTableItems.length >
                          0
                            ? "bg-blue-500/10 text-blue-500"
                            : dark
                            ? "bg-slate-800 text-slate-400"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {
                          selectedTableItems.length
                        }{" "}
                        Positionen
                      </span>
                    </div>

                    {selectedTableItems.length ===
                    0 ? (
                      <div
                        className={`rounded-2xl border border-dashed p-10 text-center ${
                          dark
                            ? "border-slate-700"
                            : "border-slate-300"
                        }`}
                      >
                        <div className="text-4xl">
                          🍽️
                        </div>

                        <h3 className="mt-3 font-bold">
                          Tisch ist frei
                        </h3>

                        <p
                          className={`mt-1 text-sm ${muted}`}
                        >
                          Füge die erste
                          Bestellung hinzu.
                        </p>
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
                                    ? "rounded-2xl border border-slate-800 bg-slate-800/40 p-4"
                                    : "rounded-2xl border border-slate-200 bg-slate-50 p-4"
                                }
                              >
                                <div className="flex items-center justify-between gap-4">
                                  <div>
                                    <div className="font-bold">
                                      {
                                        item.product_name
                                      }
                                    </div>

                                    <div
                                      className={`mt-1 text-sm ${muted}`}
                                    >
                                      Gesamt:{" "}
                                      {
                                        item.quantity
                                      }
                                    </div>
                                  </div>

                                  <div className="text-right">
                                    <div className="text-xl font-black">
                                      {
                                        remaining
                                      }
                                    </div>

                                    <div
                                      className={`text-xs ${muted}`}
                                    >
                                      offen
                                    </div>
                                  </div>
                                </div>

                                {item.paid_quantity >
                                  0 && (
                                  <div className="mt-3 inline-flex rounded-lg bg-green-500/10 px-3 py-1.5 text-xs font-bold text-green-500">
                                    ✓{" "}
                                    {
                                      item.paid_quantity
                                    }{" "}
                                    bezahlt
                                  </div>
                                )}
                              </div>
                            );
                          }
                        )}
                      </div>
                    )}
                  </div>

                  {/* AKTIONEN */}

                  <div
                    className={`${panel} h-fit p-6 xl:sticky xl:top-24`}
                  >
                    <p
                      className={`text-sm ${muted}`}
                    >
                      Tischverwaltung
                    </p>

                    <h3 className="mt-1 text-2xl font-black">
                      Tisch{" "}
                      {selectedTable}
                    </h3>

                    {selectedTableItems.length >
                      0 && (
                      <div
                        className={`mt-5 rounded-2xl p-4 ${
                          dark
                            ? "bg-slate-800/60"
                            : "bg-slate-50"
                        }`}
                      >
                        <div className="flex justify-between">
                          <span className={muted}>
                            Offene Artikel
                          </span>

                          <span className="font-black">
                            {paymentItems.reduce(
                              (
                                total,
                                item
                              ) =>
                                total +
                                item.remainingQuantity,
                              0
                            )}
                          </span>
                        </div>
                      </div>
                    )}

                    {openOrder && (
                      <button
                        onClick={
                          finishOrder
                        }
                        disabled={saving}
                        className="mt-5 w-full rounded-2xl bg-blue-600 px-5 py-4 font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:opacity-40"
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
                        className="mt-3 w-full rounded-2xl bg-green-600 px-5 py-4 font-black text-white shadow-lg shadow-green-600/20 transition hover:bg-green-700"
                      >
                        💳 Zur Bezahlung
                      </button>
                    )}

                    <button
                      onClick={
                        startAddingOrder
                      }
                      className="mt-3 w-full rounded-2xl bg-orange-500 px-5 py-4 font-black text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600"
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