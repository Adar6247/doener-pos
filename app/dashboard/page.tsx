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
  orderItemId: number;
  quantity: number;
};

type TableStatus = "frei" | "offen" | "fertig";

const TABLE_COUNT = 25;

const formatPrice = (value: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);

const formatTime = (date: string) =>
  new Date(date).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });

export default function DashboardPage() {
  const { theme, setTheme } = useTheme();

  const dark = theme === "dark";

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  const [selectedTable, setSelectedTable] = useState<number | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("alle");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showAddOrder, setShowAddOrder] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  const [paymentMethod, setPaymentMethod] =
    useState<"bar" | "karte">("bar");

  const [cashReceived, setCashReceived] = useState(0);

  const [paymentSelection, setPaymentSelection] =
    useState<PaymentSelection[]>([]);

  const [currentUserName, setCurrentUserName] =
    useState("Kellner");

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [refreshing, setRefreshing] = useState(false);

  /*
  ============================================================
  DATEN LADEN
  ============================================================
  */

  const loadData = async () => {
    setRefreshing(true);

    try {
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
          "Produkte:",
          productsResult.error
        );
        throw productsResult.error;
      }

      if (ordersResult.error) {
        console.error(
          "Bestellungen:",
          ordersResult.error
        );
        throw ordersResult.error;
      }

      if (orderItemsResult.error) {
        console.error(
          "Bestellpositionen:",
          orderItemsResult.error
        );
        throw orderItemsResult.error;
      }

      setProducts(
        (productsResult.data ?? []) as Product[]
      );

      setOrders(
        (ordersResult.data ?? []) as Order[]
      );

      setOrderItems(
        (orderItemsResult.data ?? []) as OrderItem[]
      );
    } catch (error) {
      console.error(
        "Fehler beim Laden:",
        error
      );

      setErrorMessage(
        "Die Daten konnten nicht geladen werden."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /*
  ============================================================
  BENUTZER
  ============================================================
  */

  useEffect(() => {
    const initialize = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setErrorMessage(
          "Du bist nicht angemeldet."
        );
        setLoading(false);
        return;
      }

      const { data: profile } =
        await supabase
          .from("profiles")
          .select("name")
          .eq("id", user.id)
          .maybeSingle();

      if (profile?.name) {
        setCurrentUserName(profile.name);
      }

      await loadData();
    };

    initialize();
  }, []);

  /*
  ============================================================
  REALTIME
  ============================================================
  */

  useEffect(() => {
    let refreshTimeout: ReturnType<
      typeof setTimeout
    > | null = null;

    const scheduleRefresh = () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }

      refreshTimeout = setTimeout(() => {
        void loadData();
      }, 250);
    };

    const channel = supabase
      .channel("waiter-pos-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "order_items",
        },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payments",
        },
        scheduleRefresh
      )
      .subscribe();

    return () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }

      void supabase.removeChannel(channel);
    };
  }, []);

  /*
  ============================================================
  PRODUKTKATEGORIEN
  ============================================================
  */

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

    return [
      "alle",
      ...unique,
    ];
  }, [products]);

  /*
  ============================================================
  PRODUKTPREISE
  ============================================================
  */

  const productPriceMap = useMemo(() => {
    const map = new Map<string, number>();

    products.forEach((product) => {
      map.set(product.name, Number(product.price));
    });

    return map;
  }, [products]);

  /*
  ============================================================
  TISCHSTATUS
  ============================================================
  */

  const getTableStatus = (
    tableNumber: number
  ): TableStatus => {
    const tableOrders = orders.filter(
      (order) =>
        order.table_number === tableNumber
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

    const tableOrderIds = new Set(
      tableOrders.map((order) => order.id)
    );

    const tableItems = orderItems.filter(
      (item) =>
        tableOrderIds.has(item.order_id)
    );

    const hasUnpaidItems = tableItems.some(
      (item) =>
        item.paid_quantity < item.quantity
    );

    if (hasUnpaidItems) {
      return "fertig";
    }

    return "frei";
  };

  const tableStatuses = useMemo(() => {
    const result: Record<
      number,
      TableStatus
    > = {};

    for (
      let table = 1;
      table <= TABLE_COUNT;
      table++
    ) {
      result[table] =
        getTableStatus(table);
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

  /*
  ============================================================
  AUSGEWÄHLTER TISCH
  ============================================================
  */

  const selectedTableOrders = useMemo(() => {
    if (!selectedTable) return [];

    return orders.filter(
      (order) =>
        order.table_number === selectedTable
    );
  }, [orders, selectedTable]);

  const selectedTableOrderIds =
    useMemo(
      () =>
        new Set(
          selectedTableOrders.map(
            (order) => order.id
          )
        ),
      [selectedTableOrders]
    );

  const selectedTableItems =
    useMemo(() => {
      return orderItems.filter(
        (item) =>
          selectedTableOrderIds.has(
            item.order_id
          )
      );
    }, [
      orderItems,
      selectedTableOrderIds,
    ]);

  const openOrder =
    selectedTableOrders.find(
      (order) => order.status === "offen"
    ) ?? null;

  /*
  ============================================================
  BEZAHLBARE POSITIONEN
  ============================================================
  */

  const paymentItems = useMemo(() => {
    return selectedTableItems.filter(
      (item) =>
        item.paid_quantity <
        item.quantity
    );
  }, [selectedTableItems]);

  /*
  ============================================================
  GEFILTERTE PRODUKTE
  ============================================================
  */

  const filteredProducts =
    useMemo(() => {
      const searchValue =
        search.trim().toLowerCase();

      return products.filter(
        (product) => {
          const matchesSearch =
            !searchValue ||
            product.name
              .toLowerCase()
              .includes(searchValue);

          const matchesCategory =
            category === "alle" ||
            product.category === category;

          return (
            matchesSearch &&
            matchesCategory
          );
        }
      );
    }, [
      products,
      search,
      category,
    ]);

  /*
  ============================================================
  WARENKORB
  ============================================================
  */

  const cartTotal = useMemo(() => {
    return cart.reduce(
      (total, item) =>
        total +
        Number(item.product.price) *
          item.quantity,
      0
    );
  }, [cart]);

  /*
  ============================================================
  ZAHLUNG
  ============================================================
  */

  const paymentTotal = useMemo(() => {
    return paymentSelection.reduce(
      (total, selection) => {
        const item =
          orderItems.find(
            (orderItem) =>
              orderItem.id ===
              selection.orderItemId
          );

        if (!item) {
          return total;
        }

        const price =
          productPriceMap.get(
            item.product_name
          ) ?? 0;

        return (
          total +
          price *
            selection.quantity
        );
      },
      0
    );
  }, [
    paymentSelection,
    orderItems,
    productPriceMap,
  ]);

  const changeAmount =
    Math.max(
      0,
      cashReceived - paymentTotal
    );

  /*
  ============================================================
  WARENKORB HINZUFÜGEN
  ============================================================
  */

  const addToCart = (
    product: Product
  ) => {
    setErrorMessage("");
    setSuccessMessage("");

    setCart((current) => {
      const existing =
        current.find(
          (item) =>
            item.product.id ===
            product.id
        );

      if (existing) {
        return current.map(
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
        ...current,
        {
          product,
          quantity: 1,
        },
      ];
    });
  };

  const changeCartQuantity = (
    productId: number,
    amount: number
  ) => {
    setCart((current) =>
      current
        .map((item) =>
          item.product.id ===
          productId
            ? {
                ...item,
                quantity:
                  item.quantity + amount,
              }
            : item
        )
        .filter(
          (item) =>
            item.quantity > 0
        )
    );
  };

  /*
  ============================================================
  NEUE BESTELLUNG / BESTELLUNG ERWEITERN
  ============================================================
  */

  const createNewOrder = async () => {
    if (!selectedTable) return;

    if (cart.length === 0) {
      setErrorMessage(
        "Bitte füge zuerst Produkte hinzu."
      );
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "Kein angemeldeter Benutzer."
        );
      }

      let orderId: number;

      if (openOrder) {
        orderId = openOrder.id;
      } else {
        const {
          data: newOrder,
          error: orderError,
        } = await supabase
          .from("orders")
          .insert({
            table_number:
              selectedTable,
            waiter_id: user.id,
            status: "offen",
          })
          .select()
          .single();

        if (orderError) {
          throw orderError;
        }

        orderId = newOrder.id;
      }

      for (const cartItem of cart) {
        const existingItem =
          orderItems.find(
            (item) =>
              item.order_id ===
                orderId &&
              item.product_name ===
                cartItem.product.name
          );

        if (existingItem) {
          const newQuantity =
            existingItem.quantity +
            cartItem.quantity;

          const {
            error: updateError,
          } = await supabase
            .from("order_items")
            .update({
              quantity:
                newQuantity,
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

      setSuccessMessage(
        `Bestellung für Tisch ${selectedTable} wurde gespeichert.`
      );

      await loadData();
    } catch (error) {
      console.error(
        "Bestellung speichern:",
        error
      );

      setErrorMessage(
        "Die Bestellung konnte nicht gespeichert werden."
      );
    } finally {
      setSaving(false);
    }
  };

  /*
  ============================================================
  BESTELLUNG FERTIG
  ============================================================
  */

  const finishOrder = async () => {
    if (!openOrder) return;

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const {
        error,
      } = await supabase
        .from("orders")
        .update({
          status: "fertig",
        })
        .eq(
          "id",
          openOrder.id
        );

      if (error) {
        throw error;
      }

      setSuccessMessage(
        `Tisch ${selectedTable} ist jetzt zur Bezahlung bereit.`
      );

      await loadData();
    } catch (error) {
      console.error(
        "Bestellung fertig:",
        error
      );

      setErrorMessage(
        "Die Bestellung konnte nicht abgeschlossen werden."
      );
    } finally {
      setSaving(false);
    }
  };

  /*
  ============================================================
  ZAHLUNG ÖFFNEN
  ============================================================
  */

  const openPayment = () => {
    if (!selectedTable) return;

    if (paymentItems.length === 0) {
      setErrorMessage(
        "Für diesen Tisch gibt es keine offenen Positionen."
      );
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setPaymentSelection([]);
    setPaymentMethod("bar");
    setCashReceived(0);
    setShowAddOrder(false);
    setShowPayment(true);
  };

  const closePayment = () => {
    setShowPayment(false);
    setPaymentSelection([]);
    setCashReceived(0);
    setErrorMessage("");
  };

  /*
  ============================================================
  ZAHLUNG POSITION AUSWÄHLEN
  ============================================================
  */

  const getSelectedQuantity = (
    itemId: number
  ) => {
    return (
      paymentSelection.find(
        (selection) =>
          selection.orderItemId ===
          itemId
      )?.quantity ?? 0
    );
  };

  const changePaymentQuantity = (
    item: OrderItem,
    amount: number
  ) => {
    const remaining =
      item.quantity -
      item.paid_quantity;

    const current =
      getSelectedQuantity(item.id);

    const next = Math.max(
      0,
      Math.min(
        remaining,
        current + amount
      )
    );

    setPaymentSelection(
      (currentSelection) => {
        const without =
          currentSelection.filter(
            (selection) =>
              selection.orderItemId !==
              item.id
          );

        if (next === 0) {
          return without;
        }

        return [
          ...without,
          {
            orderItemId: item.id,
            quantity: next,
          },
        ];
      }
    );
  };

  /*
  ============================================================
  ZAHLUNG SPEICHERN
  ============================================================
  */

  const completePayment =
    async () => {
      if (!selectedTable) return;

      if (
        paymentSelection.length === 0
      ) {
        setErrorMessage(
          "Bitte wähle mindestens eine Position aus."
        );
        return;
      }

      if (
        paymentMethod === "bar" &&
        cashReceived < paymentTotal
      ) {
        setErrorMessage(
          "Der erhaltene Betrag ist zu niedrig."
        );
        return;
      }

      if (paymentTotal <= 0) {
        setErrorMessage(
          "Der Zahlungsbetrag ist ungültig."
        );
        return;
      }

      setSaving(true);
      setErrorMessage("");
      setSuccessMessage("");

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          throw new Error(
            "Kein angemeldeter Benutzer."
          );
        }

        /*
        --------------------------------------------------------
        1. POSITIONEN ALS BEZAHLT MARKIEREN
        --------------------------------------------------------
        */

        for (const selection of paymentSelection) {
          const item =
            orderItems.find(
              (orderItem) =>
                orderItem.id ===
                selection.orderItemId
            );

          if (!item) {
            throw new Error(
              "Bestellposition wurde nicht gefunden."
            );
          }

          const remaining =
            item.quantity -
            item.paid_quantity;

          if (
            selection.quantity >
            remaining
          ) {
            throw new Error(
              `Zu viele Stück von "${item.product_name}" ausgewählt.`
            );
          }

          const newPaidQuantity =
            item.paid_quantity +
            selection.quantity;

          const {
            error: updateError,
          } = await supabase
            .from("order_items")
            .update({
              paid_quantity:
                newPaidQuantity,
              paid_at:
                newPaidQuantity >=
                item.quantity
                  ? new Date().toISOString()
                  : item.paid_at,
            })
            .eq(
              "id",
              item.id
            );

          if (updateError) {
            console.error(
              "Order item update:",
              updateError
            );

            throw updateError;
          }
        }

        /*
        --------------------------------------------------------
        2. ZAHLUNG DEM KELLNER ZUORDNEN
        --------------------------------------------------------
        */

        const paymentByOrder =
          new Map<number, number>();

        for (const selection of paymentSelection) {
          const item =
            orderItems.find(
              (orderItem) =>
                orderItem.id ===
                selection.orderItemId
            );

          if (!item) continue;

          const price =
            productPriceMap.get(
              item.product_name
            );

          if (
            price === undefined
          ) {
            throw new Error(
              `Preis für "${item.product_name}" wurde nicht gefunden.`
            );
          }

          const itemAmount =
            Number(price) *
            selection.quantity;

          const oldAmount =
            paymentByOrder.get(
              item.order_id
            ) ?? 0;

          paymentByOrder.set(
            item.order_id,
            oldAmount + itemAmount
          );
        }

        /*
        --------------------------------------------------------
        Für jede betroffene Bestellung wird
        eine Zahlung gespeichert.
        --------------------------------------------------------
        */

        for (const [
          orderId,
          amount,
        ] of paymentByOrder) {
          const {
            error: paymentError,
          } = await supabase
            .from("payments")
            .insert({
              order_id: orderId,
              waiter_id: user.id,
              amount:
                Number(
                  amount.toFixed(2)
                ),
              payment_method:
                paymentMethod,
            });

          if (paymentError) {
            console.error(
              "Payment insert:",
              paymentError
            );

            throw paymentError;
          }
        }

        /*
        --------------------------------------------------------
        3. AKTUELLEN STAND DER BESTELLUNGEN LADEN
        --------------------------------------------------------
        */

        const {
          data: freshOrders,
          error: freshOrdersError,
        } = await supabase
          .from("orders")
          .select("*")
          .eq(
            "table_number",
            selectedTable
          );

        if (freshOrdersError) {
          throw freshOrdersError;
        }

        const freshOrderIds =
          (freshOrders ?? []).map(
            (order) => order.id
          );

        let freshItems: OrderItem[] =
          [];

        if (
          freshOrderIds.length > 0
        ) {
          const {
            data,
            error: freshItemsError,
          } = await supabase
            .from("order_items")
            .select("*")
            .in(
              "order_id",
              freshOrderIds
            );

          if (freshItemsError) {
            throw freshItemsError;
          }

          freshItems =
            (data ?? []) as OrderItem[];
        }

        /*
        --------------------------------------------------------
        4. PRÜFEN, OB ALLES BEZAHLT IST
        --------------------------------------------------------
        */

        const allPaid =
          freshItems.length > 0 &&
          freshItems.every(
            (item) =>
              item.paid_quantity >=
              item.quantity
          );

        if (allPaid) {
          const finishedOrderIds =
            (freshOrders ?? [])
              .filter(
                (order) =>
                  order.status ===
                  "fertig"
              )
              .map(
                (order) =>
                  order.id
              );

          if (
            finishedOrderIds.length >
            0
          ) {
            const {
              error: finishError,
            } = await supabase
              .from("orders")
              .update({
                finished_at:
                  new Date().toISOString(),
              })
              .in(
                "id",
                finishedOrderIds
              );

            if (finishError) {
              throw finishError;
            }
          }
        }

        setPaymentSelection([]);
        setShowPayment(false);
        setCashReceived(0);

        if (allPaid) {
          setSuccessMessage(
            `Tisch ${selectedTable} wurde vollständig bezahlt und ist wieder frei.`
          );
        } else {
          setSuccessMessage(
            `Zahlung über ${formatPrice(
              paymentTotal
            )} wurde auf ${currentUserName} gespeichert.`
          );
        }

        await loadData();
      } catch (error) {
        console.error(
          "Fehler bei der Zahlung:",
          error
        );

        setErrorMessage(
          "Die Zahlung konnte nicht gespeichert werden."
        );
      } finally {
        setSaving(false);
      }
    };

  /*
  ============================================================
  BESTELLUNG HINZUFÜGEN
  ============================================================
  */

  const startAddingOrder = () => {
    setErrorMessage("");
    setSuccessMessage("");
    setShowPayment(false);
    setCart([]);
    setSearch("");
    setCategory("alle");
    setShowAddOrder(true);
  };

  const cancelAddingOrder = () => {
    setCart([]);
    setSearch("");
    setCategory("alle");
    setShowAddOrder(false);
    setErrorMessage("");
  };

  /*
  ============================================================
  TISCH AUSWÄHLEN
  ============================================================
  */

  const selectTable = (
    tableNumber: number
  ) => {
    setSelectedTable(
      tableNumber
    );

    setCart([]);
    setSearch("");
    setCategory("alle");
    setShowPayment(false);
    setShowAddOrder(false);
    setPaymentSelection([]);
    setErrorMessage("");
    setSuccessMessage("");
  };

  /*
  ============================================================
  ABMELDEN
  ============================================================
  */

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  /*
  ============================================================
  UI
  ============================================================
  */

  if (loading) {
    return (
      <main
        className={`min-h-screen flex items-center justify-center ${
          dark
            ? "bg-[#0b1120] text-white"
            : "bg-[#f4f7fb] text-slate-900"
        }`}
      >
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600" />
          <p className="font-medium">
            POS wird geladen...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      className={`min-h-screen ${
        dark
          ? "bg-[#0b1120] text-white"
          : "bg-[#f4f7fb] text-slate-900"
      }`}
    >
      {/* HEADER */}

      <header
        className={`sticky top-0 z-40 border-b backdrop-blur-xl ${
          dark
            ? "border-slate-800 bg-[#0b1120]/95"
            : "border-slate-200 bg-white/95"
        }`}
      >
        <div className="mx-auto flex max-w-[1800px] items-center justify-between px-4 py-4 lg:px-7">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-2xl text-2xl shadow-sm ${
                dark
                  ? "bg-blue-600"
                  : "bg-blue-600 text-white"
              }`}
            >
              🥙
            </div>

            <div>
              <h1 className="text-xl font-black tracking-tight">
                Döner POS
              </h1>

              <p
                className={`text-xs font-medium ${
                  dark
                    ? "text-slate-400"
                    : "text-slate-500"
                }`}
              >
                Kellner-Bereich
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div
              className={`hidden rounded-xl px-4 py-2 text-sm font-semibold sm:block ${
                dark
                  ? "bg-slate-800 text-slate-200"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              👤 {currentUserName}
            </div>

            <button
              type="button"
              onClick={() =>
                setTheme(
                  dark
                    ? "light"
                    : "dark"
                )
              }
              className={`rounded-xl px-3 py-2 text-lg transition ${
                dark
                  ? "bg-slate-800 hover:bg-slate-700"
                  : "bg-slate-100 hover:bg-slate-200"
              }`}
              title="Theme wechseln"
            >
              {dark ? "☀️" : "🌙"}
            </button>

            <button
              type="button"
              onClick={logout}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                dark
                  ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Abmelden
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1800px] px-4 py-5 lg:px-7">
        {/* MELDUNGEN */}

        {errorMessage && (
          <div
            className={`mb-4 flex items-center justify-between rounded-2xl border px-4 py-3 ${
              dark
                ? "border-red-900/70 bg-red-950/40 text-red-200"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            <span className="text-sm font-semibold">
              ⚠️ {errorMessage}
            </span>

            <button
              type="button"
              onClick={() =>
                setErrorMessage("")
              }
              className="ml-4 text-lg opacity-70 hover:opacity-100"
            >
              ×
            </button>
          </div>
        )}

        {successMessage && (
          <div
            className={`mb-4 flex items-center justify-between rounded-2xl border px-4 py-3 ${
              dark
                ? "border-emerald-900/70 bg-emerald-950/40 text-emerald-200"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            <span className="text-sm font-semibold">
              ✓ {successMessage}
            </span>

            <button
              type="button"
              onClick={() =>
                setSuccessMessage("")
              }
              className="ml-4 text-lg opacity-70 hover:opacity-100"
            >
              ×
            </button>
          </div>
        )}

        {/* STATUS */}

        <section className="mb-6 grid grid-cols-3 gap-3 lg:gap-5">
          <div
            className={`rounded-2xl border p-4 shadow-sm ${
              dark
                ? "border-slate-800 bg-slate-900/80"
                : "border-slate-200 bg-white"
            }`}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-2xl">
                🟢
              </span>

              <span
                className={`text-2xl font-black ${
                  dark
                    ? "text-white"
                    : "text-slate-900"
                }`}
              >
                {freeTables}
              </span>
            </div>

            <p
              className={`text-xs font-bold uppercase tracking-wider ${
                dark
                  ? "text-slate-400"
                  : "text-slate-500"
              }`}
            >
              Frei
            </p>
          </div>

          <div
            className={`rounded-2xl border p-4 shadow-sm ${
              dark
                ? "border-slate-800 bg-slate-900/80"
                : "border-slate-200 bg-white"
            }`}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-2xl">
                🟠
              </span>

              <span className="text-2xl font-black">
                {openTables}
              </span>
            </div>

            <p
              className={`text-xs font-bold uppercase tracking-wider ${
                dark
                  ? "text-slate-400"
                  : "text-slate-500"
              }`}
            >
              Bestellung
            </p>
          </div>

          <div
            className={`rounded-2xl border p-4 shadow-sm ${
              dark
                ? "border-slate-800 bg-slate-900/80"
                : "border-slate-200 bg-white"
            }`}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-2xl">
                💳
              </span>

              <span className="text-2xl font-black">
                {readyTables}
              </span>
            </div>

            <p
              className={`text-xs font-bold uppercase tracking-wider ${
                dark
                  ? "text-slate-400"
                  : "text-slate-500"
              }`}
            >
              Bezahlbereit
            </p>
          </div>
        </section>

        {/* TISCHPLAN */}

        <section
          className={`mb-6 rounded-3xl border p-4 shadow-sm lg:p-6 ${
            dark
              ? "border-slate-800 bg-slate-900/70"
              : "border-slate-200 bg-white"
          }`}
        >
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black">
                Tische
              </h2>

              <p
                className={`mt-1 text-sm ${
                  dark
                    ? "text-slate-400"
                    : "text-slate-500"
                }`}
              >
                Wähle einen Tisch aus
              </p>
            </div>

            <div
              className={`hidden items-center gap-4 text-xs font-semibold md:flex ${
                dark
                  ? "text-slate-400"
                  : "text-slate-500"
              }`}
            >
              <span>🟢 Frei</span>
              <span>🟠 Bestellung</span>
              <span>🔵 Bezahlung</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10">
            {Array.from(
              { length: TABLE_COUNT },
              (_, index) => index + 1
            ).map((table) => {
              const status =
                tableStatuses[table];

              const selected =
                selectedTable === table;

              let colorClass = "";

              if (
                status === "frei"
              ) {
                colorClass = dark
                  ? "border-emerald-800 bg-emerald-950/30 hover:bg-emerald-950/50"
                  : "border-emerald-200 bg-emerald-50 hover:bg-emerald-100";
              }

              if (
                status === "offen"
              ) {
                colorClass = dark
                  ? "border-orange-800 bg-orange-950/30 hover:bg-orange-950/50"
                  : "border-orange-200 bg-orange-50 hover:bg-orange-100";
              }

              if (
                status === "fertig"
              ) {
                colorClass = dark
                  ? "border-blue-800 bg-blue-950/30 hover:bg-blue-950/50"
                  : "border-blue-200 bg-blue-50 hover:bg-blue-100";
              }

              return (
                <button
                  key={table}
                  type="button"
                  onClick={() =>
                    selectTable(table)
                  }
                  className={`relative min-h-[105px] rounded-2xl border-2 p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${colorClass} ${
                    selected
                      ? "ring-4 ring-blue-500/30"
                      : ""
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span className="text-lg font-black">
                      {table}
                    </span>

                    <span>
                      {status ===
                        "frei" &&
                        "🟢"}
                      {status ===
                        "offen" &&
                        "🟠"}
                      {status ===
                        "fertig" &&
                        "🔵"}
                    </span>
                  </div>

                  <div
                    className={`mt-5 text-[11px] font-bold ${
                      dark
                        ? "text-slate-400"
                        : "text-slate-500"
                    }`}
                  >
                    {status ===
                      "frei" &&
                      "FREI"}

                    {status ===
                      "offen" &&
                      "BESTELLUNG"}

                    {status ===
                      "fertig" &&
                      "BEZAHLEN"}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* KEIN TISCH */}

        {selectedTable ===
          null && (
          <section
            className={`flex min-h-[280px] items-center justify-center rounded-3xl border ${
              dark
                ? "border-slate-800 bg-slate-900/50"
                : "border-slate-200 bg-white"
            }`}
          >
            <div className="text-center">
              <div className="mb-4 text-5xl">
                🪑
              </div>

              <h2 className="text-xl font-black">
                Tisch auswählen
              </h2>

              <p
                className={`mt-2 text-sm ${
                  dark
                    ? "text-slate-400"
                    : "text-slate-500"
                }`}
              >
                Wähle oben einen Tisch,
                um die Bestellung zu
                bearbeiten.
              </p>
            </div>
          </section>
        )}

        {/* TISCH BEREICH */}

        {selectedTable !==
          null && (
          <section
            className={`rounded-3xl border shadow-sm ${
              dark
                ? "border-slate-800 bg-slate-900/70"
                : "border-slate-200 bg-white"
            }`}
          >
            {/* TISCHKOPF */}

            <div
              className={`border-b px-5 py-5 lg:px-7 ${
                dark
                  ? "border-slate-800"
                  : "border-slate-200"
              }`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-black">
                      Tisch{" "}
                      {selectedTable}
                    </h2>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black ${
                        tableStatuses[
                          selectedTable
                        ] ===
                        "frei"
                          ? dark
                            ? "bg-emerald-950 text-emerald-300"
                            : "bg-emerald-100 text-emerald-700"
                          : tableStatuses[
                              selectedTable
                            ] ===
                            "offen"
                          ? dark
                            ? "bg-orange-950 text-orange-300"
                            : "bg-orange-100 text-orange-700"
                          : dark
                          ? "bg-blue-950 text-blue-300"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {tableStatuses[
                        selectedTable
                      ] === "frei" &&
                        "Frei"}

                      {tableStatuses[
                        selectedTable
                      ] === "offen" &&
                        "Bestellung läuft"}

                      {tableStatuses[
                        selectedTable
                      ] === "fertig" &&
                        "Bezahlung offen"}
                    </span>
                  </div>

                  <p
                    className={`mt-1 text-sm ${
                      dark
                        ? "text-slate-400"
                        : "text-slate-500"
                    }`}
                  >
                    {selectedTableItems.length >
                    0
                      ? `${selectedTableItems.length} Positionen`
                      : "Noch keine Bestellung"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={
                      startAddingOrder
                    }
                    className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={saving}
                  >
                    ＋ Bestellung
                  </button>

                  {tableStatuses[
                    selectedTable
                  ] ===
                    "fertig" &&
                    paymentItems.length >
                      0 && (
                      <button
                        type="button"
                        onClick={
                          openPayment
                        }
                        className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={saving}
                      >
                        💳 Bezahlen
                      </button>
                    )}
                </div>
              </div>
            </div>

            {/* ZAHLUNG */}

            {showPayment && (
              <div className="p-5 lg:p-7">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-black">
                      Zahlung
                    </h3>

                    <p
                      className={`mt-1 text-sm ${
                        dark
                          ? "text-slate-400"
                          : "text-slate-500"
                      }`}
                    >
                      Welche Positionen
                      bezahlt der
                      aktuelle Kellner?
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={
                      closePayment
                    }
                    className={`rounded-xl px-4 py-2 text-sm font-bold ${
                      dark
                        ? "bg-slate-800 hover:bg-slate-700"
                        : "bg-slate-100 hover:bg-slate-200"
                    }`}
                  >
                    Zurück
                  </button>
                </div>

                <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
                  <div
                    className={`rounded-2xl border p-4 ${
                      dark
                        ? "border-slate-800 bg-slate-950/40"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="space-y-3">
                      {paymentItems.map(
                        (item) => {
                          const remaining =
                            item.quantity -
                            item.paid_quantity;

                          const selected =
                            getSelectedQuantity(
                              item.id
                            );

                          const price =
                            productPriceMap.get(
                              item.product_name
                            ) ?? 0;

                          return (
                            <div
                              key={item.id}
                              className={`rounded-2xl border p-4 ${
                                selected >
                                0
                                  ? dark
                                    ? "border-blue-700 bg-blue-950/30"
                                    : "border-blue-300 bg-blue-50"
                                  : dark
                                  ? "border-slate-800 bg-slate-900"
                                  : "border-slate-200 bg-white"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-4">
                                <div className="min-w-0">
                                  <p className="truncate font-black">
                                    {
                                      item.product_name
                                    }
                                  </p>

                                  <p
                                    className={`mt-1 text-xs ${
                                      dark
                                        ? "text-slate-400"
                                        : "text-slate-500"
                                    }`}
                                  >
                                    {remaining}{" "}
                                    offen ·{" "}
                                    {formatPrice(
                                      price
                                    )}{" "}
                                    pro Stück
                                  </p>
                                </div>

                                <div className="flex shrink-0 items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      changePaymentQuantity(
                                        item,
                                        -1
                                      )
                                    }
                                    className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg font-black ${
                                      dark
                                        ? "bg-slate-800 hover:bg-slate-700"
                                        : "bg-slate-100 hover:bg-slate-200"
                                    }`}
                                  >
                                    −
                                  </button>

                                  <div className="flex h-10 min-w-10 items-center justify-center rounded-xl bg-blue-600 px-3 font-black text-white">
                                    {selected}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      changePaymentQuantity(
                                        item,
                                        1
                                      )
                                    }
                                    disabled={
                                      selected >=
                                      remaining
                                    }
                                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-lg font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    ＋
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>

                  {/* ZAHLUNGSRECHNER */}

                  <div
                    className={`h-fit rounded-3xl border p-5 shadow-sm ${
                      dark
                        ? "border-slate-800 bg-slate-950"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="mb-5">
                      <p
                        className={`text-xs font-black uppercase tracking-wider ${
                          dark
                            ? "text-slate-500"
                            : "text-slate-400"
                        }`}
                      >
                        Zu bezahlen
                      </p>

                      <p className="mt-1 text-4xl font-black">
                        {formatPrice(
                          paymentTotal
                        )}
                      </p>
                    </div>

                    <div className="mb-5 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setPaymentMethod(
                            "bar"
                          )
                        }
                        className={`rounded-xl px-4 py-3 text-sm font-black ${
                          paymentMethod ===
                          "bar"
                            ? "bg-blue-600 text-white"
                            : dark
                            ? "bg-slate-800 text-slate-300"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        💶 Bar
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setPaymentMethod(
                            "karte"
                          )
                        }
                        className={`rounded-xl px-4 py-3 text-sm font-black ${
                          paymentMethod ===
                          "karte"
                            ? "bg-blue-600 text-white"
                            : dark
                            ? "bg-slate-800 text-slate-300"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        💳 Karte
                      </button>
                    </div>

                    {paymentMethod ===
                      "bar" && (
                      <div className="mb-5">
                        <label
                          className={`mb-2 block text-sm font-bold ${
                            dark
                              ? "text-slate-300"
                              : "text-slate-700"
                          }`}
                        >
                          Erhalten
                        </label>

                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={
                            cashReceived ===
                            0
                              ? ""
                              : cashReceived
                          }
                          onChange={(event) =>
                            setCashReceived(
                              Number(
                                event
                                  .target
                                  .value
                              ) || 0
                            )
                          }
                          placeholder="0,00 €"
                          className={`w-full rounded-xl border px-4 py-3 text-lg font-bold outline-none focus:border-blue-500 ${
                            dark
                              ? "border-slate-700 bg-slate-900 text-white"
                              : "border-slate-200 bg-slate-50 text-slate-900"
                          }`}
                        />

                        <div className="mt-3 flex items-center justify-between">
                          <span
                            className={`text-sm font-semibold ${
                              dark
                                ? "text-slate-400"
                                : "text-slate-500"
                            }`}
                          >
                            Rückgeld
                          </span>

                          <span className="text-lg font-black text-emerald-500">
                            {formatPrice(
                              changeAmount
                            )}
                          </span>
                        </div>
                      </div>
                    )}

                    <div
                      className={`mb-5 rounded-2xl p-4 ${
                        dark
                          ? "bg-slate-900"
                          : "bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span
                          className={
                            dark
                              ? "text-slate-400"
                              : "text-slate-500"
                          }
                        >
                          Kellner
                        </span>

                        <span className="font-bold">
                          {currentUserName}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-sm">
                        <span
                          className={
                            dark
                              ? "text-slate-400"
                              : "text-slate-500"
                          }
                        >
                          Zahlungsart
                        </span>

                        <span className="font-bold">
                          {paymentMethod ===
                          "bar"
                            ? "Bar"
                            : "Karte"}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
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
                          cashReceived <
                            paymentTotal)
                      }
                      className="w-full rounded-2xl bg-emerald-600 px-5 py-4 text-base font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {saving
                        ? "Speichere..."
                        : `✓ ${formatPrice(
                            paymentTotal
                          )} bezahlen`}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* BESTELLUNG HINZUFÜGEN */}

            {showAddOrder && (
              <div className="p-5 lg:p-7">
                <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <h3 className="text-xl font-black">
                      {openOrder
                        ? "Bestellung erweitern"
                        : "Neue Bestellung"}
                    </h3>

                    <p
                      className={`mt-1 text-sm ${
                        dark
                          ? "text-slate-400"
                          : "text-slate-500"
                      }`}
                    >
                      Tisch{" "}
                      {selectedTable}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={
                      cancelAddingOrder
                    }
                    className={`rounded-xl px-4 py-2 text-sm font-bold ${
                      dark
                        ? "bg-slate-800 hover:bg-slate-700"
                        : "bg-slate-100 hover:bg-slate-200"
                    }`}
                  >
                    Abbrechen
                  </button>
                </div>

                <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
                  {/* PRODUKTE */}

                  <div>
                    <div className="mb-4 flex flex-col gap-3 lg:flex-row">
                      <div className="relative flex-1">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2">
                          🔎
                        </span>

                        <input
                          type="text"
                          value={search}
                          onChange={(event) =>
                            setSearch(
                              event.target.value
                            )
                          }
                          placeholder="Produkt suchen..."
                          className={`w-full rounded-2xl border py-3 pl-11 pr-4 text-sm font-semibold outline-none focus:border-blue-500 ${
                            dark
                              ? "border-slate-700 bg-slate-950 text-white placeholder:text-slate-500"
                              : "border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400"
                          }`}
                        />
                      </div>
                    </div>

                    <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
                      {categories.map(
                        (itemCategory) => (
                          <button
                            key={
                              itemCategory
                            }
                            type="button"
                            onClick={() =>
                              setCategory(
                                itemCategory
                              )
                            }
                            className={`shrink-0 rounded-xl px-4 py-2 text-xs font-black transition ${
                              category ===
                              itemCategory
                                ? "bg-blue-600 text-white"
                                : dark
                                ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            {itemCategory ===
                            "alle"
                              ? "Alle"
                              : itemCategory}
                          </button>
                        )
                      )}
                    </div>

                    {filteredProducts.length ===
                    0 ? (
                      <div
                        className={`rounded-2xl border p-10 text-center ${
                          dark
                            ? "border-slate-800 bg-slate-950/40"
                            : "border-slate-200 bg-slate-50"
                        }`}
                      >
                        <div className="mb-3 text-4xl">
                          🔎
                        </div>

                        <p className="font-bold">
                          Kein Produkt gefunden
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
                              type="button"
                              onClick={() =>
                                addToCart(
                                  product
                                )
                              }
                              className={`group rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:border-blue-500 hover:shadow-md ${
                                dark
                                  ? "border-slate-800 bg-slate-950/50 hover:bg-slate-900"
                                  : "border-slate-200 bg-white hover:bg-slate-50"
                              }`}
                            >
                              <div className="flex min-h-[105px] flex-col justify-between">
                                <div>
                                  <p className="line-clamp-3 text-sm font-black">
                                    {
                                      product.name
                                    }
                                  </p>

                                  <p
                                    className={`mt-2 text-[11px] ${
                                      dark
                                        ? "text-slate-500"
                                        : "text-slate-400"
                                    }`}
                                  >
                                    {
                                      product.category
                                    }
                                  </p>
                                </div>

                                <div className="mt-4 flex items-center justify-between">
                                  <span className="font-black text-blue-500">
                                    {formatPrice(
                                      Number(
                                        product.price
                                      )
                                    )}
                                  </span>

                                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                                    ＋
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

                  <aside
                    className={`h-fit rounded-3xl border p-5 xl:sticky xl:top-28 ${
                      dark
                        ? "border-slate-800 bg-slate-950"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="mb-5 flex items-center justify-between">
                      <div>
                        <h3 className="font-black">
                          Bestellung
                        </h3>

                        <p
                          className={`mt-1 text-xs ${
                            dark
                              ? "text-slate-500"
                              : "text-slate-400"
                          }`}
                        >
                          Tisch{" "}
                          {selectedTable}
                        </p>
                      </div>

                      <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-black text-white">
                        {cart.reduce(
                          (
                            total,
                            item
                          ) =>
                            total +
                            item.quantity,
                          0
                        )}
                      </span>
                    </div>

                    {cart.length ===
                    0 ? (
                      <div
                        className={`rounded-2xl border border-dashed p-8 text-center ${
                          dark
                            ? "border-slate-700 text-slate-500"
                            : "border-slate-300 text-slate-400"
                        }`}
                      >
                        <div className="mb-2 text-3xl">
                          🛒
                        </div>

                        <p className="text-sm font-semibold">
                          Noch keine
                          Produkte
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {cart.map(
                          (item) => (
                            <div
                              key={
                                item.product
                                  .id
                              }
                              className={`rounded-2xl p-3 ${
                                dark
                                  ? "bg-slate-900"
                                  : "bg-slate-50"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-black">
                                    {
                                      item
                                        .product
                                        .name
                                    }
                                  </p>

                                  <p className="mt-1 text-xs font-semibold text-blue-500">
                                    {formatPrice(
                                      Number(
                                        item
                                          .product
                                          .price
                                      ) *
                                        item.quantity
                                    )}
                                  </p>
                                </div>

                                <div className="flex shrink-0 items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      changeCartQuantity(
                                        item
                                          .product
                                          .id,
                                        -1
                                      )
                                    }
                                    className={`h-8 w-8 rounded-lg font-black ${
                                      dark
                                        ? "bg-slate-800 hover:bg-slate-700"
                                        : "bg-white hover:bg-slate-200"
                                    }`}
                                  >
                                    −
                                  </button>

                                  <span className="flex h-8 min-w-8 items-center justify-center font-black">
                                    {
                                      item.quantity
                                    }
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      changeCartQuantity(
                                        item
                                          .product
                                          .id,
                                        1
                                      )
                                    }
                                    className="h-8 w-8 rounded-lg bg-blue-600 font-black text-white hover:bg-blue-700"
                                  >
                                    ＋
                                  </button>
                                </div>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    )}

                    <div
                      className={`my-5 border-t pt-5 ${
                        dark
                          ? "border-slate-800"
                          : "border-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-sm font-bold ${
                            dark
                              ? "text-slate-400"
                              : "text-slate-500"
                          }`}
                        >
                          Gesamt
                        </span>

                        <span className="text-2xl font-black">
                          {formatPrice(
                            cartTotal
                          )}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={
                        createNewOrder
                      }
                      disabled={
                        saving ||
                        cart.length ===
                          0
                      }
                      className="w-full rounded-2xl bg-blue-600 px-5 py-4 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {saving
                        ? "Speichere..."
                        : openOrder
                        ? "✓ Bestellung ergänzen"
                        : "✓ Bestellung speichern"}
                    </button>
                  </aside>
                </div>
              </div>
            )}

            {/* NORMALE TISCHANSICHT */}

            {!showPayment &&
              !showAddOrder && (
                <div className="p-5 lg:p-7">
                  {selectedTableItems.length ===
                  0 ? (
                    <div
                      className={`rounded-2xl border border-dashed p-12 text-center ${
                        dark
                          ? "border-slate-700"
                          : "border-slate-300"
                      }`}
                    >
                      <div className="mb-4 text-5xl">
                        🧾
                      </div>

                      <h3 className="text-lg font-black">
                        Noch keine Bestellung
                      </h3>

                      <p
                        className={`mx-auto mt-2 max-w-md text-sm ${
                          dark
                            ? "text-slate-400"
                            : "text-slate-500"
                        }`}
                      >
                        Füge Produkte hinzu,
                        um eine neue
                        Bestellung für
                        diesen Tisch
                        anzulegen.
                      </p>

                      <button
                        type="button"
                        onClick={
                          startAddingOrder
                        }
                        className="mt-5 rounded-xl bg-blue-600 px-6 py-3 text-sm font-black text-white hover:bg-blue-700"
                      >
                        ＋ Bestellung
                        starten
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="mb-5 grid gap-3 sm:grid-cols-3">
                        <div
                          className={`rounded-2xl p-4 ${
                            dark
                              ? "bg-slate-950"
                              : "bg-slate-50"
                          }`}
                        >
                          <p
                            className={`text-xs font-bold uppercase tracking-wider ${
                              dark
                                ? "text-slate-500"
                                : "text-slate-400"
                            }`}
                          >
                            Positionen
                          </p>

                          <p className="mt-1 text-2xl font-black">
                            {
                              selectedTableItems.length
                            }
                          </p>
                        </div>

                        <div
                          className={`rounded-2xl p-4 ${
                            dark
                              ? "bg-slate-950"
                              : "bg-slate-50"
                          }`}
                        >
                          <p
                            className={`text-xs font-bold uppercase tracking-wider ${
                              dark
                                ? "text-slate-500"
                                : "text-slate-400"
                            }`}
                          >
                            Offen
                          </p>

                          <p className="mt-1 text-2xl font-black text-orange-500">
                            {paymentItems.reduce(
                              (
                                total,
                                item
                              ) =>
                                total +
                                (item.quantity -
                                  item.paid_quantity),
                              0
                            )}
                          </p>
                        </div>

                        <div
                          className={`rounded-2xl p-4 ${
                            dark
                              ? "bg-slate-950"
                              : "bg-slate-50"
                          }`}
                        >
                          <p
                            className={`text-xs font-bold uppercase tracking-wider ${
                              dark
                                ? "text-slate-500"
                                : "text-slate-400"
                            }`}
                          >
                            Status
                          </p>

                          <p className="mt-1 text-lg font-black">
                            {tableStatuses[
                              selectedTable
                            ] === "offen"
                              ? "In Bearbeitung"
                              : tableStatuses[
                                  selectedTable
                                ] ===
                                "fertig"
                              ? "Bezahlung offen"
                              : "Frei"}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {selectedTableItems.map(
                          (item) => {
                            const price =
                              productPriceMap.get(
                                item.product_name
                              ) ?? 0;

                            const unpaid =
                              item.quantity -
                              item.paid_quantity;

                            return (
                              <div
                                key={
                                  item.id
                                }
                                className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
                                  dark
                                    ? "border-slate-800 bg-slate-950/40"
                                    : "border-slate-200 bg-white"
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-black">
                                      {
                                        item.product_name
                                      }
                                    </p>

                                    {item.paid_quantity >
                                      0 && (
                                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                        {
                                          item.paid_quantity
                                        }{" "}
                                        bezahlt
                                      </span>
                                    )}
                                  </div>

                                  <p
                                    className={`mt-1 text-xs ${
                                      dark
                                        ? "text-slate-500"
                                        : "text-slate-400"
                                    }`}
                                  >
                                    {item.quantity}{" "}
                                    ×{" "}
                                    {formatPrice(
                                      price
                                    )}
                                  </p>
                                </div>

                                <div className="flex items-center justify-between gap-5 sm:justify-end">
                                  <div className="text-right">
                                    <p className="font-black">
                                      {formatPrice(
                                        price *
                                          item.quantity
                                      )}
                                    </p>

                                    {unpaid >
                                      0 && (
                                      <p className="mt-1 text-xs font-bold text-orange-500">
                                        {unpaid}{" "}
                                        offen
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>

                      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                        {openOrder && (
                          <button
                            type="button"
                            onClick={
                              finishOrder
                            }
                            disabled={saving}
                            className="rounded-xl bg-orange-500 px-6 py-3 text-sm font-black text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {saving
                              ? "Speichere..."
                              : "✓ Bestellung fertig"}
                          </button>
                        )}

                        {tableStatuses[
                          selectedTable
                        ] ===
                          "fertig" &&
                          paymentItems.length >
                            0 && (
                            <button
                              type="button"
                              onClick={
                                openPayment
                              }
                              disabled={
                                saving
                              }
                              className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              💳 Zur
                              Bezahlung
                            </button>
                          )}

                        <button
                          type="button"
                          onClick={
                            startAddingOrder
                          }
                          disabled={saving}
                          className={`rounded-xl px-6 py-3 text-sm font-black ${
                            dark
                              ? "bg-slate-800 hover:bg-slate-700"
                              : "bg-slate-100 hover:bg-slate-200"
                          }`}
                        >
                          ＋ Weitere
                          Produkte
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
          </section>
        )}
      </div>

      {/* AKTUALISIERUNGSINDIKATOR */}

      {refreshing && (
        <div className="fixed bottom-5 right-5 z-50 rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-lg">
          ↻ Aktualisiere...
        </div>
      )}
    </main>
  );
}