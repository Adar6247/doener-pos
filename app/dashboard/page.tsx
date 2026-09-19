"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Product = {
  id: number;
  name: string;
  price: number;
  category: string;
  created_at: string;
};

type CartItem = {
  id: number;
  name: string;
  price: number;
  quantity: number;
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
};

type FinishedNotification = {
  id: number;
  tableNumber: number;
};

type TableStatus = "frei" | "offen" | "fertig";

const TABLES = Array.from({ length: 25 }, (_, index) => index + 1);

export default function Dashboard() {
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);

  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    null
  );

  const [cart, setCart] = useState<CartItem[]>([]);
  const [currentOrderItems, setCurrentOrderItems] = useState<OrderItem[]>([]);
  const [currentOpenOrder, setCurrentOpenOrder] = useState<Order | null>(null);

  const [search, setSearch] = useState("");

  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<
    "success" | "error" | "info"
  >("info");

  const [notifications, setNotifications] = useState<
    FinishedNotification[]
  >([]);

  /*
   * ============================================================
   * BENUTZER LADEN
   * ============================================================
   */

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        console.error("LOGIN USER FEHLER:", {
          message: error.message,
          code: error.code,
        });
      }

      if (!user) {
        window.location.href = "/";
        return;
      }

      setEmail(user.email ?? "");
      setUserId(user.id);
    }

    loadUser();
  }, []);

  /*
   * ============================================================
   * PRODUKTE LADEN
   * ============================================================
   */

  async function loadProducts() {
    setLoadingProducts(true);

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("PRODUKTE FEHLER:", {
        message: error.message,
        code: error.code,
      });

      showMessage(
        "Die Produkte konnten nicht geladen werden.",
        "error"
      );

      setLoadingProducts(false);
      return;
    }

    setProducts(data ?? []);
    setLoadingProducts(false);
  }

  useEffect(() => {
    loadProducts();
  }, []);

  /*
   * ============================================================
   * BESTELLUNGEN LADEN
   * ============================================================
   */

  async function loadOrders() {
    setLoadingOrders(true);

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("BESTELLUNGEN FEHLER:", {
        message: error.message,
        code: error.code,
      });

      showMessage(
        "Die Bestellungen konnten nicht geladen werden.",
        "error"
      );

      setLoadingOrders(false);
      return;
    }

    setOrders((data ?? []) as Order[]);
    setLoadingOrders(false);
  }

  useEffect(() => {
    loadOrders();
  }, []);

  /*
   * ============================================================
   * REALTIME BESTELLUNGEN
   * ============================================================
   */

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`waiter-orders-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        async (payload) => {
          const newOrder = payload.new as Partial<Order>;
          const oldOrder = payload.old as Partial<Order>;

          if (
            payload.eventType === "UPDATE" &&
            oldOrder.status === "offen" &&
            newOrder.status === "fertig" &&
            newOrder.id &&
            newOrder.table_number
          ) {
            setNotifications((current) => {
              if (
                current.some(
                  (notification) =>
                    notification.id === newOrder.id
                )
              ) {
                return current;
              }

              return [
                ...current,
                {
                  id: newOrder.id!,
                  tableNumber: newOrder.table_number!,
                },
              ];
            });

            showMessage(
              `Tisch ${newOrder.table_number} ist fertig.`,
              "success"
            );
          }

          await loadOrders();

          if (
            selectedTable !== null &&
            newOrder.table_number === selectedTable
          ) {
            await loadSelectedTable(selectedTable);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, selectedTable]);

  /*
   * ============================================================
   * REALTIME ORDER ITEMS
   * ============================================================
   */

  useEffect(() => {
    const channel = supabase
      .channel("waiter-order-items")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "order_items",
        },
        async () => {
          if (selectedTable !== null) {
            await loadSelectedTable(selectedTable);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedTable]);

  /*
   * ============================================================
   * NACHRICHTEN
   * ============================================================
   */

  function showMessage(
    text: string,
    type: "success" | "error" | "info"
  ) {
    setMessage(text);
    setMessageType(type);
  }

  /*
   * ============================================================
   * BESTELLUNG EINES TISCHES LADEN
   * ============================================================
   */

  async function loadSelectedTable(table: number) {
    const tableOrders = orders
      .filter((order) => order.table_number === table)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
      );

    const openOrder =
      tableOrders.find((order) => order.status === "offen") ?? null;

    setCurrentOpenOrder(openOrder);

    if (!openOrder) {
      setCurrentOrderItems([]);
      return;
    }

    const { data, error } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", openOrder.id)
      .order("id", { ascending: true });

    if (error) {
      console.error("ORDER ITEMS FEHLER:", {
        message: error.message,
        code: error.code,
      });

      setCurrentOrderItems([]);
      return;
    }

    setCurrentOrderItems((data ?? []) as OrderItem[]);
  }

  /*
   * ============================================================
   * TISCH AUSWÄHLEN
   * ============================================================
   */

  async function selectTable(table: number) {
    setSelectedTable(table);
    setSelectedCategory(null);
    setSearch("");
    setCart([]);
    setMessage("");

    await loadSelectedTable(table);
  }

  /*
   * ============================================================
   * TISCHSTATUS
   * ============================================================
   */

  function getTableStatus(table: number): TableStatus {
    const tableOrders = orders
      .filter((order) => order.table_number === table)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
      );

    const openOrder = tableOrders.find(
      (order) => order.status === "offen"
    );

    if (openOrder) {
      return "offen";
    }

    const latestOrder = tableOrders[0];

    if (latestOrder?.status === "fertig") {
      return "fertig";
    }

    return "frei";
  }

  /*
   * ============================================================
   * TISCHSTATISTIK
   * ============================================================
   */

  const tableStats = useMemo(() => {
    let free = 0;
    let open = 0;
    let ready = 0;

    TABLES.forEach((table) => {
      const status = getTableStatus(table);

      if (status === "frei") free++;
      if (status === "offen") open++;
      if (status === "fertig") ready++;
    });

    return {
      free,
      open,
      ready,
    };
  }, [orders]);

  /*
   * ============================================================
   * KATEGORIEN
   * ============================================================
   */

  const categories = useMemo(() => {
    return Array.from(
      new Set(
        products
          .map((product) => product.category)
          .filter(
            (category) =>
              category && category.trim() !== ""
          )
      )
    );
  }, [products]);

  /*
   * ============================================================
   * PRODUKTE FILTERN
   * ============================================================
   */

  const visibleProducts = useMemo(() => {
    let result = products;

    if (selectedCategory) {
      result = result.filter(
        (product) =>
          product.category === selectedCategory
      );
    }

    if (search.trim()) {
      const searchTerm = search.toLowerCase();

      result = result.filter((product) =>
        product.name.toLowerCase().includes(searchTerm)
      );
    }

    return result;
  }, [products, selectedCategory, search]);

  /*
   * ============================================================
   * PRODUKT IN WARENKORB
   * ============================================================
   */

  function addToCart(product: Product) {
    setCart((currentCart) => {
      const existing = currentCart.find(
        (item) => item.id === product.id
      );

      if (existing) {
        return currentCart.map((item) =>
          item.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item
        );
      }

      return [
        ...currentCart,
        {
          id: product.id,
          name: product.name,
          price: Number(product.price),
          quantity: 1,
        },
      ];
    });
  }

  /*
   * ============================================================
   * MENGE ÄNDERN
   * ============================================================
   */

  function increaseQuantity(productId: number) {
    setCart((currentCart) =>
      currentCart.map((item) =>
        item.id === productId
          ? {
              ...item,
              quantity: item.quantity + 1,
            }
          : item
      )
    );
  }

  function decreaseQuantity(productId: number) {
    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.id === productId
            ? {
                ...item,
                quantity: item.quantity - 1,
              }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  /*
   * ============================================================
   * WARENKORB
   * ============================================================
   */

  const cartItemCount = cart.reduce(
    (total, item) => total + item.quantity,
    0
  );

  const cartTotal = cart.reduce(
    (total, item) =>
      total + item.price * item.quantity,
    0
  );

  /*
   * ============================================================
   * BESTEHENDE BESTELLUNG
   * ============================================================
   */

  const existingOrderTotal = currentOrderItems.reduce(
    (total, item) => {
      const product = products.find(
        (product) => product.name === item.product_name
      );

      if (!product) return total;

      return (
        total +
        Number(product.price) * item.quantity
      );
    },
    0
  );

  /*
   * ============================================================
   * BESTELLUNG ABSENDEN
   * ============================================================
   */

  async function submitOrder() {
    if (!selectedTable) {
      showMessage(
        "Bitte zuerst einen Tisch auswählen.",
        "error"
      );
      return;
    }

    if (cart.length === 0) {
      showMessage(
        "Bitte mindestens ein Produkt auswählen.",
        "error"
      );
      return;
    }

    setSending(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("USER FEHLER:", userError);

      setSending(false);

      showMessage(
        "Du bist nicht richtig angemeldet.",
        "error"
      );

      return;
    }

    let orderId: number;

    /*
     * Wenn bereits eine offene Bestellung existiert,
     * werden die neuen Artikel dort hinzugefügt.
     */

    if (currentOpenOrder) {
      orderId = currentOpenOrder.id;
    } else {
      /*
       * Neue Bestellung erstellen
       */

      const {
        data: order,
        error: orderError,
      } = await supabase
        .from("orders")
        .insert({
          table_number: selectedTable,
          waiter_id: user.id,
          status: "offen",
        })
        .select()
        .single();

      if (orderError || !order) {
        console.error("BESTELLUNG FEHLER:", {
          message: orderError?.message,
          code: orderError?.code,
        });

        setSending(false);

        showMessage(
          orderError?.message ||
            "Die Bestellung konnte nicht gespeichert werden.",
          "error"
        );

        return;
      }

      orderId = order.id;
    }

    /*
     * Artikel speichern
     */

    const orderItems = cart.map((item) => ({
      order_id: orderId,
      product_name: item.name,
      quantity: item.quantity,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemsError) {
      console.error("ARTIKEL FEHLER:", {
        message: itemsError.message,
        code: itemsError.code,
      });

      setSending(false);

      showMessage(
        itemsError.message ||
          "Die Produkte konnten nicht gespeichert werden.",
        "error"
      );

      return;
    }

    /*
     * Alles aktualisieren
     */

    setCart([]);
    setSending(false);

    await loadOrders();

    const refreshedOrders = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (!refreshedOrders.error) {
      setOrders(
        (refreshedOrders.data ?? []) as Order[]
      );
    }

    showMessage(
      `Bestellung für Tisch ${selectedTable} wurde an die Küche gesendet.`,
      "success"
    );

    /*
     * Bestehende Bestellung neu laden
     */

    const { data: refreshedItems } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId)
      .order("id", { ascending: true });

    setCurrentOrderItems(
      (refreshedItems ?? []) as OrderItem[]
    );

    const refreshedOrder = (
      refreshedOrders.data ?? []
    ).find((order) => order.id === orderId);

    setCurrentOpenOrder(
      (refreshedOrder as Order) ?? currentOpenOrder
    );
  }

  /*
   * ============================================================
   * NEUEN TISCH / BESTELLUNG
   * ============================================================
   */

  function changeTable() {
    setSelectedTable(null);
    setSelectedCategory(null);
    setSearch("");
    setCart([]);
    setCurrentOrderItems([]);
    setCurrentOpenOrder(null);
    setMessage("");
  }

  /*
   * ============================================================
   * LOGOUT
   * ============================================================
   */

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  /*
   * ============================================================
   * BENACHRICHTIGUNG ENTFERNEN
   * ============================================================
   */

  function removeNotification(id: number) {
    setNotifications((current) =>
      current.filter(
        (notification) =>
          notification.id !== id
      )
    );
  }

  /*
   * ============================================================
   * PREIS FORMATIEREN
   * ============================================================
   */

  function formatPrice(price: number) {
    return (
      Number(price)
        .toFixed(2)
        .replace(".", ",") + " €"
    );
  }

  /*
   * ============================================================
   * TISCH NICHT AUSGEWÄHLT
   * ============================================================
   */

  if (selectedTable === null) {
    return (
      <main className="min-h-screen bg-[#f4f5f7] text-slate-900">
        {/* ==================================================
            HEADER
        ================================================== */}

        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-6 lg:px-8 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-lg">
              D
            </div>

            <div>
              <h1 className="font-bold text-xl tracking-tight">
                Döner POS
              </h1>

              <p className="text-xs text-slate-500">
                Kasse · Tischübersicht
              </p>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-semibold">
                Kellner
              </p>

              <p className="text-xs text-slate-500">
                {email}
              </p>
            </div>

            <div className="w-px h-9 bg-slate-200 hidden sm:block" />

            <button
              onClick={logout}
              className="px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Abmelden
            </button>
          </div>
        </header>

        {/* ==================================================
            CONTENT
        ================================================== */}

        <div className="max-w-[1500px] mx-auto p-5 lg:p-8">
          <div className="mb-8">
            <p className="text-sm font-semibold text-slate-500 mb-1">
              TISCHVERWALTUNG
            </p>

            <h2 className="text-3xl font-bold tracking-tight">
              Guten Tag
            </h2>

            <p className="text-slate-500 mt-1">
              Wähle einen Tisch, um eine Bestellung aufzunehmen.
            </p>
          </div>

          {/* ==================================================
              STATUS LEISTE
          ================================================== */}

          <div className="grid grid-cols-3 gap-3 mb-7 max-w-2xl">
            <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />

                <div>
                  <p className="text-xs uppercase tracking-wide font-semibold text-slate-500">
                    Frei
                  </p>

                  <p className="text-2xl font-bold mt-0.5">
                    {tableStats.free}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-amber-500" />

                <div>
                  <p className="text-xs uppercase tracking-wide font-semibold text-slate-500">
                    Offen
                  </p>

                  <p className="text-2xl font-bold mt-0.5">
                    {tableStats.open}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-blue-500" />

                <div>
                  <p className="text-xs uppercase tracking-wide font-semibold text-slate-500">
                    Fertig
                  </p>

                  <p className="text-2xl font-bold mt-0.5">
                    {tableStats.ready}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ==================================================
              TISCHPLAN
          ================================================== */}

          <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="font-bold text-lg">
                  Tischplan
                </h3>

                <p className="text-sm text-slate-500 mt-1">
                  25 Tische · Klicke einen Tisch an
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-500">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Frei
                </div>

                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  Bestellung offen
                </div>

                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  Fertig
                </div>
              </div>
            </div>

            <div className="p-5 lg:p-7">
              {loadingOrders ? (
                <div className="py-16 text-center">
                  <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin mx-auto mb-4" />

                  <p className="text-sm font-semibold text-slate-600">
                    Tische werden geladen...
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {TABLES.map((table) => {
                    const status = getTableStatus(table);

                    const styles = {
                      frei: {
                        border:
                          "border-emerald-200 hover:border-emerald-400",
                        bg: "bg-emerald-50/40 hover:bg-emerald-50",
                        dot: "bg-emerald-500",
                        text: "text-emerald-700",
                        label: "Frei",
                      },

                      offen: {
                        border:
                          "border-amber-200 hover:border-amber-400",
                        bg: "bg-amber-50/50 hover:bg-amber-50",
                        dot: "bg-amber-500",
                        text: "text-amber-700",
                        label: "Bestellung offen",
                      },

                      fertig: {
                        border:
                          "border-blue-200 hover:border-blue-400",
                        bg: "bg-blue-50/50 hover:bg-blue-50",
                        dot: "bg-blue-500",
                        text: "text-blue-700",
                        label: "Fertig",
                      },
                    }[status];

                    return (
                      <button
                        key={table}
                        onClick={() => selectTable(table)}
                        className={`relative min-h-[145px] rounded-xl border-2 ${styles.border} ${styles.bg} p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Tisch
                          </span>

                          <span
                            className={`w-3 h-3 rounded-full ${styles.dot}`}
                          />
                        </div>

                        <div className="mt-5">
                          <span className="text-3xl font-bold">
                            {table}
                          </span>
                        </div>

                        <div
                          className={`mt-2 text-xs font-semibold ${styles.text}`}
                        >
                          {styles.label}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* ==================================================
            NOTIFICATIONS
        ================================================== */}

        {notifications.length > 0 && (
          <div className="fixed bottom-5 right-5 z-50 w-full max-w-sm space-y-3 px-4 sm:px-0">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className="bg-slate-900 text-white rounded-xl shadow-2xl p-5 border border-slate-700"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 text-blue-300 flex items-center justify-center font-bold">
                    ✓
                  </div>

                  <div className="flex-1">
                    <p className="font-bold">
                      Bestellung fertig
                    </p>

                    <p className="text-sm text-slate-300 mt-1">
                      Tisch {notification.tableNumber} kann abgeholt werden.
                    </p>

                    <button
                      onClick={() =>
                        selectTable(notification.tableNumber)
                      }
                      className="mt-3 text-sm font-semibold text-blue-300 hover:text-blue-200"
                    >
                      Tisch öffnen →
                    </button>
                  </div>

                  <button
                    onClick={() =>
                      removeNotification(notification.id)
                    }
                    className="text-slate-400 hover:text-white"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    );
  }

  /*
   * ============================================================
   * BESTELLUNGSSEITE
   * ============================================================
   */

  return (
    <main className="min-h-screen bg-[#f4f5f7] text-slate-900">
      {/* ======================================================
          TOP HEADER
      ====================================================== */}

      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={changeTable}
            className="h-10 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 font-semibold text-sm"
          >
            ← Tischplan
          </button>

          <div className="h-7 w-px bg-slate-200 hidden sm:block" />

          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
              Aktueller Tisch
            </p>

            <p className="font-bold">
              Tisch {selectedTable}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 text-xs font-semibold text-emerald-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Online
          </div>

          <div className="hidden sm:block h-7 w-px bg-slate-200" />

          <span className="hidden sm:block text-sm text-slate-500">
            {email}
          </span>

          <button
            onClick={logout}
            className="h-9 px-3 rounded-lg border border-slate-200 text-sm font-semibold hover:bg-slate-50"
          >
            Abmelden
          </button>
        </div>
      </header>

      {/* ======================================================
          HAUPT LAYOUT
      ====================================================== */}

      <div className="h-[calc(100vh-4rem)] flex flex-col lg:flex-row overflow-hidden">
        {/* ====================================================
            LINKE SEITE
        ==================================================== */}

        <section className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* TABLE BAR */}

          <div className="bg-white border-b border-slate-200 px-4 lg:px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider font-bold text-slate-400">
                  Bestellung
                </p>

                <div className="flex items-center gap-3 mt-1">
                  <h2 className="text-2xl font-bold">
                    Tisch {selectedTable}
                  </h2>

                  {currentOpenOrder ? (
                    <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                      Offen
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                      Neue Bestellung
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={changeTable}
                className="hidden sm:block px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold hover:bg-slate-50"
              >
                Tisch wechseln
              </button>
            </div>
          </div>

          {/* SEARCH */}

          <div className="bg-white border-b border-slate-200 px-4 lg:px-6 py-3">
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Produkt suchen..."
                className="w-full h-11 rounded-lg border border-slate-200 bg-slate-50 px-4 pr-10 text-sm outline-none focus:border-slate-400 focus:bg-white transition"
              />

              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                ⌕
              </span>
            </div>
          </div>

          {/* CATEGORY BAR */}

          <div className="bg-white border-b border-slate-200 px-4 lg:px-6 py-3 overflow-x-auto">
            <div className="flex gap-2 min-w-max">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                  selectedCategory === null
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Alle
              </button>

              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() =>
                    setSelectedCategory(category)
                  }
                  className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition ${
                    selectedCategory === category
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* PRODUCTS */}

          <div className="flex-1 overflow-y-auto p-4 lg:p-6">
            {loadingProducts ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin mx-auto mb-4" />

                  <p className="text-sm font-semibold text-slate-500">
                    Produkte werden geladen...
                  </p>
                </div>
              </div>
            ) : visibleProducts.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
                <p className="font-semibold text-slate-700">
                  Keine Produkte gefunden
                </p>

                <p className="text-sm text-slate-500 mt-1">
                  Versuche eine andere Kategorie oder Suche.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {visibleProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="group bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-slate-400 hover:shadow-md transition-all active:scale-[0.99]"
                  >
                    <div className="min-h-[58px]">
                      <h3 className="font-semibold text-sm leading-5 text-slate-800">
                        {product.name}
                      </h3>
                    </div>

                    <div className="flex items-end justify-between gap-2 mt-5">
                      <span className="font-bold text-base">
                        {formatPrice(
                          Number(product.price)
                        )}
                      </span>

                      <span className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-slate-900 group-hover:text-white flex items-center justify-center text-lg transition">
                        +
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ====================================================
            RECHTE BESTELLUNG
        ==================================================== */}

        <aside className="w-full lg:w-[390px] xl:w-[430px] bg-white border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col shrink-0">
          {/* ORDER HEADER */}

          <div className="px-5 py-5 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider font-bold text-slate-400">
                  Aktuelle Bestellung
                </p>

                <h3 className="text-xl font-bold mt-1">
                  Tisch {selectedTable}
                </h3>
              </div>

              <div className="text-right">
                <p className="text-xs text-slate-400">
                  Artikel
                </p>

                <p className="font-bold text-lg">
                  {currentOrderItems.reduce(
                    (total, item) =>
                      total + item.quantity,
                    0
                  ) + cartItemCount}
                </p>
              </div>
            </div>
          </div>

          {/* ORDER CONTENT */}

          <div className="flex-1 overflow-y-auto">
            {/* EXISTING ORDER */}

            {currentOpenOrder &&
              currentOrderItems.length > 0 && (
                <div className="p-5 border-b border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs uppercase tracking-wider font-bold text-slate-400">
                      Bereits bestellt
                    </p>

                    <span className="text-xs font-semibold text-amber-600">
                      Küche
                    </span>
                  </div>

                  <div className="space-y-2">
                    {currentOrderItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 py-2"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-7 h-7 shrink-0 rounded-md bg-slate-100 flex items-center justify-center text-xs font-bold">
                            {item.quantity}×
                          </span>

                          <span className="text-sm font-medium truncate">
                            {item.product_name}
                          </span>
                        </div>

                        <span className="text-sm font-semibold text-slate-500">
                          {(() => {
                            const product =
                              products.find(
                                (product) =>
                                  product.name ===
                                  item.product_name
                              );

                            return product
                              ? formatPrice(
                                  Number(
                                    product.price
                                  ) *
                                    item.quantity
                                )
                              : "—";
                          })()}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-slate-100 mt-3 pt-3 flex justify-between text-sm">
                    <span className="text-slate-500">
                      Aktueller Gesamtwert
                    </span>

                    <span className="font-bold">
                      {formatPrice(
                        existingOrderTotal
                      )}
                    </span>
                  </div>
                </div>
              )}

            {/* NEW ITEMS */}

            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs uppercase tracking-wider font-bold text-slate-400">
                  Neue Artikel
                </p>

                {cart.length > 0 && (
                  <button
                    onClick={() => setCart([])}
                    className="text-xs font-semibold text-red-500 hover:text-red-700"
                  >
                    Leeren
                  </button>
                )}
              </div>

              {cart.length === 0 ? (
                <div className="border border-dashed border-slate-300 rounded-xl p-8 text-center">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400 text-xl">
                    +
                  </div>

                  <p className="text-sm font-semibold text-slate-600">
                    Noch keine neuen Artikel
                  </p>

                  <p className="text-xs text-slate-400 mt-1">
                    Wähle links Produkte aus.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="border border-slate-200 rounded-xl p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm leading-5">
                            {item.name}
                          </p>

                          <p className="text-xs text-slate-500 mt-1">
                            {formatPrice(item.price)} pro Stück
                          </p>
                        </div>

                        <p className="font-bold text-sm whitespace-nowrap">
                          {formatPrice(
                            item.price *
                              item.quantity
                          )}
                        </p>
                      </div>

                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
                          <button
                            onClick={() =>
                              decreaseQuantity(
                                item.id
                              )
                            }
                            className="w-9 h-8 bg-slate-50 hover:bg-slate-100 font-bold"
                          >
                            −
                          </button>

                          <span className="w-9 text-center text-sm font-bold">
                            {item.quantity}
                          </span>

                          <button
                            onClick={() =>
                              increaseQuantity(
                                item.id
                              )
                            }
                            className="w-9 h-8 bg-slate-50 hover:bg-slate-100 font-bold"
                          >
                            +
                          </button>
                        </div>

                        <button
                          onClick={() =>
                            setCart((currentCart) =>
                              currentCart.filter(
                                (cartItem) =>
                                  cartItem.id !==
                                  item.id
                              )
                            )
                          }
                          className="text-xs font-semibold text-red-500 hover:text-red-700"
                        >
                          Entfernen
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ORDER FOOTER */}

          <div className="border-t border-slate-200 p-5 bg-slate-50">
            {message && (
              <div
                className={`mb-4 rounded-lg px-4 py-3 text-sm font-semibold ${
                  messageType === "success"
                    ? "bg-emerald-100 text-emerald-800"
                    : messageType === "error"
                    ? "bg-red-100 text-red-800"
                    : "bg-blue-100 text-blue-800"
                }`}
              >
                {message}
              </div>
            )}

            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs uppercase tracking-wider font-bold text-slate-400">
                  Neue Artikel
                </p>

                <p className="text-sm text-slate-500 mt-0.5">
                  {cartItemCount} Artikel
                </p>
              </div>

              <p className="text-2xl font-bold">
                {formatPrice(cartTotal)}
              </p>
            </div>

            <button
              onClick={submitOrder}
              disabled={
                cart.length === 0 || sending
              }
              className="w-full h-12 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed transition"
            >
              {sending
                ? "Wird gesendet..."
                : currentOpenOrder
                ? "Weitere Artikel senden"
                : "Bestellung senden"}
            </button>

            <button
              onClick={changeTable}
              className="w-full h-10 mt-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-white border border-transparent hover:border-slate-200 transition"
            >
              Tisch wechseln
            </button>
          </div>
        </aside>
      </div>

      {/* ======================================================
          NOTIFICATIONS
      ====================================================== */}

      {notifications.length > 0 && (
        <div className="fixed bottom-5 right-5 z-[100] w-full max-w-sm space-y-3 px-4 sm:px-0">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className="bg-slate-900 text-white rounded-xl shadow-2xl p-5 border border-slate-700"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 shrink-0 rounded-lg bg-blue-500/20 text-blue-300 flex items-center justify-center font-bold">
                  ✓
                </div>

                <div className="flex-1">
                  <p className="font-bold">
                    Bestellung fertig
                  </p>

                  <p className="text-sm text-slate-300 mt-1">
                    Tisch {notification.tableNumber} kann abgeholt werden.
                  </p>

                  <button
                    onClick={() =>
                      selectTable(
                        notification.tableNumber
                      )
                    }
                    className="mt-3 text-sm font-semibold text-blue-300 hover:text-blue-200"
                  >
                    Tisch öffnen →
                  </button>
                </div>

                <button
                  onClick={() =>
                    removeNotification(
                      notification.id
                    )
                  }
                  className="text-slate-400 hover:text-white text-xl"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}