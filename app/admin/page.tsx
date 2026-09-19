"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/app/components/ThemeProvider";

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
  paid_quantity: number;
  paid_at: string | null;
};

type Order = {
  id: number;
  table_number: number;
  waiter_id: string;
  status: "offen" | "fertig";
  created_at: string;
  finished_at: string | null;
};

type Product = {
  id: number;
  name: string;
  price: number;
  category: string;
  created_at: string;
};

type DailyStatistic = {
  date: string;
  orders: number;
  finished: number;
};

type CatalogProduct = {
  name: string;
  price: number;
  category: string;
};

/* =========================================================
   PRODUKTKATALOG
   ========================================================= */

const PRODUCT_CATALOG: CatalogProduct[] = [
  /* LAHMACUN */
  { name: "Lahmacun", price: 6.5, category: "Lahmacun-Spezialitäten" },
  { name: "Lahmacun mit Salat", price: 7.5, category: "Lahmacun-Spezialitäten" },
  { name: "Lahmacun mit Dönerfleisch", price: 9.5, category: "Lahmacun-Spezialitäten" },
  { name: "Lahmacun mit Dönerfleisch und Käse", price: 10.5, category: "Lahmacun-Spezialitäten" },

  /* GRILL */
  { name: "Adana Kebab", price: 14.5, category: "Grillspezialitäten" },
  { name: "Urfa Kebab", price: 14.5, category: "Grillspezialitäten" },
  { name: "Hähnchenspieß", price: 14.5, category: "Grillspezialitäten" },
  { name: "Lammspieß", price: 16.5, category: "Grillspezialitäten" },
  { name: "Köfte", price: 13.5, category: "Grillspezialitäten" },
  { name: "Grillteller", price: 20.5, category: "Grillspezialitäten" },
  { name: "Hähnchenflügel", price: 13.5, category: "Grillspezialitäten" },

  /* BURGER */
  { name: "Hamburger", price: 7.5, category: "Burger" },
  { name: "Cheeseburger", price: 8.0, category: "Burger" },
  { name: "Chickenburger", price: 8.0, category: "Burger" },
  { name: "Doppel Cheeseburger", price: 10.5, category: "Burger" },

  /* SALATE */
  { name: "Gemischter Salat", price: 7.0, category: "Salate" },
  { name: "Bauernsalat", price: 8.0, category: "Salate" },
  { name: "Hirtensalat", price: 8.0, category: "Salate" },
  { name: "Thunfischsalat", price: 9.0, category: "Salate" },
  { name: "Döner Salat", price: 10.0, category: "Salate" },

  /* PIZZA */
  { name: "Pizza Margherita", price: 8.0, category: "Pizza (Ø 30 cm)" },
  { name: "Pizza Salami", price: 9.0, category: "Pizza (Ø 30 cm)" },
  { name: "Pizza Schinken", price: 9.0, category: "Pizza (Ø 30 cm)" },
  { name: "Pizza Funghi", price: 9.0, category: "Pizza (Ø 30 cm)" },
  { name: "Pizza Tonno", price: 10.0, category: "Pizza (Ø 30 cm)" },
  { name: "Pizza Hawaii", price: 10.0, category: "Pizza (Ø 30 cm)" },
  { name: "Pizza Vegetarisch", price: 10.0, category: "Pizza (Ø 30 cm)" },
  { name: "Pizza Döner", price: 11.0, category: "Pizza (Ø 30 cm)" },
  { name: "Pizza Diavolo", price: 10.5, category: "Pizza (Ø 30 cm)" },
  { name: "Pizza Spezial", price: 12.0, category: "Pizza (Ø 30 cm)" },

  /* FLAMMKUCHEN */
  { name: "Flammkuchen Klassisch", price: 9.0, category: "Flammkuchen" },
  { name: "Flammkuchen Speck", price: 10.0, category: "Flammkuchen" },
  { name: "Flammkuchen Vegetarisch", price: 10.0, category: "Flammkuchen" },
  { name: "Flammkuchen Döner", price: 11.0, category: "Flammkuchen" },

  /* DÖNER */
  { name: "Döner im Fladenbrot", price: 8.0, category: "Döner-Spezialitäten" },
  { name: "Döner mit Käse", price: 9.0, category: "Döner-Spezialitäten" },
  { name: "Döner Teller", price: 12.5, category: "Döner-Spezialitäten" },
  { name: "Döner Teller mit Pommes", price: 14.0, category: "Döner-Spezialitäten" },
  { name: "Döner Box", price: 8.5, category: "Döner-Spezialitäten" },
  { name: "Döner Box mit Salat", price: 8.5, category: "Döner-Spezialitäten" },
  { name: "Dürüm Döner", price: 8.5, category: "Döner-Spezialitäten" },
  { name: "Dürüm Döner mit Käse", price: 9.5, category: "Döner-Spezialitäten" },

  /* FALAFEL */
  { name: "Falafel im Brot", price: 7.0, category: "Falafel-Spezialitäten" },
  { name: "Falafel Dürüm", price: 7.5, category: "Falafel-Spezialitäten" },
  { name: "Falafel Teller", price: 10.5, category: "Falafel-Spezialitäten" },
  { name: "Falafel Box", price: 7.5, category: "Falafel-Spezialitäten" },

  /* EXTRAS */
  { name: "Pommes klein", price: 3.5, category: "Extras" },
  { name: "Pommes groß", price: 5.0, category: "Extras" },
  { name: "Käse", price: 1.0, category: "Extras" },
  { name: "Extra Fleisch", price: 2.5, category: "Extras" },
  { name: "Extra Soße", price: 0.8, category: "Extras" },
  { name: "Oliven", price: 1.0, category: "Extras" },
  { name: "Peperoni", price: 1.0, category: "Extras" },

  /* PIDE */
  { name: "Pide mit Käse", price: 9.0, category: "Pide und Seele" },
  { name: "Pide mit Hackfleisch", price: 10.0, category: "Pide und Seele" },
  { name: "Pide mit Spinat", price: 10.0, category: "Pide und Seele" },
  { name: "Pide mit Dönerfleisch", price: 11.0, category: "Pide und Seele" },
  { name: "Seele mit Käse", price: 9.0, category: "Pide und Seele" },
  { name: "Seele mit Salami", price: 10.0, category: "Pide und Seele" },

  /* WARME GETRÄNKE */
  { name: "Türkischer Tee", price: 2.0, category: "Warme Getränke" },
  { name: "Schwarzer Tee", price: 2.5, category: "Warme Getränke" },
  { name: "Kaffee", price: 2.5, category: "Warme Getränke" },
  { name: "Espresso", price: 2.5, category: "Warme Getränke" },
  { name: "Cappuccino", price: 3.5, category: "Warme Getränke" },
  { name: "Latte Macchiato", price: 3.8, category: "Warme Getränke" },

  /* SOFTDRINKS */
  { name: "Coca Cola", price: 3.0, category: "Kalte Getränke – Softdrinks" },
  { name: "Coca Cola Zero", price: 3.0, category: "Kalte Getränke – Softdrinks" },
  { name: "Fanta", price: 3.0, category: "Kalte Getränke – Softdrinks" },
  { name: "Sprite", price: 3.0, category: "Kalte Getränke – Softdrinks" },
  { name: "Mezzo Mix", price: 3.0, category: "Kalte Getränke – Softdrinks" },
  { name: "Spezi", price: 3.0, category: "Kalte Getränke – Softdrinks" },
  { name: "Mineralwasser", price: 2.5, category: "Kalte Getränke – Softdrinks" },
  { name: "Stilles Wasser", price: 2.5, category: "Kalte Getränke – Softdrinks" },

  /* SÄFTE */
  { name: "Orangensaft", price: 3.5, category: "Kalte Getränke – Säfte" },
  { name: "Apfelsaft", price: 3.5, category: "Kalte Getränke – Säfte" },
  { name: "Kirschsaft", price: 3.5, category: "Kalte Getränke – Säfte" },
  { name: "Multivitaminsaft", price: 3.5, category: "Kalte Getränke – Säfte" },

  /* SCHWEPPES */
  { name: "Schweppes Tonic", price: 3.5, category: "Schweppes" },
  { name: "Schweppes Bitter Lemon", price: 3.5, category: "Schweppes" },
  { name: "Schweppes Ginger Ale", price: 3.5, category: "Schweppes" },

  /* COCKTAILS */
  { name: "Mojito", price: 8.5, category: "Cocktails" },
  { name: "Caipirinha", price: 8.5, category: "Cocktails" },
  { name: "Pina Colada", price: 8.5, category: "Cocktails" },
  { name: "Sex on the Beach", price: 8.5, category: "Cocktails" },

  /* LONGDRINKS */
  { name: "Gin Tonic", price: 8.0, category: "Longdrinks" },
  { name: "Vodka Lemon", price: 8.0, category: "Longdrinks" },
  { name: "Vodka Orange", price: 8.0, category: "Longdrinks" },
  { name: "Whiskey Cola", price: 8.0, category: "Longdrinks" },

  /* SPIRITUOSEN */
  { name: "Vodka", price: 3.0, category: "Spirituosen" },
  { name: "Whiskey", price: 3.5, category: "Spirituosen" },
  { name: "Jägermeister", price: 3.0, category: "Spirituosen" },
];

