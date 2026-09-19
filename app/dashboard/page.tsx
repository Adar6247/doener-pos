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

  if (
    tableOrders.some(
      (order) => order.status === "offen"
    )
  ) {
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

  return hasUnpaidItems ? "fertig" : "frei";
}

function getStatusLabel(status: TableStatus) {
  if (status === "offen") return "Bestellung offen";
  if (status === "fertig") return "Bezahlbereit";
  return "Frei";
}

function getStatusClasses(
  status: TableStatus,
  dark: boolean
) {
  if (status === "offen") {
    return dark
      ? "border-orange-500/30 bg-orange-500/[0.08] text-orange-400"
      : "border-orange-200 bg-orange-50 text-orange-600";
  }

  if (status === "fertig") {
    return dark
      ? "border-blue-500/30 bg-blue-500/[0.08] text-blue-400"
      : "border-blue-200 bg-blue-50 text-blue-600";
  }

  return dark
    ? "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-400"
    : "border-emerald-200 bg-emerald-50 text-emerald-600";
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
      setProducts(
        productsResult.data as Product[]
      );
    }

    if (ordersResult.data) {
      setOrders(
        ordersResult.data as Order[]
      );
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
      supabase.removeChannel(
        ordersChannel
      );
      supabase.removeChannel(
        itemsChannel
      );
    };
  }, []);

  const tableStatuses = useMemo(() => {
    const result: Record<number, TableStatus> =
      {};

    for (
      let table = 1;
      table <= TABLE_COUNT;
      table++
    ) {
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
  ).filter(
    (status) => status === "frei"
  ).length;

  const openTables = Object.values(
    tableStatuses
  ).filter(
    (status) => status === "offen"
  ).length;

  const readyTables = Object.values(
    tableStatuses
  ).filter(
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
        (order) =>
          order.status === "offen"
      ),
    [selectedTableOrders]
  );

  const paymentItems = useMemo(
    () =>
      selectedTableItems
        .filter(
          (item) =>
            item.paid_quantity <
            item.quantity
        )
        .map((item) => ({
          ...item,
          remainingQuantity:
            item.quantity -
            item.paid_quantity,
        })),
    [selectedTableItems]
  );

  const categories = useMemo(() => {
    const unique = Array.from(
      new Set(
        products
          .map((product) =>
            product.category?.trim()
          )
          .filter(Boolean)
      )
    );

    return ["alle", ...unique];
  }, [products]);

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
        matchesSearch &&
        matchesCategory
      );
    });
  }, [
    products,
    search,
    category,
  ]);

  const cartTotal = useMemo(
    () =>
      cart.reduce(
        (total, item) =>
          total +
          item.product.price *
            item.quantity,
        0
      ),
    [cart]
  );

  const paymentTotal = useMemo(() => {
    let total = 0;

    for (const selection of paymentSelection) {
      const item = paymentItems.find(
        (paymentItem) =>
          paymentItem.id ===
          selection.itemId
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

  const tableOpenItemCount = useMemo(
    () =>
      paymentItems.reduce(
        (total, item) =>
          total +
          item.remainingQuantity,
        0
      ),
    [paymentItems]
  );

  function addToCart(product: Product) {
    setCart((currentCart) => {
      const existing =
        currentCart.find(
          (item) =>
            item.product.id ===
            product.id
        );

      if (existing) {
        return currentCart.map(
          (item) =>
            item.product.id ===
            product.id
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
          item.product.id ===
          productId
            ? {
                ...item,
                quantity:
                  item.quantity +
                  amount,
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
      } =
        await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "Kein Benutzer eingeloggt."
        );
      }

      let orderId: number;

      if (openOrder) {
        orderId = openOrder.id;
      } else {
        const {
          data: newOrder,
          error,
        } = await supabase
          .from("orders")
          .insert({
            table_number:
              selectedTable,
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
          .eq(
            "order_id",
            orderId
          )
          .eq(
            "product_name",
            cartItem.product.name
          )
          .maybeSingle();

        if (error) throw error;

        if (existingItem) {
          const {
            error: updateError,
          } = await supabase
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
          .eq(
            "id",
            openOrder.id
          );

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

    if (!item) return;

    setPaymentSelection(
      (currentSelection) => {
        const existing =
          currentSelection.find(
            (selection) =>
              selection.itemId ===
              itemId
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
              selection.itemId ===
              itemId
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
      numericCashReceived <
        paymentTotal
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
              item.id ===
              selection.itemId
          );

        if (!currentItem) continue;

        const remaining =
          currentItem.quantity -
          currentItem.paid_quantity;

        const quantityToPay =
          Math.min(
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

        const {
          data,
          error,
        } = await supabase
          .from("order_items")
          .update({
            paid_quantity:
              newPaidQuantity,
            paid_at: fullyPaid
              ? new Date().toISOString()
              : currentItem.paid_at,
          })
          .eq(
            "id",
            currentItem.id
          )
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
            .eq(
              "id",
              order.id
            );

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
      <main className="flex min-h-screen items-center justify-center bg-[#070b14] text-white">
        <div className="text-center">
          <div className="mx-auto mb-5 h-11 w-11 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500" />

          <p className="text-lg font-bold">
            Döner POS
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Kassensystem wird geladen...
          </p>
        </div>
      </main>
    );
  }

  const pageBackground = dark
    ? "bg-[#070b14] text-white"
    : "bg-[#f5f7fa] text-slate-900";

  const sidebarBackground = dark
    ? "border-slate-800 bg-[#0b101c]"
    : "border-slate-200 bg-white";

  const cardBackground = dark
    ? "border-slate-800 bg-[#0d1422]"
    : "border-slate-200 bg-white";

  const softBackground = dark
    ? "bg-slate-800/50"
    : "bg-slate-100";

  return (
    <main
      className={`min-h-screen ${pageBackground}`}
    >
      {/* HEADER */}

      <header
        className={`sticky top-0 z-50 border-b backdrop-blur-xl ${
          dark
            ? "border-slate-800 bg-[#0b101c]/95"
            : "border-slate-200 bg-white/95"
        }`}
      >
        <div className="mx-auto flex h-[76px] max-w-[1800px] items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-xl shadow-lg shadow-blue-600/20">
              🍽️
            </div>

            <div>
              <div className="text-lg font-black tracking-tight">
                Döner POS
              </div>

              <div
                className={`text-xs font-medium ${
                  dark
                    ? "text-slate-500"
                    : "text-slate-500"
                }`}
              >
                {currentUserName ||
                  "Mitarbeiter"}{" "}
                · Kellner
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`hidden rounded-xl px-3 py-2 text-sm font-semibold sm:block ${
                dark
                  ? "bg-slate-800 text-slate-300"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              🟢 System online
            </div>

            <button
              onClick={() =>
                setTheme(
                  dark
                    ? "light"
                    : "dark"
                )
              }
              className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                dark
                  ? "border-slate-700 bg-slate-800 hover:bg-slate-700"
                  : "border-slate-300 bg-white hover:bg-slate-100"
              }`}
              title="Darstellung ändern"
            >
              {dark ? "☀️" : "🌙"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1800px]">
        {/* LINKER BEREICH */}

        <aside
          className={`hidden min-h-[calc(100vh-76px)] w-[280px] shrink-0 border-r p-5 lg:block ${sidebarBackground}`}
        >
          <div className="mb-6">
            <p
              className={`text-xs font-black uppercase tracking-[0.15em] ${
                dark
                  ? "text-slate-600"
                  : "text-slate-400"
              }`}
            >
              Übersicht
            </p>

            <h2 className="mt-2 text-xl font-black">
              Deine Tische
            </h2>
          </div>

          <div className="space-y-2">
            {Array.from(
              { length: TABLE_COUNT },
              (_, index) => {
                const table =
                  index + 1;

                const status =
                  tableStatuses[table];

                const selected =
                  selectedTable ===
                  table;

                const tableOrders =
                  orders.filter(
                    (order) =>
                      order.table_number ===
                      table
                  );

                const tableOrderIds =
                  tableOrders.map(
                    (order) =>
                      order.id
                  );

                const itemCount =
                  orderItems
                    .filter((item) =>
                      tableOrderIds.includes(
                        item.order_id
                      )
                    )
                    .reduce(
                      (
                        total,
                        item
                      ) =>
                        total +
                        item.quantity,
                      0
                    );

                return (
                  <button
                    key={table}
                    onClick={() =>
                      setSelectedTable(
                        table
                      )
                    }
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                      selected
                        ? "border-blue-500 bg-blue-500/10"
                        : dark
                        ? "border-transparent hover:bg-slate-800/70"
                        : "border-transparent hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black ${
                          status ===
                          "offen"
                            ? "bg-orange-500/10 text-orange-500"
                            : status ===
                              "fertig"
                            ? "bg-blue-500/10 text-blue-500"
                            : "bg-green-500/10 text-green-500"
                        }`}
                      >
                        {table}
                      </div>

                      <div>
                        <div className="text-sm font-bold">
                          Tisch{" "}
                          {table}
                        </div>

                        <div
                          className={`text-xs ${
                            dark
                              ? "text-slate-500"
                              : "text-slate-400"
                          }`}
                        >
                          {getStatusLabel(
                            status
                          )}
                        </div>
                      </div>
                    </div>

                    {itemCount >
                      0 && (
                      <span
                        className={`rounded-lg px-2 py-1 text-xs font-black ${
                          dark
                            ? "bg-slate-800 text-slate-400"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {itemCount}
                      </span>
                    )}
                  </button>
                );
              }
            )}
          </div>
        </aside>

        {/* HAUPTBEREICH */}

        <div className="min-w-0 flex-1 p-4 md:p-6">
          {/* MOBILE TISCHLEISTE */}

          <div className="mb-5 lg:hidden">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-black">
                Tische
              </h2>

              <span
                className={`text-xs font-medium ${
                  dark
                    ? "text-slate-500"
                    : "text-slate-400"
                }`}
              >
                25 Tische
              </span>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2">
              {Array.from(
                { length: TABLE_COUNT },
                (_, index) => {
                  const table =
                    index + 1;

                  const status =
                    tableStatuses[table];

                  return (
                    <button
                      key={table}
                      onClick={() =>
                        setSelectedTable(
                          table
                        )
                      }
                      className={`flex h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border text-sm font-black ${
                        selectedTable ===
                        table
                          ? "border-blue-500 bg-blue-600 text-white"
                          : status ===
                            "offen"
                          ? "border-orange-500/30 bg-orange-500/10 text-orange-500"
                          : status ===
                            "fertig"
                          ? "border-blue-500/30 bg-blue-500/10 text-blue-500"
                          : "border-green-500/30 bg-green-500/10 text-green-500"
                      }`}
                    >
                      {table}
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {/* DASHBOARD OHNE TISCH */}

          {selectedTable === null && (
            <>
              <div className="mb-7">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                  <div>
                    <p className="text-sm font-bold text-blue-500">
                      KELLNER-BEREICH
                    </p>

                    <h1 className="mt-1 text-3xl font-black tracking-tight">
                      Tischübersicht
                    </h1>

                    <p
                      className={`mt-2 text-sm ${
                        dark
                          ? "text-slate-500"
                          : "text-slate-500"
                      }`}
                    >
                      Wähle einen Tisch
                      für eine neue
                      Bestellung oder
                      Zahlung.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div
                  className={`rounded-3xl border p-5 ${cardBackground}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p
                        className={`text-xs font-bold uppercase tracking-wider ${
                          dark
                            ? "text-slate-500"
                            : "text-slate-400"
                        }`}
                      >
                        Frei
                      </p>

                      <p className="mt-2 text-3xl font-black">
                        {freeTables}
                      </p>
                    </div>

                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-500/10 text-xl">
                      ✓
                    </div>
                  </div>
                </div>

                <div
                  className={`rounded-3xl border p-5 ${cardBackground}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p
                        className={`text-xs font-bold uppercase tracking-wider ${
                          dark
                            ? "text-slate-500"
                            : "text-slate-400"
                        }`}
                      >
                        Offen
                      </p>

                      <p className="mt-2 text-3xl font-black">
                        {openTables}
                      </p>
                    </div>

                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10 text-xl">
                      ●
                    </div>
                  </div>
                </div>

                <div
                  className={`rounded-3xl border p-5 ${cardBackground}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p
                        className={`text-xs font-bold uppercase tracking-wider ${
                          dark
                            ? "text-slate-500"
                            : "text-slate-400"
                        }`}
                      >
                        Bezahlbereit
                      </p>

                      <p className="mt-2 text-3xl font-black">
                        {readyTables}
                      </p>
                    </div>

                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-xl">
                      €
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                {Array.from(
                  { length: TABLE_COUNT },
                  (_, index) => {
                    const table =
                      index + 1;

                    const status =
                      tableStatuses[
                        table
                      ];

                    const tableOrders =
                      orders.filter(
                        (order) =>
                          order.table_number ===
                          table
                      );

                    const tableOrderIds =
                      tableOrders.map(
                        (order) =>
                          order.id
                      );

                    const itemCount =
                      orderItems
                        .filter(
                          (item) =>
                            tableOrderIds.includes(
                              item.order_id
                            )
                        )
                        .reduce(
                          (
                            total,
                            item
                          ) =>
                            total +
                            item.quantity,
                          0
                        );

                    return (
                      <button
                        key={table}
                        onClick={() =>
                          setSelectedTable(
                            table
                          )
                        }
                        className={`group min-h-[150px] rounded-3xl border p-5 text-left transition hover:-translate-y-1 hover:shadow-xl ${getStatusClasses(
                          status,
                          dark
                        )}`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-xs font-bold opacity-60">
                              TISCH
                            </div>

                            <div className="mt-1 text-2xl font-black">
                              {table}
                            </div>
                          </div>

                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-lg">
                            {status ===
                            "frei"
                              ? "✓"
                              : status ===
                                "offen"
                              ? "●"
                              : "€"}
                          </div>
                        </div>

                        <div className="mt-7">
                          <div className="text-sm font-bold">
                            {getStatusLabel(
                              status
                            )}
                          </div>

                          {itemCount >
                            0 && (
                            <div className="mt-1 text-xs opacity-60">
                              {itemCount}{" "}
                              Artikel
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
            </>
          )}

          {/* AUSGEWÄHLTER TISCH */}

          {selectedTable !== null && (
            <>
              <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <button
                    onClick={closeTable}
                    className={`mb-3 text-sm font-bold transition hover:text-blue-500 ${
                      dark
                        ? "text-slate-500"
                        : "text-slate-500"
                    }`}
                  >
                    ← Tischübersicht
                  </button>

                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-3xl font-black">
                      Tisch{" "}
                      {selectedTable}
                    </h1>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusClasses(
                        tableStatuses[
                          selectedTable
                        ],
                        dark
                      )}`}
                    >
                      {getStatusLabel(
                        tableStatuses[
                          selectedTable
                        ]
                      )}
                    </span>
                  </div>
                </div>

                {!showPayment &&
                  !showAddOrder && (
                    <div className="flex gap-2">
                      {paymentItems.length >
                        0 && (
                        <button
                          onClick={
                            openPayment
                          }
                          className="rounded-2xl bg-green-600 px-5 py-3 font-black text-white shadow-lg shadow-green-600/20 transition hover:bg-green-700"
                        >
                          💳 Bezahlen
                        </button>
                      )}

                      <button
                        onClick={
                          startAddingOrder
                        }
                        className="rounded-2xl bg-blue-600 px-5 py-3 font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
                      >
                        + Bestellung
                      </button>
                    </div>
                  )}
              </div>

              {/* ZAHLUNG */}

              {showPayment && (
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_430px]">
                  <div
                    className={`rounded-3xl border p-5 md:p-6 ${cardBackground}`}
                  >
                    <div className="mb-6 flex items-start justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-blue-500">
                          Zahlung
                        </p>

                        <h2 className="mt-1 text-2xl font-black">
                          Artikel auswählen
                        </h2>

                        <p
                          className={`mt-1 text-sm ${
                            dark
                              ? "text-slate-500"
                              : "text-slate-500"
                          }`}
                        >
                          Nur die ausgewählten
                          Mengen werden
                          bezahlt.
                        </p>
                      </div>

                      <button
                        onClick={
                          closePayment
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
                            product?.price ??
                            0;

                          return (
                            <div
                              key={
                                item.id
                              }
                              className={`rounded-2xl border p-4 ${
                                dark
                                  ? "border-slate-800 bg-slate-800/40"
                                  : "border-slate-200 bg-slate-50"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-4">
                                <div className="min-w-0">
                                  <div className="font-bold">
                                    {
                                      item.product_name
                                    }
                                  </div>

                                  <div
                                    className={`mt-1 text-sm ${
                                      dark
                                        ? "text-slate-500"
                                        : "text-slate-500"
                                    }`}
                                  >
                                    {
                                      item.remainingQuantity
                                    }{" "}
                                    offen ·{" "}
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
                                    className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-700 text-xl font-black transition hover:bg-slate-600"
                                  >
                                    −
                                  </button>

                                  <div className="w-8 text-center text-lg font-black">
                                    {
                                      selected
                                    }
                                  </div>

                                  <button
                                    onClick={() =>
                                      changePaymentQuantity(
                                        item.id,
                                        1
                                      )
                                    }
                                    className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-xl font-black text-white transition hover:bg-blue-700"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>

                              {selected >
                                0 && (
                                <div className="mt-3 rounded-xl bg-blue-500/10 px-3 py-2 text-sm font-bold text-blue-500">
                                  ✓{" "}
                                  {
                                    selected
                                  }{" "}
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
                    className={`h-fit rounded-3xl border p-6 xl:sticky xl:top-24 ${cardBackground}`}
                  >
                    <p className="text-xs font-black uppercase tracking-widest text-blue-500">
                      Kasse
                    </p>

                    <h2 className="mt-1 text-2xl font-black">
                      Zahlung
                    </h2>

                    <div className="mt-6 grid grid-cols-2 gap-2">
                      <button
                        onClick={() =>
                          setPaymentMethod(
                            "bar"
                          )
                        }
                        className={`rounded-2xl border py-4 font-black transition ${
                          paymentMethod ===
                          "bar"
                            ? "border-green-500 bg-green-500/10 text-green-500"
                            : dark
                            ? "border-slate-700 bg-slate-800"
                            : "border-slate-300 bg-white"
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
                        className={`rounded-2xl border py-4 font-black transition ${
                          paymentMethod ===
                          "karte"
                            ? "border-blue-500 bg-blue-500/10 text-blue-500"
                            : dark
                            ? "border-slate-700 bg-slate-800"
                            : "border-slate-300 bg-white"
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
                      <span
                        className={
                          dark
                            ? "text-slate-500"
                            : "text-slate-500"
                        }
                      >
                        Gesamt
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
                          className={`mt-6 mb-2 block text-sm font-bold ${
                            dark
                              ? "text-slate-400"
                              : "text-slate-600"
                          }`}
                        >
                          Gegeben
                        </label>

                        <input
                          value={
                            cashReceived
                          }
                          onChange={(e) =>
                            setCashReceived(
                              e.target
                                .value
                            )
                          }
                          inputMode="decimal"
                          placeholder="0,00 €"
                          className={`w-full rounded-2xl border px-4 py-4 text-xl font-black outline-none focus:border-blue-500 ${dark ? "border-slate-700 bg-slate-800" : "border-slate-300 bg-white"}`}
                        />

                        <div className="mt-4 flex items-center justify-between rounded-2xl bg-green-500/10 p-4">
                          <span className="font-bold text-green-500">
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
                      <div className="mt-5 rounded-2xl bg-blue-500/10 p-4 text-sm font-medium text-blue-500">
                        💳 Kartenzahlung am
                        Terminal
                        durchführen und
                        anschließend die
                        Zahlung hier
                        bestätigen.
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
                        ? "Wird gespeichert..."
                        : `✓ ${formatPrice(
                            paymentTotal
                          )} kassieren`}
                    </button>

                    <button
                      onClick={
                        closePayment
                      }
                      disabled={saving}
                      className={`mt-3 w-full rounded-2xl border px-5 py-3 font-bold ${
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
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_430px]">
                  <div>
                    <div
                      className={`mb-5 rounded-3xl border p-4 ${cardBackground}`}
                    >
                      <div className="flex flex-col gap-3">
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                            🔎
                          </span>

                          <input
                            value={search}
                            onChange={(e) =>
                              setSearch(
                                e.target
                                  .value
                              )
                            }
                            placeholder="Produkt suchen..."
                            className={`w-full rounded-2xl border py-4 pl-11 pr-4 font-medium outline-none focus:border-blue-500 ${
                              dark
                                ? "border-slate-700 bg-slate-800"
                                : "border-slate-300 bg-white"
                            }`}
                          />
                        </div>

                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {categories.map(
                            (cat) => (
                              <button
                                key={cat}
                                onClick={() =>
                                  setCategory(
                                    cat
                                  )
                                }
                                className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                                  category ===
                                  cat
                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                                    : dark
                                    ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                }`}
                              >
                                {cat ===
                                "alle"
                                  ? "Alle"
                                  : cat}
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-black">
                          Produkte
                        </h2>

                        <p
                          className={`text-sm ${
                            dark
                              ? "text-slate-500"
                              : "text-slate-500"
                          }`}
                        >
                          {filteredProducts.length}{" "}
                          Produkte
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          setSearch("");
                          setCategory(
                            "alle"
                          );
                        }}
                        className={`rounded-xl px-3 py-2 text-xs font-bold ${
                          dark
                            ? "bg-slate-800 text-slate-400"
                            : "bg-white text-slate-500"
                        }`}
                      >
                        Zurücksetzen
                      </button>
                    </div>

                    {filteredProducts.length ===
                    0 ? (
                      <div
                        className={`rounded-3xl border p-12 text-center ${cardBackground}`}
                      >
                        <div className="text-4xl">
                          🔎
                        </div>

                        <h3 className="mt-3 font-black">
                          Kein Produkt
                          gefunden
                        </h3>

                        <p
                          className={`mt-1 text-sm ${
                            dark
                              ? "text-slate-500"
                              : "text-slate-500"
                          }`}
                        >
                          Ändere die
                          Suche oder
                          Kategorie.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
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
                              className={`group min-h-[145px] rounded-3xl border p-4 text-left transition hover:-translate-y-1 hover:border-blue-500 hover:shadow-xl ${cardBackground}`}
                            >
                              <div className="flex h-full flex-col justify-between">
                                <div>
                                  <div className="font-bold leading-snug">
                                    {
                                      product.name
                                    }
                                  </div>

                                  <div
                                    className={`mt-2 text-xs ${
                                      dark
                                        ? "text-slate-600"
                                        : "text-slate-400"
                                    }`}
                                  >
                                    {
                                      product.category
                                    }
                                  </div>
                                </div>

                                <div className="mt-5 flex items-center justify-between">
                                  <span className="font-black text-blue-500">
                                    {formatPrice(
                                      product.price
                                    )}
                                  </span>

                                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-lg font-black text-blue-500 transition group-hover:bg-blue-600 group-hover:text-white">
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
                    className={`h-fit rounded-3xl border p-5 xl:sticky xl:top-24 ${cardBackground}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p
                          className={`text-xs font-black uppercase tracking-widest ${
                            dark
                              ? "text-slate-600"
                              : "text-slate-400"
                          }`}
                        >
                          Tisch{" "}
                          {selectedTable}
                        </p>

                        <h2 className="mt-1 text-2xl font-black">
                          Bestellung
                        </h2>
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

                    <div className="mt-5 max-h-[500px] space-y-3 overflow-y-auto">
                      {cart.length === 0 ? (
                        <div
                          className={`rounded-2xl border border-dashed p-8 text-center ${
                            dark
                              ? "border-slate-700"
                              : "border-slate-300"
                          }`}
                        >
                          <div className="text-3xl">
                            🛒
                          </div>

                          <p
                            className={`mt-3 text-sm ${
                              dark
                                ? "text-slate-500"
                                : "text-slate-500"
                            }`}
                          >
                            Noch keine
                            Artikel
                            ausgewählt.
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
                              className={`rounded-2xl border p-4 ${
                                dark
                                  ? "border-slate-800 bg-slate-800/40"
                                  : "border-slate-200 bg-slate-50"
                              }`}
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
                                    className={`mt-1 text-xs ${
                                      dark
                                        ? "text-slate-500"
                                        : "text-slate-500"
                                    }`}
                                  >
                                    {formatPrice(
                                      cartItem
                                        .product
                                        .price
                                    )}{" "}
                                    / Stück
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
                                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-700 text-lg font-black hover:bg-slate-600"
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
                                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-lg font-black text-white hover:bg-blue-700"
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
                        <span
                          className={
                            dark
                              ? "text-slate-500"
                              : "text-slate-500"
                          }
                        >
                          Gesamt
                        </span>

                        <span className="text-2xl font-black">
                          {formatPrice(
                            cartTotal
                          )}
                        </span>
                      </div>

                      <button
                        onClick={
                          createNewOrder
                        }
                        disabled={
                          saving ||
                          cart.length ===
                            0
                        }
                        className="mt-5 w-full rounded-2xl bg-blue-600 px-5 py-4 font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {saving
                          ? "Wird gespeichert..."
                          : "✓ Bestellung speichern"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TISCH DETAIL */}

              {!showPayment &&
                !showAddOrder && (
                  <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_430px]">
                    <div
                      className={`rounded-3xl border p-5 md:p-6 ${cardBackground}`}
                    >
                      <div className="mb-5 flex items-center justify-between">
                        <div>
                          <p
                            className={`text-xs font-black uppercase tracking-widest ${
                              dark
                                ? "text-slate-600"
                                : "text-slate-400"
                            }`}
                          >
                            Aktuelle Bestellung
                          </p>

                          <h2 className="mt-1 text-2xl font-black">
                            Artikel
                          </h2>
                        </div>

                        {selectedTableItems.length >
                          0 && (
                          <span
                            className={`rounded-xl px-3 py-2 text-xs font-black ${softBackground}`}
                          >
                            {
                              selectedTableItems.length
                            }{" "}
                            Positionen
                          </span>
                        )}
                      </div>

                      {selectedTableItems.length ===
                      0 ? (
                        <div
                          className={`rounded-3xl border border-dashed p-12 text-center ${
                            dark
                              ? "border-slate-700"
                              : "border-slate-300"
                          }`}
                        >
                          <div className="text-4xl">
                            🍽️
                          </div>

                          <h3 className="mt-4 text-lg font-black">
                            Tisch ist frei
                          </h3>

                          <p
                            className={`mx-auto mt-1 max-w-sm text-sm ${
                              dark
                                ? "text-slate-500"
                                : "text-slate-500"
                            }`}
                          >
                            Füge eine neue
                            Bestellung
                            hinzu, um den
                            Tisch zu
                            belegen.
                          </p>

                          <button
                            onClick={
                              startAddingOrder
                            }
                            className="mt-5 rounded-2xl bg-blue-600 px-5 py-3 font-black text-white"
                          >
                            + Bestellung aufnehmen
                          </button>
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
                                  className={`rounded-2xl border p-4 ${
                                    dark
                                      ? "border-slate-800 bg-slate-800/30"
                                      : "border-slate-200 bg-slate-50"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-4">
                                    <div>
                                      <div className="font-bold">
                                        {
                                          item.product_name
                                        }
                                      </div>

                                      <div
                                        className={`mt-1 text-sm ${
                                          dark
                                            ? "text-slate-500"
                                            : "text-slate-500"
                                        }`}
                                      >
                                        Menge{" "}
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
                                        className={`text-xs ${
                                          dark
                                            ? "text-slate-600"
                                            : "text-slate-400"
                                        }`}
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

                    <div
                      className={`h-fit rounded-3xl border p-5 xl:sticky xl:top-24 ${cardBackground}`}
                    >
                      <p className="text-xs font-black uppercase tracking-widest text-blue-500">
                        Aktionen
                      </p>

                      <h2 className="mt-1 text-2xl font-black">
                        Tisch{" "}
                        {selectedTable}
                      </h2>

                      {selectedTableItems.length >
                        0 && (
                        <div
                          className={`mt-5 rounded-2xl p-4 ${softBackground}`}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={
                                dark
                                  ? "text-slate-500"
                                  : "text-slate-500"
                              }
                            >
                              Offene Artikel
                            </span>

                            <span className="text-xl font-black">
                              {
                                tableOpenItemCount
                              }
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
                            ? "Wird gespeichert..."
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
                          💳 Zahlung öffnen
                        </button>
                      )}

                      {selectedTableItems.length >
                        0 && (
                        <button
                          onClick={
                            startAddingOrder
                          }
                          className="mt-3 w-full rounded-2xl bg-orange-500 px-5 py-4 font-black text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600"
                        >
                          + Weitere Artikel
                        </button>
                      )}
                    </div>
                  </div>
                )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}