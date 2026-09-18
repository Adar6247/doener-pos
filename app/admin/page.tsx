"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useTheme } from "../components/ThemeProvider";

type Profile = {
  id: string;
  name: string;
  role: "waiter" | "kitchen" | "admin";
  created_at: string;
};

type OrderItem = {
  id: number;
  order_id: number;
  product_name: string;
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

type DailyStatistic = {
  date: string;
  label: string;
  count: number;
};

type Product = {
  id: number;
  name: string;
  price: number;
  category: string;
  created_at: string;
};

/* =========================================================
   PRODUKTLISTE
   ========================================================= */

const PRODUCT_CATALOG = [
  {
    category: "Lahmacun-Spezialitäten",
    products: [
      "Lahmacun",
      "Lahmacun mit Salat und Soße (gerollt)",
      "Lahmacun mit Käse",
      "Lahmacun Spezial",
      "Lahmacun Teller",
      "Lahmacun Spezial Teller",
    ],
  },

  {
    category: "Grillspezialitäten",
    products: [
      "Lammspieße",
      "Lammkoteletts",
      "Adana Kebap",
      "Steak",
      "Gemischter Grill",
      "Chicken Nuggets mit Pommes",
      "Chicken Wings mit Pommes",
    ],
  },

  {
    category: "Burger",
    products: [
      "Hamburger (55 g)",
      "Hamburger XXL (125 g)",
      "Cheeseburger (55 g)",
      "Cheeseburger XXL (125 g)",
      "Chickenburger (90 g)",
    ],
  },

  {
    category: "Salate",
    products: [
      "Gemischter Salat (klein)",
      "Gemischter Salat (groß)",
      "Hirten-Salat",
      "Salat Tonno",
      "Salat mit Putenstreifen",
    ],
  },

  {
    category: "Pizza (Ø 30 cm)",
    products: [
      "Pizza Margherita",
      "Pizza Funghi",
      "Pizza Spinat",
      "Pizza Peperoni",
      "Pizza Salami",
      "Pizza Schinken",
      "Pizza Sucuk",
      "Pizza Hawaii",
      "Pizza Artischocken",
      "Pizza Tonno",
      "Pizza Kebap",
      "Pizza Chipolla",
      "Pizza Vegetarisch",
      "Pizza Sucuk Spezial",
      "Pizza Döner Spezial",
      "Pizza Meeresfrüchte",
      "Pizza Vier Jahreszeiten",
      "Pizza Sardellen",
      "Party-Pizza (60x40 cm)",
    ],
  },

  {
    category: "Flammkuchen",
    products: [
      "Flammkuchen",
    ],
  },

  {
    category: "Döner-Spezialitäten",
    products: [
      "Döner im Fladenbrot",
      "Döner mit Käse im Fladenbrot",
      "Yufka Döner",
      "Döner Vegetarisch",
      "Yufka Vegetarisch",
      "Vegetarischer Teller",
      "Döner Box",
      "Döner Teller",
      "Döner Teller (klein)",
    ],
  },

  {
    category: "Falafel-Spezialitäten",
    products: [
      "Falafel im Fladenbrot",
      "Falafel Box",
      "Falafel Teller",
    ],
  },

  {
    category: "Extras",
    products: [
      "Portion Pommes",
      "Iskender",
    ],
  },

  {
    category: "Pide und Seele",
    products: [
      "Pide mit Käse",
      "Pide mit Hackfleisch",
      "Pide mit Spinat & Käse",
      "Pide mit Sucuk & Käse",
      "Seele mit Putenschinken und Käse",
      "Seele mit Dönerfleisch, frischen Tomaten und Zwiebeln",
    ],
  },

  {
    category: "Warme Getränke",
    products: [
      "Tasse Kaffee (klein)",
    ],
  },

  {
    category: "Alkoholische Getränke",
    products: [
      "Hofbräu 0,5 l",
      "Pils Hofbräu 0,5 l",
      "Hefeweizen hell 0,5 l",
      "Kristallweizen 0,5 l",
      "Radler 0,5 l",
      "Beck’s 0,33 l",
      "Beck’s Lemon 0,33 l",
      "Tannenzäpfle 0,33 l",
      "Desperados 0,33 l",
      "Rotwein Trollinger 0,25 l",
      "Weißwein Riesling 0,25 l",
      "Rosé Württemberger 0,25 l",
      "Weinschorle 0,25 l",
    ],
  },

  {
    category: "Kalte Getränke – Softdrinks",
    products: [
      "Fanta 0,3 l",
      "Fanta 0,5 l",
      "Coca-Cola 0,3 l",
      "Coca-Cola 0,5 l",
      "Coca-Cola Light 0,3 l",
      "Coca-Cola Light 0,5 l",
      "Sprite 0,3 l",
      "Sprite 0,5 l",
      "Spezi 0,3 l",
      "Spezi 0,5 l",
      "Red Bull 0,25 l",
      "Wasser 0,3 l",
      "Wasser 0,5 l",
    ],
  },

  {
    category: "Kalte Getränke – Säfte",
    products: [
      "Orangensaft 0,3 l",
      "Kirschsaft 0,3 l",
      "Kiba (Kirsch-Banane) 0,3 l",
      "Bananensaft 0,3 l",
      "Bananensaft 0,5 l",
      "Apfelsaft 0,3 l",
      "Apfelsaft 0,5 l",
      "Johannisbeersaft 0,3 l",
      "Johannisbeersaft 0,5 l",
      "Apfelschorle 0,3 l",
      "Apfelschorle 0,5 l",
    ],
  },

  {
    category: "Schweppes",
    products: [
      "Ginger Ale",
      "Tonic Water",
      "Bitter Lemon",
    ],
  },

  {
    category: "Cocktails",
    products: [
      "Aperol Spritz",
      "Hugo",
      "Campari Orange",
      "Campari Soda",
    ],
  },

  {
    category: "Longdrinks",
    products: [
      "Jacky Cola 2 cl",
      "Jacky Cola 4 cl",
      "Wodka Lemon 2 cl",
      "Wodka Lemon 4 cl",
      "Wodka Bull 2 cl",
      "Wodka Bull 4 cl",
      "Wodka Orange 2 cl",
      "Wodka Orange 4 cl",
      "Asbach Cola 2 cl",
      "Asbach Cola 4 cl",
      "Gin Tonic 2 cl",
      "Gin Tonic 4 cl",
    ],
  },

  {
    category: "Spirituosen",
    products: [
      "Jägermeister",
      "Ramazzotti",
      "Wodka",
      "Tequila",
      "Asbach",
      "Baileys",
      "Williams",
    ],
  },
];

export default function AdminPage() {
  const { theme, setTheme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsMessage, setProductsMessage] = useState("");
  const [savingPrice, setSavingPrice] = useState<number | null>(null);

  const [showEmployees, setShowEmployees] = useState(false);
  const [showOrders, setShowOrders] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);
  const [showPrices, setShowPrices] = useState(false);

  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);

  const [employeeName, setEmployeeName] = useState("");
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [employeePassword, setEmployeePassword] = useState("");
  const [employeeRole, setEmployeeRole] = useState<
    "waiter" | "kitchen" | "admin"
  >("waiter");

  const [employeeMessage, setEmployeeMessage] = useState("");
  const [employeeLoading, setEmployeeLoading] = useState(false);

  const [statisticsLoading, setStatisticsLoading] = useState(false);
  const [statisticsError, setStatisticsError] = useState("");
  const [statisticsOrders, setStatisticsOrders] = useState<Order[]>([]);
  const [dailyStatistics, setDailyStatistics] = useState<
    DailyStatistic[]
  >([]);

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error || !profile || profile.role !== "admin") {
      setAuthorized(false);
      setLoading(false);
      return;
    }

    setAuthorized(true);

    await loadProfiles();
    await loadOrders();

    setLoading(false);
  }

  async function loadProfiles() {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("PROFILE FEHLER:", error);
      return;
    }

    setProfiles(data || []);
  }

  async function loadOrders() {
    const { data: ordersData, error: ordersError } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (ordersError) {
      console.error("ORDERS FEHLER:", ordersError);
      return;
    }

    const { data: itemsData, error: itemsError } = await supabase
      .from("order_items")
      .select("*")
      .order("id", { ascending: true });

    if (itemsError) {
      console.error("ORDER ITEMS FEHLER:", itemsError);
      return;
    }

    setOrders(ordersData || []);
    setOrderItems(itemsData || []);
  }

  async function loadProducts() {
    setProductsLoading(true);
    setProductsMessage("");

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("PRODUCT FEHLER:", error);

      setProductsMessage(
        error.message || "Produkte konnten nicht geladen werden."
      );

      setProductsLoading(false);
      return;
    }

    setProducts((data || []) as Product[]);
    setProductsLoading(false);
  }

  async function createCatalogProducts() {
    setProductsLoading(true);
    setProductsMessage("");

    const existingNames = new Set(
      products.map((product) => product.name)
    );

    const missingProducts: {
      name: string;
      category: string;
      price: number;
    }[] = [];

    for (const category of PRODUCT_CATALOG) {
      for (const productName of category.products) {
        if (!existingNames.has(productName)) {
          missingProducts.push({
            name: productName,
            category: category.category,
            price: 0,
          });
        }
      }
    }

    if (missingProducts.length === 0) {
      setProductsMessage(
        "Alle Produkte sind bereits angelegt."
      );
      setProductsLoading(false);
      return;
    }

    const { error } = await supabase
      .from("products")
      .insert(missingProducts);

    if (error) {
      console.error("PRODUCT ERSTELLEN FEHLER:", error);

      setProductsMessage(
        error.message ||
          "Produkte konnten nicht angelegt werden."
      );

      setProductsLoading(false);
      return;
    }

    setProductsMessage(
      `${missingProducts.length} Produkte wurden angelegt.`
    );

    await loadProducts();

    setProductsLoading(false);
  }

  async function updateProductPrice(
    productId: number,
    price: number
  ) {
    if (!Number.isFinite(price) || price < 0) {
      alert("Bitte einen gültigen Preis eingeben.");
      return;
    }

    setSavingPrice(productId);

    const { error } = await supabase
      .from("products")
      .update({
        price: Number(price.toFixed(2)),
      })
      .eq("id", productId);

    if (error) {
      console.error("PREIS FEHLER:", error);

      alert(
        error.message ||
          "Preis konnte nicht gespeichert werden."
      );

      setSavingPrice(null);
      return;
    }

    setProducts((currentProducts) =>
      currentProducts.map((product) =>
        product.id === productId
          ? {
              ...product,
              price: Number(price.toFixed(2)),
            }
          : product
      )
    );

    setSavingPrice(null);
  }

  function closeAllPanels() {
    setShowEmployees(false);
    setShowOrders(false);
    setShowSettings(false);
    setShowAddEmployee(false);
    setShowStatistics(false);
    setShowPrices(false);
  }

  function openEmployees() {
    closeAllPanels();
    setShowEmployees(true);
    loadProfiles();
  }

  function openOrders() {
    closeAllPanels();
    setShowOrders(true);
    loadOrders();
  }

  function openSettings() {
    closeAllPanels();
    setShowSettings(true);
  }

  function openPrices() {
    closeAllPanels();
    setShowPrices(true);
    loadProducts();
  }

  function openAddEmployee() {
    setShowAddEmployee(true);
    setEmployeeMessage("");
  }

  function closeAddEmployee() {
    setShowAddEmployee(false);
    setEmployeeName("");
    setEmployeeEmail("");
    setEmployeePassword("");
    setEmployeeRole("waiter");
    setEmployeeMessage("");
  }

  function openStatistics() {
    closeAllPanels();
    setShowStatistics(true);
    loadStatistics();
  }

  async function loadStatistics() {
    setStatisticsLoading(true);
    setStatisticsError("");

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("STATISTIK FEHLER:", error);

      setStatisticsError(
        error.message ||
          "Statistiken konnten nicht geladen werden."
      );

      setStatisticsLoading(false);
      return;
    }

    const loadedOrders = (data || []) as Order[];

    setStatisticsOrders(loadedOrders);

    const days: DailyStatistic[] = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();

      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - i);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const count = loadedOrders.filter((order) => {
        const orderDate = new Date(order.created_at);

        return (
          orderDate >= date &&
          orderDate < nextDate
        );
      }).length;

      days.push({
        date: date.toISOString(),
        label: date.toLocaleDateString("de-DE", {
          weekday: "short",
          day: "2-digit",
          month: "2-digit",
        }),
        count,
      });
    }

    setDailyStatistics(days);
    setStatisticsLoading(false);
  }

  function getStartOfToday() {
    const date = new Date();

    date.setHours(0, 0, 0, 0);

    return date;
  }

  function getStartOfWeek() {
    const date = new Date();

    date.setHours(0, 0, 0, 0);

    const day = date.getDay();
    const difference = day === 0 ? 6 : day - 1;

    date.setDate(date.getDate() - difference);

    return date;
  }

  function getStartOfMonth() {
    const date = new Date();

    date.setHours(0, 0, 0, 0);
    date.setDate(1);

    return date;
  }

  function getOrdersFromDate(date: Date) {
    return statisticsOrders.filter(
      (order) => new Date(order.created_at) >= date
    );
  }

  async function createEmployee() {
    if (!employeeName.trim()) {
      setEmployeeMessage("Bitte einen Namen eingeben.");
      return;
    }

    if (!employeeEmail.trim()) {
      setEmployeeMessage("Bitte eine E-Mail eingeben.");
      return;
    }

    if (employeePassword.length < 6) {
      setEmployeeMessage(
        "Das Passwort muss mindestens 6 Zeichen haben."
      );
      return;
    }

    setEmployeeLoading(true);
    setEmployeeMessage("");

    try {
      const response = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: employeeName,
          email: employeeEmail,
          password: employeePassword,
          role: employeeRole,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setEmployeeMessage(
          result.error ||
            "Mitarbeiter konnte nicht erstellt werden."
        );

        setEmployeeLoading(false);
        return;
      }

      setEmployeeMessage(
        "Mitarbeiter erfolgreich erstellt."
      );

      setEmployeeName("");
      setEmployeeEmail("");
      setEmployeePassword("");
      setEmployeeRole("waiter");

      await loadProfiles();

      setEmployeeLoading(false);
    } catch (error) {
      console.error(error);

      setEmployeeMessage(
        "Beim Erstellen ist ein Fehler aufgetreten."
      );

      setEmployeeLoading(false);
    }
  }

  async function updateEmployee(
    id: string,
    name: string,
    role: "waiter" | "kitchen" | "admin"
  ) {
    const response = await fetch("/api/admin/update-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id,
        name,
        role,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(
        result.error ||
          "Mitarbeiter konnte nicht aktualisiert werden."
      );
      return;
    }

    await loadProfiles();
  }

  async function updatePassword(id: string) {
    const password = window.prompt(
      "Neues Passwort eingeben:"
    );

    if (!password) {
      return;
    }

    if (password.length < 6) {
      alert(
        "Das Passwort muss mindestens 6 Zeichen haben."
      );
      return;
    }

    const response = await fetch(
      "/api/admin/update-password",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
          password,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      alert(
        result.error ||
          "Passwort konnte nicht geändert werden."
      );
      return;
    }

    alert("Passwort erfolgreich geändert.");
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function getProfileName(id: string) {
    const profile = profiles.find(
      (profile) => profile.id === id
    );

    return profile?.name || "Unbekannt";
  }

  function getItemsForOrder(orderId: number) {
    return orderItems.filter(
      (item) => item.order_id === orderId
    );
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleString("de-DE", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-700 dark:text-zinc-200 text-lg">
          Laden...
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="min-h-screen bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center p-6">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8 text-center max-w-md w-full">
          <h1 className="text-2xl font-bold text-red-600 mb-3">
            Kein Zugriff
          </h1>

          <p className="text-zinc-600 dark:text-zinc-300 mb-6">
            Du hast keine Berechtigung für den Adminbereich.
          </p>

          <button
            onClick={() => {
              window.location.href = "/dashboard";
            }}
            className="w-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl py-3 font-semibold"
          >
            Zum Dashboard
          </button>
        </div>
      </main>
    );
  }

  const todayOrders =
    getOrdersFromDate(getStartOfToday());

  const weekOrders =
    getOrdersFromDate(getStartOfWeek());

  const monthOrders =
    getOrdersFromDate(getStartOfMonth());

  const finishedOrders =
    statisticsOrders.filter(
      (order) => order.status === "fertig"
    );

  const openOrdersCount =
    statisticsOrders.filter(
      (order) => order.status === "offen"
    ).length;

  return (
    <main className="min-h-screen bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold">
              Adminbereich
            </h1>

            <p className="text-zinc-600 dark:text-zinc-400 mt-1">
              Döner POS Verwaltung
            </p>
          </div>

          <button
            onClick={logout}
            className="bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-xl font-semibold"
          >
            Abmelden
          </button>
        </div>

        {/* HAUPTKARTEN */}
        {!showEmployees &&
          !showOrders &&
          !showSettings &&
          !showStatistics &&
          !showPrices && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">

              <button
                onClick={openEmployees}
                className="text-left bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow hover:shadow-lg transition"
              >
                <div className="text-3xl mb-4">
                  👥
                </div>

                <h2 className="text-xl font-bold">
                  Mitarbeiter
                </h2>

                <p className="text-zinc-600 dark:text-zinc-400 mt-2">
                  Mitarbeiter verwalten
                </p>

                <p className="mt-4 font-semibold">
                  {profiles.length} Mitarbeiter
                </p>
              </button>

              <button
                onClick={openOrders}
                className="text-left bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow hover:shadow-lg transition"
              >
                <div className="text-3xl mb-4">
                  🧾
                </div>

                <h2 className="text-xl font-bold">
                  Bestellungen
                </h2>

                <p className="text-zinc-600 dark:text-zinc-400 mt-2">
                  Alle Bestellungen anzeigen
                </p>

                <p className="mt-4 font-semibold">
                  {orders.length} Bestellungen
                </p>
              </button>

              <button
                onClick={openStatistics}
                className="text-left bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow hover:shadow-lg transition"
              >
                <div className="text-3xl mb-4">
                  📊
                </div>

                <h2 className="text-xl font-bold">
                  Statistiken
                </h2>

                <p className="text-zinc-600 dark:text-zinc-400 mt-2">
                  Bestellungen und Auswertungen
                </p>
              </button>

              <button
                onClick={openPrices}
                className="text-left bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow hover:shadow-lg transition"
              >
                <div className="text-3xl mb-4">
                  💶
                </div>

                <h2 className="text-xl font-bold">
                  Preise
                </h2>

                <p className="text-zinc-600 dark:text-zinc-400 mt-2">
                  Preise verwalten
                </p>

                <p className="mt-4 font-semibold">
                  {products.length} Produkte
                </p>
              </button>

              <div className="text-left bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow">
                <div className="text-3xl mb-4">
                  🍽️
                </div>

                <h2 className="text-xl font-bold">
                  Produkte
                </h2>

                <p className="text-zinc-600 dark:text-zinc-400 mt-2">
                  Produkte verwalten
                </p>

                <p className="mt-4 text-zinc-500">
                  Bald verfügbar
                </p>
              </div>

              <button
                onClick={openSettings}
                className="text-left bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow hover:shadow-lg transition"
              >
                <div className="text-3xl mb-4">
                  ⚙️
                </div>

                <h2 className="text-xl font-bold">
                  Einstellungen
                </h2>

                <p className="text-zinc-600 dark:text-zinc-400 mt-2">
                  System-Einstellungen
                </p>
              </button>

            </div>
          )}

        {/* ZURÜCK BUTTON */}
        {(showEmployees ||
          showOrders ||
          showSettings ||
          showStatistics ||
          showPrices) && (
          <button
            onClick={closeAllPanels}
            className="mb-6 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 px-5 py-3 rounded-xl font-semibold"
          >
            ← Zurück
          </button>
        )}

        {/* =====================================================
            PREISE
            ===================================================== */}

        {showPrices && (
          <section className="bg-white dark:bg-zinc-900 rounded-2xl shadow p-6">

            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">

              <div>
                <h2 className="text-2xl font-bold">
                  Preisverwaltung
                </h2>

                <p className="text-zinc-600 dark:text-zinc-400">
                  Hier kannst du später alle Preise ändern.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">

                <button
                  onClick={createCatalogProducts}
                  disabled={productsLoading}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-5 py-3 rounded-xl font-semibold"
                >
                  {productsLoading
                    ? "Bitte warten..."
                    : "🍽️ Speisekarte anlegen"}
                </button>

                <button
                  onClick={loadProducts}
                  disabled={productsLoading}
                  className="bg-zinc-200 dark:bg-zinc-800 px-5 py-3 rounded-xl font-semibold"
                >
                  Aktualisieren
                </button>

              </div>
            </div>

            {productsMessage && (
              <div className="mb-6 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-xl p-4">
                {productsMessage}
              </div>
            )}

            {productsLoading ? (
              <div className="py-12 text-center">
                <p className="text-zinc-600 dark:text-zinc-400">
                  Produkte werden geladen...
                </p>
              </div>
            ) : products.length === 0 ? (
              <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl p-8 text-center">

                <div className="text-5xl mb-4">
                  🍽️
                </div>

                <h3 className="text-xl font-bold mb-2">
                  Noch keine Produkte angelegt
                </h3>

                <p className="text-zinc-600 dark:text-zinc-400 mb-5">
                  Klicke auf „Speisekarte anlegen“.
                  Dann werden alle Produkte automatisch
                  mit 0,00 € angelegt.
                </p>

                <button
                  onClick={createCatalogProducts}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-semibold"
                >
                  Speisekarte anlegen
                </button>

              </div>
            ) : (
              <div className="space-y-6">

                {PRODUCT_CATALOG.map((category) => {

                  const categoryProducts =
                    products.filter(
                      (product) =>
                        product.category ===
                        category.category
                    );

                  if (categoryProducts.length === 0) {
                    return null;
                  }

                  return (
                    <div
                      key={category.category}
                      className="border border-zinc-200 dark:border-zinc-700 rounded-2xl overflow-hidden"
                    >

                      <div className="bg-zinc-100 dark:bg-zinc-800 px-5 py-4">
                        <h3 className="text-xl font-bold">
                          {category.category}
                        </h3>
                      </div>

                      <div className="divide-y divide-zinc-200 dark:divide-zinc-700">

                        {categoryProducts.map(
                          (product) => (
                            <div
                              key={product.id}
                              className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                            >

                              <div>
                                <p className="font-semibold">
                                  {product.name}
                                </p>

                                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                  Aktueller Preis:{" "}
                                  {product.price.toFixed(2)} €
                                </p>
                              </div>

                              <div className="flex items-center gap-2">

                                <input
                                  type="number"
                                  min="0"
                                  step="0.10"
                                  defaultValue={product.price.toFixed(2)}
                                  id={`price-${product.id}`}
                                  className="w-28 rounded-xl px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 outline-none text-right"
                                />

                                <button
                                  onClick={() => {
                                    const input =
                                      document.getElementById(
                                        `price-${product.id}`
                                      ) as HTMLInputElement | null;

                                    if (!input) {
                                      return;
                                    }

                                    const price =
                                      Number(input.value);

                                    updateProductPrice(
                                      product.id,
                                      price
                                    );
                                  }}
                                  disabled={
                                    savingPrice ===
                                    product.id
                                  }
                                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl font-semibold"
                                >
                                  {savingPrice ===
                                  product.id
                                    ? "..."
                                    : "Speichern"}
                                </button>

                              </div>
                            </div>
                          )
                        )}

                      </div>
                    </div>
                  );
                })}

              </div>
            )}

          </section>
        )}

        {/* =====================================================
            MITARBEITER
            ===================================================== */}

        {showEmployees && (
          <section className="bg-white dark:bg-zinc-900 rounded-2xl shadow p-6">

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">

              <div>
                <h2 className="text-2xl font-bold">
                  Mitarbeiter
                </h2>

                <p className="text-zinc-600 dark:text-zinc-400">
                  Mitarbeiter verwalten
                </p>
              </div>

              <button
                onClick={openAddEmployee}
                className="bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-xl font-semibold"
              >
                + Mitarbeiter hinzufügen
              </button>

            </div>

            {showAddEmployee && (
              <div className="mb-8 bg-zinc-100 dark:bg-zinc-800 rounded-2xl p-6">

                <div className="flex justify-between items-center mb-5">

                  <h3 className="text-xl font-bold">
                    Mitarbeiter erstellen
                  </h3>

                  <button
                    onClick={closeAddEmployee}
                    className="text-zinc-500 hover:text-red-500 text-xl"
                  >
                    ✕
                  </button>

                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  <input
                    value={employeeName}
                    onChange={(e) =>
                      setEmployeeName(e.target.value)
                    }
                    placeholder="Name"
                    className="w-full rounded-xl px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 outline-none"
                  />

                  <input
                    value={employeeEmail}
                    onChange={(e) =>
                      setEmployeeEmail(e.target.value)
                    }
                    placeholder="E-Mail"
                    type="email"
                    className="w-full rounded-xl px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 outline-none"
                  />

                  <input
                    value={employeePassword}
                    onChange={(e) =>
                      setEmployeePassword(e.target.value)
                    }
                    placeholder="Passwort"
                    type="password"
                    className="w-full rounded-xl px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 outline-none"
                  />

                  <select
                    value={employeeRole}
                    onChange={(e) =>
                      setEmployeeRole(
                        e.target.value as
                          | "waiter"
                          | "kitchen"
                          | "admin"
                      )
                    }
                    className="w-full rounded-xl px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 outline-none"
                  >
                    <option value="waiter">
                      Kellner
                    </option>

                    <option value="kitchen">
                      Küche
                    </option>

                    <option value="admin">
                      Admin
                    </option>
                  </select>

                </div>

                <button
                  onClick={createEmployee}
                  disabled={employeeLoading}
                  className="mt-5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-semibold"
                >
                  {employeeLoading
                    ? "Erstelle..."
                    : "Mitarbeiter erstellen"}
                </button>

                {employeeMessage && (
                  <p className="mt-4 font-medium">
                    {employeeMessage}
                  </p>
                )}

              </div>
            )}

            <div className="space-y-4">

              {profiles.map((profile) => (
                <div
                  key={profile.id}
                  className="border border-zinc-200 dark:border-zinc-700 rounded-2xl p-5"
                >

                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

                    <div>

                      <h3 className="font-bold text-lg">
                        {profile.name}
                      </h3>

                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        {profile.role === "waiter"
                          ? "Kellner"
                          : profile.role === "kitchen"
                          ? "Küche"
                          : "Admin"}
                      </p>

                    </div>

                    <div className="flex flex-wrap gap-2">

                      <button
                        onClick={() => {
                          const name =
                            window.prompt(
                              "Neuer Name:",
                              profile.name
                            );

                          if (!name) return;

                          updateEmployee(
                            profile.id,
                            name,
                            profile.role
                          );
                        }}
                        className="bg-zinc-200 dark:bg-zinc-800 px-4 py-2 rounded-lg font-medium"
                      >
                        Name ändern
                      </button>

                      <button
                        onClick={() => {
                          const role =
                            window.prompt(
                              "Rolle: waiter, kitchen oder admin",
                              profile.role
                            );

                          if (
                            role !== "waiter" &&
                            role !== "kitchen" &&
                            role !== "admin"
                          ) {
                            return;
                          }

                          updateEmployee(
                            profile.id,
                            profile.name,
                            role
                          );
                        }}
                        className="bg-zinc-200 dark:bg-zinc-800 px-4 py-2 rounded-lg font-medium"
                      >
                        Rolle ändern
                      </button>

                      <button
                        onClick={() =>
                          updatePassword(profile.id)
                        }
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
                      >
                        Passwort
                      </button>

                    </div>

                  </div>

                </div>
              ))}

              {profiles.length === 0 && (
                <p className="text-zinc-600 dark:text-zinc-400">
                  Keine Mitarbeiter gefunden.
                </p>
              )}

            </div>

          </section>
        )}

        {/* =====================================================
            BESTELLUNGEN
            ===================================================== */}

        {showOrders && (
          <section className="bg-white dark:bg-zinc-900 rounded-2xl shadow p-6">

            <div className="flex items-center justify-between mb-6">

              <div>
                <h2 className="text-2xl font-bold">
                  Bestellungen
                </h2>

                <p className="text-zinc-600 dark:text-zinc-400">
                  Alle Bestellungen
                </p>
              </div>

              <button
                onClick={loadOrders}
                className="bg-zinc-200 dark:bg-zinc-800 px-4 py-2 rounded-xl font-semibold"
              >
                Aktualisieren
              </button>

            </div>

            <div className="space-y-4">

              {orders.map((order) => {

                const items =
                  getItemsForOrder(order.id);

                const isExpanded =
                  expandedOrder === order.id;

                return (
                  <div
                    key={order.id}
                    className="border border-zinc-200 dark:border-zinc-700 rounded-2xl overflow-hidden"
                  >

                    <button
                      onClick={() =>
                        setExpandedOrder(
                          isExpanded
                            ? null
                            : order.id
                        )
                      }
                      className="w-full text-left p-5 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >

                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">

                        <div>

                          <h3 className="font-bold text-lg">
                            Bestellung #{order.id}
                          </h3>

                          <p className="text-zinc-600 dark:text-zinc-400">
                            Tisch {order.table_number}
                          </p>

                        </div>

                        <div className="flex flex-col md:items-end gap-1">

                          <span
                            className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${
                              order.status === "fertig"
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                            }`}
                          >
                            {order.status === "fertig"
                              ? "Fertig"
                              : "Offen"}
                          </span>

                          <span className="text-sm text-zinc-600 dark:text-zinc-400">
                            {formatDate(
                              order.created_at
                            )}
                          </span>

                        </div>

                      </div>

                    </button>

                    {isExpanded && (
                      <div className="border-t border-zinc-200 dark:border-zinc-700 p-5">

                        <div className="mb-4">

                          <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            Kellner
                          </p>

                          <p className="font-semibold">
                            {getProfileName(
                              order.waiter_id
                            )}
                          </p>

                        </div>

                        <div>

                          <p className="font-bold mb-3">
                            Artikel
                          </p>

                          <div className="space-y-2">

                            {items.map((item) => (
                              <div
                                key={item.id}
                                className="flex justify-between bg-zinc-100 dark:bg-zinc-800 rounded-xl px-4 py-3"
                              >
                                <span>
                                  {item.product_name}
                                </span>

                                <span className="font-bold">
                                  × {item.quantity}
                                </span>
                              </div>
                            ))}

                            {items.length === 0 && (
                              <p className="text-zinc-600 dark:text-zinc-400">
                                Keine Artikel gefunden.
                              </p>
                            )}

                          </div>

                        </div>

                        {order.finished_at && (
                          <p className="mt-4 text-sm text-green-600">
                            Fertiggestellt:{" "}
                            {formatDate(
                              order.finished_at
                            )}
                          </p>
                        )}

                      </div>
                    )}

                  </div>
                );
              })}

              {orders.length === 0 && (
                <p className="text-zinc-600 dark:text-zinc-400">
                  Keine Bestellungen vorhanden.
                </p>
              )}

            </div>

          </section>
        )}

        {/* =====================================================
            STATISTIK
            ===================================================== */}

        {showStatistics && (
          <section className="bg-white dark:bg-zinc-900 rounded-2xl shadow p-6">

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">

              <div>
                <h2 className="text-2xl font-bold">
                  Statistiken
                </h2>

                <p className="text-zinc-600 dark:text-zinc-400">
                  Übersicht über deine Bestellungen
                </p>
              </div>

              <button
                onClick={loadStatistics}
                className="bg-zinc-200 dark:bg-zinc-800 px-4 py-2 rounded-xl font-semibold"
              >
                Aktualisieren
              </button>

            </div>

            {statisticsLoading ? (
              <div className="py-12 text-center">
                <p className="text-zinc-600 dark:text-zinc-400">
                  Statistiken werden geladen...
                </p>
              </div>
            ) : statisticsError ? (
              <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-xl p-4">
                {statisticsError}
              </div>
            ) : (
              <>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">

                  <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl p-6">

                    <p className="text-zinc-600 dark:text-zinc-400">
                      Heute
                    </p>

                    <p className="text-4xl font-bold mt-2">
                      {todayOrders.length}
                    </p>

                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                      Bestellungen
                    </p>

                  </div>

                  <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl p-6">

                    <p className="text-zinc-600 dark:text-zinc-400">
                      Diese Woche
                    </p>

                    <p className="text-4xl font-bold mt-2">
                      {weekOrders.length}
                    </p>

                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                      Bestellungen
                    </p>

                  </div>

                  <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl p-6">

                    <p className="text-zinc-600 dark:text-zinc-400">
                      Dieser Monat
                    </p>

                    <p className="text-4xl font-bold mt-2">
                      {monthOrders.length}
                    </p>

                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                      Bestellungen
                    </p>

                  </div>

                  <div className="bg-green-100 dark:bg-green-900/20 rounded-2xl p-6">

                    <p className="text-green-700 dark:text-green-400">
                      Fertige Bestellungen
                    </p>

                    <p className="text-4xl font-bold mt-2 text-green-700 dark:text-green-400">
                      {finishedOrders.length}
                    </p>

                    <p className="text-sm text-green-600 dark:text-green-500 mt-1">
                      Insgesamt
                    </p>

                  </div>

                  <div className="bg-yellow-100 dark:bg-yellow-900/20 rounded-2xl p-6">

                    <p className="text-yellow-700 dark:text-yellow-400">
                      Offene Bestellungen
                    </p>

                    <p className="text-4xl font-bold mt-2 text-yellow-700 dark:text-yellow-400">
                      {openOrdersCount}
                    </p>

                    <p className="text-sm text-yellow-600 dark:text-yellow-500 mt-1">
                      Insgesamt
                    </p>

                  </div>

                  <div className="bg-blue-100 dark:bg-blue-900/20 rounded-2xl p-6">

                    <p className="text-blue-700 dark:text-blue-400">
                      Gesamt
                    </p>

                    <p className="text-4xl font-bold mt-2 text-blue-700 dark:text-blue-400">
                      {statisticsOrders.length}
                    </p>

                    <p className="text-sm text-blue-600 dark:text-blue-500 mt-1">
                      Bestellungen
                    </p>

                  </div>

                </div>

                <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl p-6">

                  <h3 className="text-xl font-bold mb-6">
                    Bestellungen der letzten 7 Tage
                  </h3>

                  <div className="space-y-4">

                    {dailyStatistics.map((day) => {

                      const maxCount = Math.max(
                        ...dailyStatistics.map(
                          (item) => item.count
                        ),
                        1
                      );

                      const width =
                        (day.count / maxCount) * 100;

                      return (
                        <div key={day.date}>

                          <div className="flex justify-between mb-2 text-sm">

                            <span className="font-medium">
                              {day.label}
                            </span>

                            <span className="font-bold">
                              {day.count}
                            </span>

                          </div>

                          <div className="w-full h-4 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">

                            <div
                              className="h-full bg-blue-600 rounded-full transition-all"
                              style={{
                                width: `${width}%`,
                              }}
                            />

                          </div>

                        </div>
                      );
                    })}

                  </div>

                </div>

                <div className="mt-6 bg-zinc-100 dark:bg-zinc-800 rounded-2xl p-5">

                  <p className="font-semibold">
                    💡 Hinweis
                  </p>

                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
                    Der Umsatz wird später berechnet,
                    sobald die Produktpreise im System
                    gespeichert werden.
                  </p>

                </div>

              </>
            )}

          </section>
        )}

        {/* =====================================================
            EINSTELLUNGEN
            ===================================================== */}

        {showSettings && (
          <section className="bg-white dark:bg-zinc-900 rounded-2xl shadow p-6">

            <h2 className="text-2xl font-bold mb-2">
              Einstellungen
            </h2>

            <p className="text-zinc-600 dark:text-zinc-400 mb-8">
              Einstellungen des POS-Systems
            </p>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-700 pb-6">

              <div>

                <h3 className="font-bold text-lg">
                  Erscheinungsbild
                </h3>

                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Hell- oder Dunkelmodus
                </p>

              </div>

              <div className="flex gap-2">

                <button
                  onClick={() => setTheme("light")}
                  className={`px-5 py-3 rounded-xl font-semibold ${
                    theme === "light"
                      ? "bg-blue-600 text-white"
                      : "bg-zinc-200 dark:bg-zinc-800"
                  }`}
                >
                  ☀️ Hell
                </button>

                <button
                  onClick={() => setTheme("dark")}
                  className={`px-5 py-3 rounded-xl font-semibold ${
                    theme === "dark"
                      ? "bg-blue-600 text-white"
                      : "bg-zinc-200 dark:bg-zinc-800"
                  }`}
                >
                  🌙 Dunkel
                </button>

              </div>

            </div>

          </section>
        )}

      </div>
    </main>
  );
}