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

  const tableOrderIds = tableOrders.map(
    (order) => order.id
  );

  const hasUnpaidItems = orderItems.some(
    (item) =>
      tableOrderIds.includes(item.order_id) &&
      item.paid_quantity < item.quantity
  );

  if (hasUnpaidItems) {
    return "fertig";
  }

  return "frei";
}

export default function DashboardPage() {
  const { theme, setTheme } = useTheme();

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
        .order("created_at", {
          ascending: true,
        }),

      supabase
        .from("order_items")
        .select("*")
        .order("id", {
          ascending: true,
        }),
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

      if (!mounted) {
        return;
      }

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

    const orderItemsChannel = supabase
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
      supabase.removeChannel(orderItemsChannel);
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
      (total, cartItem) =>
        total +
        cartItem.product.price *
          cartItem.quantity,
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

      if (!item) {
        continue;
      }

      const product = products.find(
        (productItem) =>
          productItem.name ===
          item.product_name
      );

      if (!product) {
        continue;
      }

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
    Number(cashReceived.replace(",", ".")) || 0;

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
            "Die Bestellung wurde nicht erstellt."
          );
        }

        orderId = newOrder.id;
      }

      for (const cartItem of cart) {
        const { data: existingItem, error: findError } =
          await supabase
            .from("order_items")
            .select("*")
            .eq("order_id", orderId)
            .eq(
              "product_name",
              cartItem.product.name
            )
            .maybeSingle();

        if (findError) {
          throw findError;
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
        "Fehler beim Speichern der Bestellung:",
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
      const { error } = await supabase
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

  function getSelectedQuantity(
    itemId: number
  ): number {
    const selection =
      paymentSelection.find(
        (item) => item.itemId === itemId
      );

    return selection?.quantity ?? 0;
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
      /*
       * Wir arbeiten mit einer Kopie des aktuellen
       * lokalen Zustands.
       */
      let updatedItems: OrderItem[] = [
        ...orderItems,
      ];

      /*
       * Jede ausgewählte Position einzeln bezahlen.
       */
      for (const selection of paymentSelection) {
        const currentItem =
          updatedItems.find(
            (item) =>
              item.id === selection.itemId
          );

        if (!currentItem) {
          continue;
        }

        const availableQuantity =
          currentItem.quantity -
          currentItem.paid_quantity;

        const quantityToPay = Math.min(
          selection.quantity,
          availableQuantity
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

        const newPaidAt = fullyPaid
          ? new Date().toISOString()
          : currentItem.paid_at;

        /*
         * WICHTIG:
         * Wir bekommen den tatsächlich gespeicherten
         * Datensatz direkt von Supabase zurück.
         */
        const {
          data: updatedItem,
          error,
        } = await supabase
          .from("order_items")
          .update({
            paid_quantity:
              newPaidQuantity,
            paid_at: newPaidAt,
          })
          .eq("id", currentItem.id)
          .select("*")
          .single();

        if (error) {
          throw error;
        }

        if (!updatedItem) {
          throw new Error(
            "Der bezahlte Artikel konnte nicht geladen werden."
          );
        }

        updatedItems =
          updatedItems.map((item) =>
            item.id === updatedItem.id
              ? (updatedItem as OrderItem)
              : item
          );
      }

      /*
       * SOFORT lokalen Zustand aktualisieren.
       *
       * Dadurch verschwinden vollständig bezahlte
       * Produkte sofort aus der Zahlungsliste.
       */
      setOrderItems(updatedItems);

      setPaymentSelection([]);
      setCashReceived("");

      /*
       * Prüfen, ob auf dem Tisch noch etwas
       * unbezahlt ist.
       */
      const remainingItems =
        updatedItems.filter((item) => {
          const belongsToTable =
            selectedTableOrderIds.includes(
              item.order_id
            );

          if (!belongsToTable) {
            return false;
          }

          return (
            item.paid_quantity <
            item.quantity
          );
        });

      if (remainingItems.length > 0) {
        /*
         * Noch etwas offen:
         * Zahlung bleibt geöffnet.
         */
        return;
      }

      /*
       * Alles auf dem Tisch wurde bezahlt.
       */
      setShowPayment(false);

      /*
       * Fertige Orders bekommen finished_at.
       */
      const finishedOrders =
        selectedTableOrders.filter(
          (order) =>
            order.status === "fertig" &&
            order.finished_at === null
        );

      if (finishedOrders.length > 0) {
        const finishedAt =
          new Date().toISOString();

        for (const order of finishedOrders) {
          const { error } =
            await supabase
              .from("orders")
              .update({
                finished_at: finishedAt,
              })
              .eq("id", order.id);

          if (error) {
            console.error(
              "Fehler beim Setzen von finished_at:",
              error
            );
          }
        }
      }

      /*
       * Einmal neu laden, weil jetzt wirklich alles
       * bezahlt wurde und der Tisch "frei" werden soll.
       */
      await loadData();
    } catch (error) {
      console.error(
        "Fehler bei der Zahlung:",
        error
      );

      alert(
        "Die Zahlung konnte nicht gespeichert werden."
      );
    } finally {
      setSaving(false);
    }
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

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 px-8 py-6">
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
        theme === "dark"
          ? "min-h-screen bg-slate-950 text-white"
          : "min-h-screen bg-slate-100 text-slate-900"
      }
    >
      {/* HEADER */}

      <header
        className={
          theme === "dark"
            ? "border-b border-slate-800 bg-slate-900"
            : "border-b border-slate-200 bg-white"
        }
      >
        <div className="mx-auto max-w-[1600px] px-6 py-5 flex items-center justify-between">
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
                theme === "dark"
                  ? "light"
                  : "dark"
              )
            }
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm transition hover:bg-slate-800"
          >
            {theme === "dark"
              ? "☀️ Hell"
              : "🌙 Dunkel"}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-6 py-6">
        {/* STATUS */}

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div
            className={
              theme === "dark"
                ? "rounded-2xl border border-slate-800 bg-slate-900 p-5"
                : "rounded-2xl border border-slate-200 bg-white p-5"
            }
          >
            <div className="text-sm text-slate-400">
              Freie Tische
            </div>

            <div className="mt-2 text-3xl font-bold text-green-500">
              {freeTables}
            </div>
          </div>

          <div
            className={
              theme === "dark"
                ? "rounded-2xl border border-slate-800 bg-slate-900 p-5"
                : "rounded-2xl border border-slate-200 bg-white p-5"
            }
          >
            <div className="text-sm text-slate-400">
              Offene Bestellungen
            </div>

            <div className="mt-2 text-3xl font-bold text-orange-500">
              {openTables}
            </div>
          </div>

          <div
            className={
              theme === "dark"
                ? "rounded-2xl border border-slate-800 bg-slate-900 p-5"
                : "rounded-2xl border border-slate-200 bg-white p-5"
            }
          >
            <div className="text-sm text-slate-400">
              Bezahlbereit
            </div>

            <div className="mt-2 text-3xl font-bold text-blue-500">
              {readyTables}
            </div>
          </div>
        </div>

        {/* TABLE OVERVIEW */}

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
                {
                  length: TABLE_COUNT,
                },
                (_, index) => {
                  const tableNumber =
                    index + 1;

                  const status =
                    tableStatuses[
                      tableNumber
                    ];

                  let statusClasses =
                    "";

                  if (status === "frei") {
                    statusClasses =
                      "border-green-500/40 bg-green-500/10 hover:bg-green-500/20";
                  } else if (
                    status === "offen"
                  ) {
                    statusClasses =
                      "border-orange-500/40 bg-orange-500/10 hover:bg-orange-500/20";
                  } else {
                    statusClasses =
                      "border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20";
                  }

                  let statusText = "";

                  if (status === "frei") {
                    statusText = "Frei";
                  } else if (
                    status === "offen"
                  ) {
                    statusText =
                      "Bestellung offen";
                  } else {
                    statusText =
                      "Bezahlbereit";
                  }

                  return (
                    <button
                      key={tableNumber}
                      onClick={() =>
                        setSelectedTable(
                          tableNumber
                        )
                      }
                      className={`rounded-2xl border p-5 text-left transition ${statusClasses}`}
                    >
                      <div className="text-lg font-bold">
                        Tisch{" "}
                        {tableNumber}
                      </div>

                      <div className="mt-2 text-sm text-slate-400">
                        {statusText}
                      </div>
                    </button>
                  );
                }
              )}
            </div>
          </section>
        )}

        {/* SELECTED TABLE */}

        {selectedTable !== null && (
          <section>
            {/* TABLE HEADER */}

            <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <button
                  onClick={closeTable}
                  className="mb-2 text-sm text-slate-400 transition hover:text-white"
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
                    <button
                      onClick={
                        startAddingOrder
                      }
                      className="rounded-xl bg-orange-500 px-5 py-3 font-semibold text-white transition hover:bg-orange-600"
                    >
                      + Bestellung
                      hinzufügen
                    </button>
                  )}

                {!showPayment &&
                  !showAddOrder &&
                  paymentItems.length >
                    0 && (
                    <button
                      onClick={
                        openPayment
                      }
                      className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
                    >
                      💳 Zur Bezahlung
                    </button>
                  )}
              </div>
            </div>

            {/* PAYMENT VIEW */}

            {showPayment && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
                <div
                  className={
                    theme === "dark"
                      ? "rounded-2xl border border-slate-800 bg-slate-900 p-6"
                      : "rounded-2xl border border-slate-200 bg-white p-6"
                  }
                >
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold">
                        Zahlung
                      </h3>

                      <p className="mt-1 text-sm text-slate-400">
                        Wähle die Artikel aus,
                        die bezahlt werden.
                      </p>
                    </div>

                    <button
                      onClick={() =>
                        setShowPayment(
                          false
                        )
                      }
                      className="text-slate-400 transition hover:text-white"
                    >
                      ✕
                    </button>
                  </div>

                  {paymentItems.length ===
                  0 ? (
                    <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-6 text-center">
                      <div className="mb-2 text-3xl">
                        ✓
                      </div>

                      <div className="font-semibold">
                        Alles bezahlt
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {paymentItems.map(
                        (item) => {
                          const selected =
                            getSelectedQuantity(
                              item.id
                            );

                          const product =
                            products.find(
                              (
                                productItem
                              ) =>
                                productItem.name ===
                                item.product_name
                            );

                          const price =
                            product?.price ??
                            0;

                          return (
                            <div
                              key={item.id}
                              className={
                                theme ===
                                "dark"
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
                                    className="h-10 w-10 rounded-lg bg-slate-700 text-lg transition hover:bg-slate-600"
                                  >
                                    −
                                  </button>

                                  <div className="w-12 text-center font-bold">
                                    {selected}
                                  </div>

                                  <button
                                    onClick={() =>
                                      changePaymentQuantity(
                                        item.id,
                                        1
                                      )
                                    }
                                    className="h-10 w-10 rounded-lg bg-slate-700 text-lg transition hover:bg-slate-600"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>

                              {selected >
                                0 && (
                                <div className="mt-3 text-sm text-blue-400">
                                  Ausgewählt:{" "}
                                  {selected}{" "}
                                  ×{" "}
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
                  )}
                </div>

                {/* PAYMENT SUMMARY */}

                <div
                  className={
                    theme === "dark"
                      ? "h-fit rounded-2xl border border-slate-800 bg-slate-900 p-6"
                      : "h-fit rounded-2xl border border-slate-200 bg-white p-6"
                  }
                >
                  <h3 className="mb-4 text-lg font-bold">
                    Zahlungsart
                  </h3>

                  <div className="mb-6 grid grid-cols-2 gap-3">
                    <button
                      onClick={() =>
                        setPaymentMethod(
                          "bar"
                        )
                      }
                      className={`rounded-xl border p-4 transition ${
                        paymentMethod ===
                        "bar"
                          ? "border-green-500 bg-green-500/10"
                          : "border-slate-700 hover:bg-slate-800"
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
                      className={`rounded-xl border p-4 transition ${
                        paymentMethod ===
                        "karte"
                          ? "border-blue-500 bg-blue-500/10"
                          : "border-slate-700 hover:bg-slate-800"
                      }`}
                    >
                      💳 Karte
                    </button>
                  </div>

                  <div className="border-t border-slate-800 pt-5">
                    <div className="flex justify-between text-sm text-slate-400">
                      <span>
                        Zu bezahlen
                      </span>

                      <span className="font-semibold text-white">
                        {formatPrice(
                          paymentTotal
                        )}
                      </span>
                    </div>

                    {paymentMethod ===
                      "bar" && (
                      <>
                        <label className="mb-2 mt-5 block text-sm text-slate-400">
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
                          placeholder="0,00"
                          className={
                            theme ===
                            "dark"
                              ? "w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 outline-none transition focus:border-blue-500"
                              : "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-500"
                          }
                        />

                        <div className="mt-4 flex justify-between">
                          <span className="text-slate-400">
                            Rückgeld
                          </span>

                          <span className="text-xl font-bold text-green-500">
                            {formatPrice(
                              changeAmount
                            )}
                          </span>
                        </div>
                      </>
                    )}

                    {paymentMethod ===
                      "karte" && (
                      <div className="mt-5 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-sm text-blue-400">
                        Die Kartenzahlung
                        wird außerhalb
                        des Kassensystems
                        durchgeführt.
                      </div>
                    )}
                  </div>

                  <button
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
                    onClick={
                      completePayment
                    }
                    className="mt-6 w-full rounded-xl bg-green-600 px-5 py-4 font-bold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {saving
                      ? "Speichere..."
                      : `✓ ${formatPrice(
                          paymentTotal
                        )} bezahlen`}
                  </button>
                </div>
              </div>
            )}

            {/* ADD ORDER */}

            {showAddOrder && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
                <div>
                  <div
                    className={
                      theme === "dark"
                        ? "mb-5 rounded-2xl border border-slate-800 bg-slate-900 p-5"
                        : "mb-5 rounded-2xl border border-slate-200 bg-white p-5"
                    }
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
                          theme === "dark"
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
                        className="rounded-xl border border-slate-700 px-4 py-3 transition hover:bg-slate-800"
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
                            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm transition ${
                              category ===
                              key
                                ? "bg-blue-600 text-white"
                                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
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
                          className={
                            theme ===
                            "dark"
                              ? "rounded-2xl border border-slate-800 bg-slate-900 p-5 text-left transition hover:border-blue-500 hover:bg-slate-800"
                              : "rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:border-blue-500 hover:bg-slate-50"
                          }
                        >
                          <div className="font-semibold">
                            {
                              product.name
                            }
                          </div>

                          <div className="mt-2 font-bold text-blue-400">
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

                {/* CART */}

                <div
                  className={
                    theme === "dark"
                      ? "h-fit rounded-2xl border border-slate-800 bg-slate-900 p-6"
                      : "h-fit rounded-2xl border border-slate-200 bg-white p-6"
                  }
                >
                  <div className="mb-5 flex items-center justify-between">
                    <h3 className="text-lg font-bold">
                      Neue Artikel
                    </h3>

                    <button
                      onClick={
                        cancelAddingOrder
                      }
                      className="text-slate-400 transition hover:text-white"
                    >
                      ✕
                    </button>
                  </div>

                  {cart.length === 0 ? (
                    <div className="text-sm text-slate-400">
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
                            className="rounded-xl border border-slate-800 p-3"
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
                                className="h-8 w-8 rounded-lg bg-slate-800 transition hover:bg-slate-700"
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
                                className="h-8 w-8 rounded-lg bg-slate-800 transition hover:bg-slate-700"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}

                  <div className="mt-5 border-t border-slate-800 pt-5">
                    <div className="flex justify-between text-lg font-bold">
                      <span>
                        Gesamt
                      </span>

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

            {/* NORMAL TABLE VIEW */}

            {!showPayment &&
              !showAddOrder && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
                  <div
                    className={
                      theme === "dark"
                        ? "rounded-2xl border border-slate-800 bg-slate-900 p-6"
                        : "rounded-2xl border border-slate-200 bg-white p-6"
                    }
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
                                className="rounded-xl border border-slate-800 p-4"
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
                                    <div className="font-bold">
                                      {remaining}
                                    </div>

                                    <div className="text-xs text-slate-500">
                                      offen
                                    </div>
                                  </div>
                                </div>

                                {item.paid_quantity >
                                  0 && (
                                  <div className="mt-2 text-sm text-green-500">
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

                  {/* RIGHT PANEL */}

                  <div
                    className={
                      theme === "dark"
                        ? "h-fit rounded-2xl border border-slate-800 bg-slate-900 p-6"
                        : "h-fit rounded-2xl border border-slate-200 bg-white p-6"
                    }
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
                                className="flex items-center justify-between border-b border-slate-800 pb-3"
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
                        className="mt-3 w-full rounded-xl bg-green-600 px-5 py-3 font-bold text-white transition hover:bg-green-700"
                      >
                        💳 Bezahlen
                      </button>
                    )}

                    <button
                      onClick={
                        startAddingOrder
                      }
                      className="mt-3 w-full rounded-xl border border-slate-700 px-5 py-3 font-semibold transition hover:bg-slate-800"
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