/* =========================================================
   HILFSFUNKTIONEN
   ========================================================= */

function formatPrice(price: number) {
  return `${price.toFixed(2).replace(".", ",")} €`;
}

function formatDate(date: string) {
  return new Date(date).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* =========================================================
   ADMIN PAGE
   ========================================================= */

export default function AdminPage() {
  const { theme, setTheme } = useTheme();
  const dark = theme === "dark";

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [activeSection, setActiveSection] = useState<
    "dashboard" | "orders" | "employees" | "products" | "statistics" | "settings"
  >("dashboard");

  const [message, setMessage] = useState("");

  const [productModal, setProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productCategory, setProductCategory] = useState("");

  const [employeeModal, setEmployeeModal] = useState(false);
  const [employeeName, setEmployeeName] = useState("");
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [employeePassword, setEmployeePassword] = useState("");
  const [employeeRole, setEmployeeRole] = useState<
    "waiter" | "kitchen" | "admin"
  >("waiter");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Alle");

  /* =========================================================
     AUTH
     ========================================================= */

  useEffect(() => {
    loadAdmin();
  }, []);

  async function loadAdmin() {
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!profile || profile.role !== "admin") {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      setAuthorized(true);
      await loadData();
    } catch (error) {
      console.error(error);
    }

    setLoading(false);
  }

  async function loadData() {
    const [
      profilesResult,
      ordersResult,
      itemsResult,
      productsResult,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false }),

      supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false }),

      supabase
        .from("order_items")
        .select("*")
        .order("id", { ascending: true }),

      supabase
        .from("products")
        .select("*")
        .order("category", { ascending: true })
        .order("name", { ascending: true }),
    ]);

    if (profilesResult.data) {
      setProfiles(profilesResult.data);
    }

    if (ordersResult.data) {
      setOrders(ordersResult.data);
    }

    if (itemsResult.data) {
      setOrderItems(itemsResult.data);
    }

    if (productsResult.data) {
      setProducts(productsResult.data);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  /* =========================================================
     PRODUKTE
     ========================================================= */

  function openAddProduct() {
    setEditingProduct(null);
    setProductName("");
    setProductPrice("");
    setProductCategory(PRODUCT_CATALOG[0]?.category ?? "");
    setProductModal(true);
  }

  function openEditProduct(product: Product) {
    setEditingProduct(product);
    setProductName(product.name);
    setProductPrice(product.price.toString());
    setProductCategory(product.category);
    setProductModal(true);
  }

  async function saveProduct() {
    const name = productName.trim();
    const price = Number(productPrice.replace(",", "."));
    const category = productCategory.trim();

    if (!name || !category || !Number.isFinite(price) || price < 0) {
      setMessage("Bitte alle Felder korrekt ausfüllen.");
      return;
    }

    if (editingProduct) {
      const { error } = await supabase
        .from("products")
        .update({
          name,
          price,
          category,
        })
        .eq("id", editingProduct.id);

      if (error) {
        console.error(error);
        setMessage("Produkt konnte nicht geändert werden.");
        return;
      }

      setMessage("Produkt erfolgreich geändert.");
    } else {
      const { error } = await supabase
        .from("products")
        .insert({
          name,
          price,
          category,
        });

      if (error) {
        console.error(error);
        setMessage("Produkt konnte nicht erstellt werden.");
        return;
      }

      setMessage("Produkt erfolgreich erstellt.");
    }

    setProductModal(false);
    await loadData();
  }

  async function deleteProduct(id: number) {
    const product = products.find((item) => item.id === id);

    if (!product) return;

    const confirmed = window.confirm(
      `Möchtest du "${product.name}" wirklich löschen?`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      setMessage("Produkt konnte nicht gelöscht werden.");
      return;
    }

    setMessage("Produkt gelöscht.");
    await loadData();
  }

  async function createMenu() {
    let added = 0;

    for (const item of PRODUCT_CATALOG) {
      const { data: existing } = await supabase
        .from("products")
        .select("id")
        .eq("name", item.name)
        .maybeSingle();

      if (!existing) {
        const { error } = await supabase
          .from("products")
          .insert({
            name: item.name,
            price: item.price,
            category: item.category,
          });

        if (!error) {
          added++;
        }
      }
    }

    setMessage(
      added > 0
        ? `${added} Produkte wurden angelegt.`
        : "Alle Produkte sind bereits vorhanden."
    );

    await loadData();
  }

  /* =========================================================
     BESTELLUNGEN
     ========================================================= */

  async function finishOrder(orderId: number) {
    const { error } = await supabase
      .from("orders")
      .update({
        status: "fertig",
        finished_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (error) {
      console.error(error);
      setMessage("Bestellung konnte nicht abgeschlossen werden.");
      return;
    }

    setMessage("Bestellung abgeschlossen.");
    await loadData();
  }

  async function deleteOrder(orderId: number) {
    const confirmed = window.confirm(
      "Möchtest du diese Bestellung wirklich löschen?"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("orders")
      .delete()
      .eq("id", orderId);

    if (error) {
      console.error(error);
      setMessage("Bestellung konnte nicht gelöscht werden.");
      return;
    }

    setMessage("Bestellung gelöscht.");
    await loadData();
  }

  /* =========================================================
     MITARBEITER
     ========================================================= */

  async function createEmployee() {
    if (
      !employeeName.trim() ||
      !employeeEmail.trim() ||
      !employeePassword.trim()
    ) {
      setMessage("Bitte alle Mitarbeiterfelder ausfüllen.");
      return;
    }

    try {
      const response = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: employeeName.trim(),
          email: employeeEmail.trim(),
          password: employeePassword,
          role: employeeRole,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Mitarbeiter konnte nicht erstellt werden.");
        return;
      }

      setMessage("Mitarbeiter erfolgreich erstellt.");

      setEmployeeModal(false);
      setEmployeeName("");
      setEmployeeEmail("");
      setEmployeePassword("");
      setEmployeeRole("waiter");

      await loadData();
    } catch (error) {
      console.error(error);
      setMessage("Fehler beim Erstellen des Mitarbeiters.");
    }
  }

  async function deleteEmployee(id: string) {
    const profile = profiles.find((item) => item.id === id);

    if (!profile) return;

    const confirmed = window.confirm(
      `Möchtest du "${profile.name}" wirklich löschen?`
    );

    if (!confirmed) return;

    try {
      const response = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Mitarbeiter konnte nicht gelöscht werden.");
        return;
      }

      setMessage("Mitarbeiter gelöscht.");
      await loadData();
    } catch (error) {
      console.error(error);
      setMessage("Fehler beim Löschen.");
    }
  }

  /* =========================================================
     BERECHNUNGEN
     ========================================================= */

  const openOrders = orders.filter(
    (order) => order.status === "offen"
  );

  const finishedOrders = orders.filter(
    (order) => order.status === "fertig"
  );

  const waiterCount = profiles.filter(
    (profile) => profile.role === "waiter"
  ).length;

  const kitchenCount = profiles.filter(
    (profile) => profile.role === "kitchen"
  ).length;

  const adminCount = profiles.filter(
    (profile) => profile.role === "admin"
  ).length;

  const categories = [
    "Alle",
    ...Array.from(
      new Set(products.map((product) => product.category))
    ),
  ];

  const filteredProducts = useMemo(() => {
    const searchLower = search.toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchLower) ||
        product.category.toLowerCase().includes(searchLower);

      const matchesCategory =
        categoryFilter === "Alle" ||
        product.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [products, search, categoryFilter]);

  const totalOrderValue = orders.reduce((total, order) => {
    const items = orderItems.filter(
      (item) => item.order_id === order.id
    );

    return (
      total +
      items.reduce(
        (sum, item) => {
          const product = products.find(
            (p) => p.name === item.product_name
          );

          return (
            sum +
            (product?.price ?? 0) * item.quantity
          );
        },
        0
      )
    );
  }, 0);

  /* =========================================================
     DESIGN
     ========================================================= */

  const page = dark
    ? "min-h-screen bg-[#080b10] text-white"
    : "min-h-screen bg-[#f4f6f8] text-slate-900";

  const card = dark
    ? "rounded-2xl border border-white/10 bg-[#11161e]"
    : "rounded-2xl border border-slate-200 bg-white";

  const muted = dark
    ? "text-slate-400"
    : "text-slate-500";

  const inputClass = dark
    ? "w-full rounded-xl border border-white/10 bg-[#0b0f15] px-4 py-3 text-white outline-none focus:border-blue-500"
    : "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-500";

  /* =========================================================
     LOADING
     ========================================================= */

  if (loading) {
    return (
      <main className={page}>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600" />
            <p className={muted}>Adminbereich wird geladen...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className={page}>
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className={`${card} w-full max-w-md p-8 text-center`}>
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-3xl">
              🔒
            </div>

            <h1 className="text-2xl font-bold">
              Kein Zugriff
            </h1>

            <p className={`${muted} mt-2`}>
              Dieser Bereich ist nur für Administratoren.
            </p>

            <button
              onClick={() => (window.location.href = "/")}
              className="mt-6 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700"
            >
              Zurück
            </button>
          </div>
        </div>
      </main>
    );
  }

  /* =========================================================
     SIDEBAR
     ========================================================= */

  const navigation = [
    {
      id: "dashboard" as const,
      icon: "▦",
      label: "Dashboard",
    },
    {
      id: "orders" as const,
      icon: "🧾",
      label: "Bestellungen",
    },
    {
      id: "employees" as const,
      icon: "👥",
      label: "Mitarbeiter",
    },
    {
      id: "products" as const,
      icon: "🍽️",
      label: "Produkte & Preise",
    },
    {
      id: "statistics" as const,
      icon: "📊",
      label: "Statistiken",
    },
    {
      id: "settings" as const,
      icon: "⚙️",
      label: "Einstellungen",
    },
  ];

  return (
    <main className={page}>
      <div className="flex min-h-screen">
        {/* SIDEBAR */}
        <aside
          className={`hidden w-64 shrink-0 border-r lg:flex lg:flex-col ${
            dark
              ? "border-white/10 bg-[#0d1117]"
              : "border-slate-200 bg-white"
          }`}
        >
          <div className="border-b border-inherit p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-xl shadow-lg">
                🥙
              </div>

              <div>
                <div className="font-bold">
                  Döner POS
                </div>

                <div className={`text-xs ${muted}`}>
                  Administration
                </div>
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-1 p-4">
            {navigation.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
                  activeSection === item.id
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                    : dark
                    ? "text-slate-300 hover:bg-white/5"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span className="w-6 text-center">
                  {item.icon}
                </span>

                {item.label}
              </button>
            ))}
          </nav>

          <div className="border-t border-inherit p-4">
            <button
              onClick={() => setTheme(dark ? "light" : "dark")}
              className={`mb-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm ${
                dark
                  ? "text-slate-300 hover:bg-white/5"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {dark ? "☀️" : "🌙"}
              {dark ? "Heller Modus" : "Dunkler Modus"}
            </button>

            <button
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-500/10"
            >
              🚪 Abmelden
            </button>
          </div>
        </aside>

        {/* MAIN */}
        <section className="min-w-0 flex-1">
          {/* HEADER */}
          <header
            className={`sticky top-0 z-20 border-b px-4 py-4 backdrop-blur-xl md:px-8 ${
              dark
                ? "border-white/10 bg-[#080b10]/85"
                : "border-slate-200 bg-white/85"
            }`}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold md:text-2xl">
                  {navigation.find(
                    (item) => item.id === activeSection
                  )?.label}
                </h1>

                <p className={`text-sm ${muted}`}>
                  Verwaltung deines Restaurants
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={loadData}
                  className={`hidden rounded-xl px-4 py-2.5 text-sm font-medium sm:block ${
                    dark
                      ? "bg-white/5 hover:bg-white/10"
                      : "bg-slate-100 hover:bg-slate-200"
                  }`}
                >
                  ↻ Aktualisieren
                </button>

                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 font-bold text-white">
                  A
                </div>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[1500px] p-4 md:p-8">
            {message && (
              <div
                className={`mb-6 flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${
                  dark
                    ? "border-blue-500/20 bg-blue-500/10 text-blue-300"
                    : "border-blue-200 bg-blue-50 text-blue-700"
                }`}
              >
                <span>{message}</span>

                <button
                  onClick={() => setMessage("")}
                  className="ml-4 opacity-70 hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            )}

            {/* =================================================
                DASHBOARD
                ================================================= */}

            {activeSection === "dashboard" && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-bold">
                    Willkommen im Adminbereich 👋
                  </h2>

                  <p className={`mt-1 ${muted}`}>
                    Hier hast du den Überblick über dein Restaurant.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className={`${card} p-5`}>
                    <div className="flex items-center justify-between">
                      <span className={muted}>
                        Bestellungen
                      </span>

                      <span className="rounded-xl bg-blue-500/10 p-3">
                        🧾
                      </span>
                    </div>

                    <div className="mt-5 text-3xl font-bold">
                      {orders.length}
                    </div>

                    <div className={`mt-1 text-sm ${muted}`}>
                      insgesamt
                    </div>
                  </div>

                  <div className={`${card} p-5`}>
                    <div className="flex items-center justify-between">
                      <span className={muted}>
                        Offen
                      </span>

                      <span className="rounded-xl bg-orange-500/10 p-3">
                        🟠
                      </span>
                    </div>

                    <div className="mt-5 text-3xl font-bold text-orange-500">
                      {openOrders.length}
                    </div>

                    <div className={`mt-1 text-sm ${muted}`}>
                      aktuell offen
                    </div>
                  </div>

                  <div className={`${card} p-5`}>
                    <div className="flex items-center justify-between">
                      <span className={muted}>
                        Fertig
                      </span>

                      <span className="rounded-xl bg-green-500/10 p-3">
                        ✓
                      </span>
                    </div>

                    <div className="mt-5 text-3xl font-bold text-green-500">
                      {finishedOrders.length}
                    </div>

                    <div className={`mt-1 text-sm ${muted}`}>
                      abgeschlossen
                    </div>
                  </div>

                  <div className={`${card} p-5`}>
                    <div className="flex items-center justify-between">
                      <span className={muted}>
                        Produkte
                      </span>

                      <span className="rounded-xl bg-purple-500/10 p-3">
                        🍽️
                      </span>
                    </div>

                    <div className="mt-5 text-3xl font-bold">
                      {products.length}
                    </div>

                    <div className={`mt-1 text-sm ${muted}`}>
                      im Menü
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-3">
                  <div className={`${card} p-6 xl:col-span-2`}>
                    <div className="mb-5 flex items-center justify-between">
                      <div>
                        <h3 className="font-bold">
                          Letzte Bestellungen
                        </h3>

                        <p className={`text-sm ${muted}`}>
                          Die zuletzt erstellten Bestellungen
                        </p>
                      </div>

                      <button
                        onClick={() =>
                          setActiveSection("orders")
                        }
                        className="text-sm font-semibold text-blue-500"
                      >
                        Alle anzeigen →
                      </button>
                    </div>

                    <div className="space-y-3">
                      {orders.slice(0, 6).map((order) => (
                        <div
                          key={order.id}
                          className={`flex items-center justify-between rounded-xl border p-4 ${
                            dark
                              ? "border-white/5 bg-white/[0.02]"
                              : "border-slate-100 bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600/10 font-bold text-blue-500">
                              {order.table_number}
                            </div>

                            <div>
                              <div className="font-semibold">
                                Tisch {order.table_number}
                              </div>

                              <div
                                className={`text-xs ${muted}`}
                              >
                                {formatDate(order.created_at)}
                              </div>
                            </div>
                          </div>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              order.status === "fertig"
                                ? "bg-green-500/10 text-green-500"
                                : "bg-orange-500/10 text-orange-500"
                            }`}
                          >
                            {order.status === "fertig"
                              ? "Fertig"
                              : "Offen"}
                          </span>
                        </div>
                      ))}

                      {orders.length === 0 && (
                        <div
                          className={`py-10 text-center ${muted}`}
                        >
                          Noch keine Bestellungen.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={`${card} p-6`}>
                    <h3 className="font-bold">
                      Mitarbeiter
                    </h3>

                    <p className={`mt-1 text-sm ${muted}`}>
                      Übersicht
                    </p>

                    <div className="mt-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className={muted}>
                          👨‍🍳 Küche
                        </span>

                        <span className="font-bold">
                          {kitchenCount}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className={muted}>
                          🧑‍🍳 Kellner
                        </span>

                        <span className="font-bold">
                          {waiterCount}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className={muted}>
                          👑 Admins
                        </span>

                        <span className="font-bold">
                          {adminCount}
                        </span>
                      </div>

                      <div
                        className={`mt-5 border-t pt-5 ${
                          dark
                            ? "border-white/10"
                            : "border-slate-200"
                        }`}
                      >
                        <div className="flex items-end justify-between">
                          <span className={muted}>
                            Gesamt
                          </span>

                          <span className="text-2xl font-bold">
                            {profiles.length}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* =================================================
                ORDERS
                ================================================= */}

            {activeSection === "orders" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold">
                    Bestellungen
                  </h2>

                  <p className={`mt-1 ${muted}`}>
                    Alle Bestellungen im System
                  </p>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  {orders.map((order) => {
                    const items = orderItems.filter(
                      (item) => item.order_id === order.id
                    );

                    const total = items.reduce(
                      (sum, item) => {
                        const product = products.find(
                          (p) =>
                            p.name === item.product_name
                        );

                        return (
                          sum +
                          (product?.price ?? 0) *
                            item.quantity
                        );
                      },
                      0
                    );

                    const waiter = profiles.find(
                      (profile) =>
                        profile.id === order.waiter_id
                    );

                    return (
                      <div
                        key={order.id}
                        className={`${card} overflow-hidden`}
                      >
                        <div
                          className={`flex items-center justify-between border-b p-5 ${
                            dark
                              ? "border-white/10"
                              : "border-slate-100"
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 font-bold text-white">
                              {order.table_number}
                            </div>

                            <div>
                              <div className="font-bold">
                                Tisch {order.table_number}
                              </div>

                              <div
                                className={`text-xs ${muted}`}
                              >
                                {waiter?.name ??
                                  "Unbekannt"}{" "}
                                ·{" "}
                                {formatDate(
                                  order.created_at
                                )}
                              </div>
                            </div>
                          </div>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${
                              order.status === "fertig"
                                ? "bg-green-500/10 text-green-500"
                                : "bg-orange-500/10 text-orange-500"
                            }`}
                          >
                            {order.status === "fertig"
                              ? "Fertig"
                              : "Offen"}
                          </span>
                        </div>

                        <div className="space-y-3 p-5">
                          {items.length === 0 ? (
                            <p className={muted}>
                              Keine Artikel.
                            </p>
                          ) : (
                            items.map((item) => (
                              <div
                                key={item.id}
                                className="flex justify-between text-sm"
                              >
                                <span>
                                  {item.quantity}×{" "}
                                  {item.product_name}
                                </span>

                                <span className="font-semibold">
                                  {formatPrice(
                                    (products.find(
                                      (p) =>
                                        p.name ===
                                        item.product_name
                                    )?.price ?? 0) *
                                      item.quantity
                                  )}
                                </span>
                              </div>
                            ))
                          )}
                        </div>

                        <div
                          className={`flex items-center justify-between border-t p-5 ${
                            dark
                              ? "border-white/10"
                              : "border-slate-100"
                          }`}
                        >
                          <div>
                            <div className={`text-xs ${muted}`}>
                              Gesamt
                            </div>

                            <div className="text-xl font-bold">
                              {formatPrice(total)}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            {order.status === "offen" && (
                              <button
                                onClick={() =>
                                  finishOrder(order.id)
                                }
                                className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                              >
                                ✓ Fertig
                              </button>
                            )}

                            <button
                              onClick={() =>
                                deleteOrder(order.id)
                              }
                              className="rounded-xl bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-500 hover:bg-red-500/20"
                            >
                              Löschen
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {orders.length === 0 && (
                  <div className={`${card} p-12 text-center`}>
                    <div className="text-4xl">🧾</div>

                    <h3 className="mt-4 font-bold">
                      Keine Bestellungen
                    </h3>

                    <p className={`mt-1 ${muted}`}>
                      Sobald Bestellungen erstellt werden,
                      erscheinen sie hier.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* =================================================
                EMPLOYEES
                ================================================= */}

            {activeSection === "employees" && (
              <div className="space-y-6">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                  <div>
                    <h2 className="text-2xl font-bold">
                      Mitarbeiter
                    </h2>

                    <p className={`mt-1 ${muted}`}>
                      Mitarbeiter und Rollen verwalten
                    </p>
                  </div>

                  <button
                    onClick={() => setEmployeeModal(true)}
                    className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700"
                  >
                    + Mitarbeiter
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {profiles.map((profile) => (
                    <div
                      key={profile.id}
                      className={`${card} p-5`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">
                            {profile.name
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>
                            <div className="font-bold">
                              {profile.name}
                            </div>

                            <div
                              className={`text-xs ${muted}`}
                            >
                              Mitarbeiter
                            </div>
                          </div>
                        </div>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            profile.role === "admin"
                              ? "bg-purple-500/10 text-purple-500"
                              : profile.role === "kitchen"
                              ? "bg-orange-500/10 text-orange-500"
                              : "bg-blue-500/10 text-blue-500"
                          }`}
                        >
                          {profile.role === "admin"
                            ? "Admin"
                            : profile.role === "kitchen"
                            ? "Küche"
                            : "Kellner"}
                        </span>
                      </div>

                      <div className="mt-6">
                        <button
                          onClick={() =>
                            deleteEmployee(profile.id)
                          }
                          className="w-full rounded-xl bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-500/20"
                        >
                          Mitarbeiter löschen
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* =================================================
                PRODUCTS
                ================================================= */}

            {activeSection === "products" && (
              <div className="space-y-6">
                <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
                  <div>
                    <h2 className="text-2xl font-bold">
                      Produkte & Preise
                    </h2>

                    <p className={`mt-1 ${muted}`}>
                      Deine komplette Speisekarte verwalten
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={createMenu}
                      className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                        dark
                          ? "bg-white/5 hover:bg-white/10"
                          : "bg-slate-100 hover:bg-slate-200"
                      }`}
                    >
                      ⚡ Menü automatisch anlegen
                    </button>

                    <button
                      onClick={openAddProduct}
                      className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700"
                    >
                      + Produkt
                    </button>
                  </div>
                </div>

                <div className={`${card} p-4`}>
                  <div className="grid gap-3 lg:grid-cols-[1fr_240px]">
                    <input
                      value={search}
                      onChange={(event) =>
                        setSearch(event.target.value)
                      }
                      placeholder="Produkt suchen..."
                      className={inputClass}
                    />

                    <select
                      value={categoryFilter}
                      onChange={(event) =>
                        setCategoryFilter(event.target.value)
                      }
                      className={inputClass}
                    >
                      {categories.map((category) => (
                        <option
                          key={category}
                          value={category}
                        >
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      className={`${card} group overflow-hidden transition hover:-translate-y-0.5 hover:shadow-xl`}
                    >
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-base font-bold">
                              {product.name}
                            </div>

                            <div
                              className={`mt-1 text-xs ${muted}`}
                            >
                              {product.category}
                            </div>
                          </div>

                          <div className="shrink-0 rounded-xl bg-blue-500/10 px-3 py-2 text-sm font-bold text-blue-500">
                            {formatPrice(product.price)}
                          </div>
                        </div>

                        <div className="mt-5 grid grid-cols-2 gap-2">
                          <button
                            onClick={() =>
                              openEditProduct(product)
                            }
                            className={`rounded-xl px-3 py-2.5 text-sm font-semibold ${
                              dark
                                ? "bg-white/5 hover:bg-white/10"
                                : "bg-slate-100 hover:bg-slate-200"
                            }`}
                          >
                            ✏️ Bearbeiten
                          </button>

                          <button
                            onClick={() =>
                              deleteProduct(product.id)
                            }
                            className="rounded-xl bg-red-500/10 px-3 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-500/20"
                          >
                            🗑️ Löschen
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {filteredProducts.length === 0 && (
                  <div className={`${card} p-12 text-center`}>
                    <div className="text-4xl">
                      🔎
                    </div>

                    <h3 className="mt-4 font-bold">
                      Kein Produkt gefunden
                    </h3>

                    <p className={`mt-1 ${muted}`}>
                      Ändere deine Suche oder Kategorie.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* =================================================
                STATISTICS
                ================================================= */}

            {activeSection === "statistics" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold">
                    Statistiken
                  </h2>

                  <p className={`mt-1 ${muted}`}>
                    Übersicht über Bestellungen und Umsatz
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className={`${card} p-6`}>
                    <div className={muted}>
                      Bestellungen
                    </div>

                    <div className="mt-3 text-3xl font-bold">
                      {orders.length}
                    </div>
                  </div>

                  <div className={`${card} p-6`}>
                    <div className={muted}>
                      Fertige Bestellungen
                    </div>

                    <div className="mt-3 text-3xl font-bold text-green-500">
                      {finishedOrders.length}
                    </div>
                  </div>

                  <div className={`${card} p-6`}>
                    <div className={muted}>
                      Offene Bestellungen
                    </div>

                    <div className="mt-3 text-3xl font-bold text-orange-500">
                      {openOrders.length}
                    </div>
                  </div>

                  <div className={`${card} p-6`}>
                    <div className={muted}>
                      Bestellwert
                    </div>

                    <div className="mt-3 text-3xl font-bold">
                      {formatPrice(totalOrderValue)}
                    </div>
                  </div>
                </div>

                <div className={`${card} p-6`}>
                  <h3 className="font-bold">
                    Systemübersicht
                  </h3>

                  <div className="mt-6 grid gap-4 md:grid-cols-3">
                    <div
                      className={`rounded-xl p-5 ${
                        dark
                          ? "bg-white/5"
                          : "bg-slate-50"
                      }`}
                    >
                      <div className="text-2xl">
                        🍽️
                      </div>

                      <div className="mt-3 text-2xl font-bold">
                        {products.length}
                      </div>

                      <div className={`text-sm ${muted}`}>
                        Produkte
                      </div>
                    </div>

                    <div
                      className={`rounded-xl p-5 ${
                        dark
                          ? "bg-white/5"
                          : "bg-slate-50"
                      }`}
                    >
                      <div className="text-2xl">
                        👥
                      </div>

                      <div className="mt-3 text-2xl font-bold">
                        {profiles.length}
                      </div>

                      <div className={`text-sm ${muted}`}>
                        Mitarbeiter
                      </div>
                    </div>

                    <div
                      className={`rounded-xl p-5 ${
                        dark
                          ? "bg-white/5"
                          : "bg-slate-50"
                      }`}
                    >
                      <div className="text-2xl">
                        🧾
                      </div>

                      <div className="mt-3 text-2xl font-bold">
                        {orderItems.length}
                      </div>

                      <div className={`text-sm ${muted}`}>
                        Bestellpositionen
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* =================================================
                SETTINGS
                ================================================= */}

            {activeSection === "settings" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold">
                    Einstellungen
                  </h2>

                  <p className={`mt-1 ${muted}`}>
                    Allgemeine Einstellungen
                  </p>
                </div>

                <div className={`${card} p-6`}>
                  <div className="flex items-center justify-between gap-5">
                    <div>
                      <h3 className="font-bold">
                        Erscheinungsbild
                      </h3>

                      <p className={`mt-1 text-sm ${muted}`}>
                        Zwischen hellem und dunklem Design wechseln.
                      </p>
                    </div>

                    <button
                      onClick={() =>
                        setTheme(dark ? "light" : "dark")
                      }
                      className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white"
                    >
                      {dark
                        ? "☀️ Hell"
                        : "🌙 Dunkel"}
                    </button>
                  </div>
                </div>

                <div className={`${card} p-6`}>
                  <h3 className="font-bold">
                    Menü
                  </h3>

                  <p className={`mt-1 text-sm ${muted}`}>
                    Produkte aus dem hinterlegten Katalog automatisch
                    anlegen.
                  </p>

                  <button
                    onClick={createMenu}
                    className="mt-5 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white"
                  >
                    ⚡ Menü anlegen / aktualisieren
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* =====================================================
          PRODUCT MODAL
          ===================================================== */}

      {productModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div
            className={`${card} w-full max-w-lg overflow-hidden shadow-2xl`}
          >
            <div
              className={`flex items-center justify-between border-b p-6 ${
                dark
                  ? "border-white/10"
                  : "border-slate-100"
              }`}
            >
              <div>
                <h2 className="text-xl font-bold">
                  {editingProduct
                    ? "Produkt bearbeiten"
                    : "Neues Produkt"}
                </h2>

                <p className={`mt-1 text-sm ${muted}`}>
                  Produktname, Preis und Kategorie
                </p>
              </div>

              <button
                onClick={() => setProductModal(false)}
                className={`rounded-xl p-2 ${
                  dark
                    ? "hover:bg-white/10"
                    : "hover:bg-slate-100"
                }`}
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Produktname
                </label>

                <input
                  value={productName}
                  onChange={(event) =>
                    setProductName(event.target.value)
                  }
                  className={inputClass}
                  placeholder="z. B. Döner"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Preis
                </label>

                <div className="relative">
                  <input
                    value={productPrice}
                    onChange={(event) =>
                      setProductPrice(event.target.value)
                    }
                    className={`${inputClass} pr-12`}
                    placeholder="8,50"
                    inputMode="decimal"
                  />

                  <span
                    className={`absolute right-4 top-1/2 -translate-y-1/2 ${muted}`}
                  >
                    €
                  </span>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Kategorie
                </label>

                <input
                  value={productCategory}
                  onChange={(event) =>
                    setProductCategory(event.target.value)
                  }
                  list="product-categories"
                  className={inputClass}
                  placeholder="Kategorie"
                />

                <datalist id="product-categories">
                  {PRODUCT_CATALOG.map((item) => (
                    <option
                      key={item.category}
                      value={item.category}
                    />
                  ))}
                </datalist>
              </div>
            </div>

            <div
              className={`flex gap-3 border-t p-6 ${
                dark
                  ? "border-white/10"
                  : "border-slate-100"
              }`}
            >
              <button
                onClick={() => setProductModal(false)}
                className={`flex-1 rounded-xl px-4 py-3 font-semibold ${
                  dark
                    ? "bg-white/5 hover:bg-white/10"
                    : "bg-slate-100 hover:bg-slate-200"
                }`}
              >
                Abbrechen
              </button>

              <button
                onClick={saveProduct}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700"
              >
                {editingProduct
                  ? "Speichern"
                  : "Produkt erstellen"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          EMPLOYEE MODAL
          ===================================================== */}

      {employeeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div
            className={`${card} w-full max-w-lg overflow-hidden shadow-2xl`}
          >
            <div
              className={`flex items-center justify-between border-b p-6 ${
                dark
                  ? "border-white/10"
                  : "border-slate-100"
              }`}
            >
              <div>
                <h2 className="text-xl font-bold">
                  Mitarbeiter erstellen
                </h2>

                <p className={`mt-1 text-sm ${muted}`}>
                  Neuen Benutzer anlegen
                </p>
              </div>

              <button
                onClick={() => setEmployeeModal(false)}
                className={`rounded-xl p-2 ${
                  dark
                    ? "hover:bg-white/10"
                    : "hover:bg-slate-100"
                }`}
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Name
                </label>

                <input
                  value={employeeName}
                  onChange={(event) =>
                    setEmployeeName(event.target.value)
                  }
                  className={inputClass}
                  placeholder="z. B. Max"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  E-Mail
                </label>

                <input
                  value={employeeEmail}
                  onChange={(event) =>
                    setEmployeeEmail(event.target.value)
                  }
                  className={inputClass}
                  placeholder="mitarbeiter@example.de"
                  type="email"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Passwort
                </label>

                <input
                  value={employeePassword}
                  onChange={(event) =>
                    setEmployeePassword(event.target.value)
                  }
                  className={inputClass}
                  placeholder="Passwort"
                  type="password"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Rolle
                </label>

                <select
                  value={employeeRole}
                  onChange={(event) =>
                    setEmployeeRole(
                      event.target.value as
                        | "waiter"
                        | "kitchen"
                        | "admin"
                    )
                  }
                  className={inputClass}
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
            </div>

            <div
              className={`flex gap-3 border-t p-6 ${
                dark
                  ? "border-white/10"
                  : "border-slate-100"
              }`}
            >
              <button
                onClick={() =>
                  setEmployeeModal(false)
                }
                className={`flex-1 rounded-xl px-4 py-3 font-semibold ${
                  dark
                    ? "bg-white/5 hover:bg-white/10"
                    : "bg-slate-100 hover:bg-slate-200"
                }`}
              >
                Abbrechen
              </button>

              <button
                onClick={createEmployee}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700"
              >
                Mitarbeiter erstellen
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}