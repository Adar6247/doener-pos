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

/*
=========================================================
START-SPEISEKARTE
=========================================================
*/

const PRODUCT_CATALOG: Record<
  string,
  { name: string; price: number }[]
> = {
  "Lahmacun-Spezialitäten": [
    {
      name: "Lahmacun",
      price: 4.5,
    },
    {
      name: "Lahmacun mit Salat und Soße (gerollt)",
      price: 6.5,
    },
    {
      name: "Lahmacun mit Käse",
      price: 7,
    },
    {
      name: "Lahmacun Spezial",
      price: 9,
    },
    {
      name: "Lahmacun Teller",
      price: 7,
    },
    {
      name: "Lahmacun Spezial Teller",
      price: 10,
    },
  ],

  Grillspezialitäten: [
    {
      name: "Lammspieße",
      price: 15,
    },
    {
      name: "Lammkoteletts",
      price: 16,
    },
    {
      name: "Adana Kebap",
      price: 16,
    },
    {
      name: "Steak",
      price: 12,
    },
    {
      name: "Gemischter Grill",
      price: 16,
    },
    {
      name: "Chicken Nuggets mit Pommes",
      price: 7.5,
    },
    {
      name: "Chicken Wings mit Pommes",
      price: 8,
    },
  ],

  Burger: [
    {
      name: "Hamburger (55 g)",
      price: 4,
    },
    {
      name: "Hamburger XXL (125 g)",
      price: 6,
    },
    {
      name: "Cheeseburger (55 g)",
      price: 4.5,
    },
    {
      name: "Cheeseburger XXL (125 g)",
      price: 6.5,
    },
    {
      name: "Chickenburger (90 g)",
      price: 5.5,
    },
  ],

  Salate: [
    {
      name: "Gemischter Salat (klein)",
      price: 4.5,
    },
    {
      name: "Gemischter Salat (groß)",
      price: 6.5,
    },
    {
      name: "Hirten-Salat",
      price: 7,
    },
    {
      name: "Salat Tonno",
      price: 8,
    },
    {
      name: "Salat mit Putenstreifen",
      price: 8,
    },
  ],

  "Pizza (Ø 30 cm)": [
    {
      name: "Pizza Margherita",
      price: 7.5,
    },
    {
      name: "Pizza Funghi",
      price: 8,
    },
    {
      name: "Pizza Spinat",
      price: 8,
    },
    {
      name: "Pizza Peperoni",
      price: 8,
    },
    {
      name: "Pizza Salami",
      price: 8,
    },
    {
      name: "Pizza Schinken",
      price: 8,
    },
    {
      name: "Pizza Sucuk",
      price: 9,
    },
    {
      name: "Pizza Hawaii",
      price: 9,
    },
    {
      name: "Pizza Artischocken",
      price: 9,
    },
    {
      name: "Pizza Tonno",
      price: 9,
    },
    {
      name: "Pizza Kebap",
      price: 9.5,
    },
    {
      name: "Pizza Chipolla",
      price: 9.5,
    },
    {
      name: "Pizza Vegetarisch",
      price: 9.5,
    },
    {
      name: "Pizza Sucuk Spezial",
      price: 10.5,
    },
    {
      name: "Pizza Döner Spezial",
      price: 10.5,
    },
    {
      name: "Pizza Meeresfrüchte",
      price: 10.5,
    },
    {
      name: "Pizza Vier Jahreszeiten",
      price: 10,
    },
    {
      name: "Pizza Sardellen",
      price: 10.5,
    },
    {
      name: "Party-Pizza (60x40 cm)",
      price: 25,
    },
  ],

  Flammkuchen: [
    {
      name: "Flammkuchen",
      price: 7,
    },
  ],

  "Döner-Spezialitäten": [
    {
      name: "Döner im Fladenbrot",
      price: 7.5,
    },
    {
      name: "Döner mit Käse im Fladenbrot",
      price: 8,
    },
    {
      name: "Yufka Döner",
      price: 8.5,
    },
    {
      name: "Döner Vegetarisch",
      price: 6,
    },
    {
      name: "Yufka Vegetarisch",
      price: 6.5,
    },
    {
      name: "Vegetarischer Teller",
      price: 8,
    },
    {
      name: "Döner Box",
      price: 6.5,
    },
    {
      name: "Döner Teller",
      price: 10,
    },
    {
      name: "Döner Teller (klein)",
      price: 9,
    },
  ],

  "Falafel-Spezialitäten": [
    {
      name: "Falafel im Fladenbrot",
      price: 6.5,
    },
    {
      name: "Falafel Box",
      price: 6.5,
    },
    {
      name: "Falafel Teller",
      price: 8,
    },
  ],

  Extras: [
    {
      name: "Portion Pommes",
      price: 3.5,
    },
    {
      name: "Iskender",
      price: 12,
    },
  ],

  "Pide und Seele": [
    {
      name: "Pide mit Käse",
      price: 7.5,
    },
    {
      name: "Pide mit Hackfleisch",
      price: 8,
    },
    {
      name: "Pide mit Spinat & Käse",
      price: 8,
    },
    {
      name: "Pide mit Sucuk & Käse",
      price: 8.5,
    },
    {
      name: "Seele mit Putenschinken und Käse",
      price: 8.5,
    },
    {
      name: "Seele mit Dönerfleisch, frischen Tomaten und Zwiebeln",
      price: 8.5,
    },
  ],

  "Warme Getränke": [
    {
      name: "Tasse Kaffee (klein)",
      price: 3.5,
    },
  ],

  "Alkoholische Getränke": [
    {
      name: "Hofbräu 0,5 l",
      price: 3.5,
    },
    {
      name: "Pils Hofbräu 0,5 l",
      price: 3.5,
    },
    {
      name: "Hefeweizen hell 0,5 l",
      price: 3.5,
    },
    {
      name: "Kristallweizen 0,5 l",
      price: 3.5,
    },
    {
      name: "Radler 0,5 l",
      price: 3.5,
    },
    {
      name: "Beck’s 0,33 l",
      price: 3.5,
    },
    {
      name: "Beck’s Lemon 0,33 l",
      price: 3.5,
    },
    {
      name: "Tannenzäpfle 0,33 l",
      price: 4,
    },
    {
      name: "Desperados 0,33 l",
      price: 4,
    },
    {
      name: "Rotwein Trollinger 0,25 l",
      price: 4,
    },
    {
      name: "Weißwein Riesling 0,25 l",
      price: 4,
    },
    {
      name: "Rosé Württemberger 0,25 l",
      price: 4,
    },
    {
      name: "Weinschorle 0,25 l",
      price: 3.5,
    },
  ],

  "Kalte Getränke – Softdrinks": [
    {
      name: "Fanta 0,3 l",
      price: 2.5,
    },
    {
      name: "Fanta 0,5 l",
      price: 4,
    },
    {
      name: "Coca-Cola 0,3 l",
      price: 2.5,
    },
    {
      name: "Coca-Cola 0,5 l",
      price: 4,
    },
    {
      name: "Coca-Cola Light 0,3 l",
      price: 2.5,
    },
    {
      name: "Coca-Cola Light 0,5 l",
      price: 4,
    },
    {
      name: "Sprite 0,3 l",
      price: 2.5,
    },
    {
      name: "Sprite 0,5 l",
      price: 4,
    },
    {
      name: "Spezi 0,3 l",
      price: 2.5,
    },
    {
      name: "Spezi 0,5 l",
      price: 4,
    },
    {
      name: "Red Bull 0,25 l",
      price: 4,
    },
    {
      name: "Wasser 0,3 l",
      price: 2,
    },
    {
      name: "Wasser 0,5 l",
      price: 3.5,
    },
  ],

  "Kalte Getränke – Säfte": [
    {
      name: "Orangensaft 0,3 l",
      price: 3,
    },
    {
      name: "Kirschsaft 0,3 l",
      price: 3.5,
    },
    {
      name: "Kiba (Kirsch-Banane) 0,3 l",
      price: 3.5,
    },
    {
      name: "Bananensaft 0,3 l",
      price: 3.5,
    },
    {
      name: "Bananensaft 0,5 l",
      price: 4.5,
    },
    {
      name: "Apfelsaft 0,3 l",
      price: 3.5,
    },
    {
      name: "Apfelsaft 0,5 l",
      price: 4.5,
    },
    {
      name: "Johannisbeersaft 0,3 l",
      price: 3.5,
    },
    {
      name: "Johannisbeersaft 0,5 l",
      price: 4.5,
    },
    {
      name: "Apfelschorle 0,3 l",
      price: 2.5,
    },
    {
      name: "Apfelschorle 0,5 l",
      price: 4,
    },
  ],

  Schweppes: [
    {
      name: "Ginger Ale",
      price: 3.5,
    },
    {
      name: "Tonic Water",
      price: 3.5,
    },
    {
      name: "Bitter Lemon",
      price: 3.5,
    },
  ],

  Cocktails: [
    {
      name: "Aperol Spritz",
      price: 6,
    },
    {
      name: "Hugo",
      price: 6,
    },
    {
      name: "Campari Orange",
      price: 6,
    },
    {
      name: "Campari Soda",
      price: 6,
    },
  ],

  Longdrinks: [
    {
      name: "Jacky Cola 2 cl",
      price: 5,
    },
    {
      name: "Jacky Cola 4 cl",
      price: 6,
    },
    {
      name: "Wodka Lemon 2 cl",
      price: 5,
    },
    {
      name: "Wodka Lemon 4 cl",
      price: 6,
    },
    {
      name: "Wodka Bull 2 cl",
      price: 5,
    },
    {
      name: "Wodka Bull 4 cl",
      price: 6,
    },
    {
      name: "Wodka Orange 2 cl",
      price: 5,
    },
    {
      name: "Wodka Orange 4 cl",
      price: 6,
    },
    {
      name: "Asbach Cola 2 cl",
      price: 5,
    },
    {
      name: "Asbach Cola 4 cl",
      price: 6,
    },
    {
      name: "Gin Tonic 2 cl",
      price: 5,
    },
    {
      name: "Gin Tonic 4 cl",
      price: 6,
    },
  ],

  Spirituosen: [
    {
      name: "Jägermeister",
      price: 2,
    },
    {
      name: "Ramazzotti",
      price: 2,
    },
    {
      name: "Wodka",
      price: 2,
    },
    {
      name: "Tequila",
      price: 2,
    },
    {
      name: "Asbach",
      price: 2,
    },
    {
      name: "Baileys",
      price: 2,
    },
    {
      name: "Williams",
      price: 3.5,
    },
  ],
};

export default function AdminPage() {
  const { theme, setTheme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>(
    []
  );
  const [products, setProducts] = useState<Product[]>([]);

  const [activeSection, setActiveSection] =
    useState("dashboard");

  const [message, setMessage] = useState("");

  /*
  =========================================================
  PRODUKT FORMULAR
  =========================================================
  */

  const [showProductForm, setShowProductForm] =
    useState(false);

  const [editingProduct, setEditingProduct] =
    useState<Product | null>(null);

  const [productName, setProductName] = useState("");
  const [productCategory, setProductCategory] =
    useState("");
  const [productPrice, setProductPrice] = useState("");

  /*
  =========================================================
  MITARBEITER FORMULAR
  =========================================================
  */

  const [showEmployeeForm, setShowEmployeeForm] =
    useState(false);

  const [employeeName, setEmployeeName] =
    useState("");

  const [employeeEmail, setEmployeeEmail] =
    useState("");

  const [employeePassword, setEmployeePassword] =
    useState("");

  const [employeeRole, setEmployeeRole] =
    useState<"waiter" | "kitchen" | "admin">(
      "waiter"
    );

  /*
  =========================================================
  DATEN LADEN
  =========================================================
  */

  useEffect(() => {
    async function loadAdmin() {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/";
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

      setLoading(false);
    }

    loadAdmin();
  }, []);

  async function loadData() {
    const [
      profilesResult,
      ordersResult,
      orderItemsResult,
      productsResult,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .order("created_at", {
          ascending: false,
        }),

      supabase
        .from("orders")
        .select("*")
        .order("created_at", {
          ascending: false,
        }),

      supabase
        .from("order_items")
        .select("*")
        .order("id", {
          ascending: false,
        }),

      supabase
        .from("products")
        .select("*")
        .order("category", {
          ascending: true,
        })
        .order("name", {
          ascending: true,
        }),
    ]);

    if (profilesResult.data) {
      setProfiles(profilesResult.data);
    }

    if (ordersResult.data) {
      setOrders(ordersResult.data);
    }

    if (orderItemsResult.data) {
      setOrderItems(orderItemsResult.data);
    }

    if (productsResult.data) {
      setProducts(productsResult.data);
    }
  }

  /*
  =========================================================
  LOGOUT
  =========================================================
  */

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  /*
  =========================================================
  SPEISEKARTE ERSTELLEN
  =========================================================
  */

  async function createMenu() {
    setMessage("");

    const allProducts = Object.entries(
      PRODUCT_CATALOG
    ).flatMap(([category, categoryProducts]) =>
      categoryProducts.map((product) => ({
        name: product.name,
        price: product.price,
        category,
      }))
    );

    if (allProducts.length === 0) {
      setMessage(
        "Keine Produkte zum Anlegen vorhanden."
      );
      return;
    }

    const existingNames = new Set(
      products.map((product) => product.name)
    );

    const newProducts = allProducts.filter(
      (product) => !existingNames.has(product.name)
    );

    if (newProducts.length === 0) {
      setMessage(
        "Die komplette Speisekarte ist bereits angelegt."
      );
      return;
    }

    const { error } = await supabase
      .from("products")
      .insert(newProducts);

    if (error) {
      console.error("SPEISEKARTE FEHLER:", {
        message: error.message,
        code: error.code,
      });

      setMessage(
        error.message ||
          "Die Speisekarte konnte nicht angelegt werden."
      );

      return;
    }

    await loadData();

    setMessage(
      `${newProducts.length} Produkte wurden mit den Startpreisen angelegt.`
    );
  }

  /*
  =========================================================
  PRODUKT FORMULAR ÖFFNEN
  =========================================================
  */

  function openAddProduct() {
    setEditingProduct(null);
    setProductName("");
    setProductCategory("");
    setProductPrice("");
    setShowProductForm(true);
  }

  function openEditProduct(product: Product) {
    setEditingProduct(product);
    setProductName(product.name);
    setProductCategory(product.category);
    setProductPrice(String(product.price));
    setShowProductForm(true);
  }

  /*
  =========================================================
  PRODUKT SPEICHERN
  =========================================================
  */

  async function saveProduct() {
    const name = productName.trim();
    const category = productCategory.trim();
    const price = Number(
      productPrice.replace(",", ".")
    );

    if (!name) {
      setMessage(
        "Bitte einen Produktnamen eingeben."
      );
      return;
    }

    if (!category) {
      setMessage(
        "Bitte eine Kategorie eingeben."
      );
      return;
    }

    if (
      productPrice.trim() === "" ||
      Number.isNaN(price) ||
      price < 0
    ) {
      setMessage(
        "Bitte einen gültigen Preis eingeben."
      );
      return;
    }

    if (editingProduct) {
      const { error } = await supabase
        .from("products")
        .update({
          name,
          category,
          price,
        })
        .eq("id", editingProduct.id);

      if (error) {
        console.error("PRODUKT UPDATE FEHLER:", {
          message: error.message,
          code: error.code,
        });

        setMessage(
          error.message ||
            "Das Produkt konnte nicht geändert werden."
        );

        return;
      }

      setMessage(
        "Produkt wurde erfolgreich geändert."
      );
    } else {
      const { error } = await supabase
        .from("products")
        .insert({
          name,
          category,
          price,
        });

      if (error) {
        console.error("PRODUKT ERSTELLEN FEHLER:", {
          message: error.message,
          code: error.code,
        });

        setMessage(
          error.message ||
            "Das Produkt konnte nicht erstellt werden."
        );

        return;
      }

      setMessage(
        "Produkt wurde erfolgreich hinzugefügt."
      );
    }

    setShowProductForm(false);
    setEditingProduct(null);

    setProductName("");
    setProductCategory("");
    setProductPrice("");

    await loadData();
  }

  /*
  =========================================================
  PRODUKT LÖSCHEN
  =========================================================
  */

  async function deleteProduct(product: Product) {
    const confirmed = window.confirm(
      `Möchtest du "${product.name}" wirklich löschen?`
    );

    if (!confirmed) {
      return;
    }

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", product.id);

    if (error) {
      console.error("PRODUKT LÖSCHEN FEHLER:", {
        message: error.message,
        code: error.code,
      });

      setMessage(
        error.message ||
          "Das Produkt konnte nicht gelöscht werden."
      );

      return;
    }

    setMessage(
      `"${product.name}" wurde gelöscht.`
    );

    await loadData();
  }

  /*
  =========================================================
  MITARBEITER ERSTELLEN
  =========================================================
  */

  async function createEmployee() {
    if (!employeeName.trim()) {
      setMessage(
        "Bitte einen Namen eingeben."
      );
      return;
    }

    if (!employeeEmail.trim()) {
      setMessage(
        "Bitte eine E-Mail-Adresse eingeben."
      );
      return;
    }

    if (employeePassword.length < 6) {
      setMessage(
        "Das Passwort muss mindestens 6 Zeichen haben."
      );
      return;
    }

    try {
      const response = await fetch(
        "/api/admin/create-user",
        {
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
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setMessage(
          result.error ||
            "Mitarbeiter konnte nicht erstellt werden."
        );
        return;
      }

      setMessage(
        "Mitarbeiter wurde erfolgreich erstellt."
      );

      setEmployeeName("");
      setEmployeeEmail("");
      setEmployeePassword("");
      setEmployeeRole("waiter");
      setShowEmployeeForm(false);

      await loadData();
    } catch (error) {
      console.error(error);

      setMessage(
        "Beim Erstellen des Mitarbeiters ist ein Fehler aufgetreten."
      );
    }
  }

  /*
  =========================================================
  MITARBEITER LÖSCHEN
  =========================================================
  */

  async function deleteEmployee(
    profile: Profile
  ) {
    const confirmed = window.confirm(
      `Möchtest du "${profile.name}" wirklich löschen?`
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        "/api/admin/delete-user",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: profile.id,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setMessage(
          result.error ||
            "Mitarbeiter konnte nicht gelöscht werden."
        );
        return;
      }

      setMessage(
        "Mitarbeiter wurde gelöscht."
      );

      await loadData();
    } catch (error) {
      console.error(error);

      setMessage(
        "Beim Löschen ist ein Fehler aufgetreten."
      );
    }
  }

  /*
  =========================================================
  BESTELLUNG FERTIG
  =========================================================
  */

  async function finishOrder(order: Order) {
    if (order.status === "fertig") {
      return;
    }

    const { error } = await supabase
      .from("orders")
      .update({
        status: "fertig",
        finished_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    if (error) {
      console.error(
        "BESTELLUNG FERTIG FEHLER:",
        {
          message: error.message,
          code: error.code,
        }
      );

      setMessage(
        error.message ||
          "Bestellung konnte nicht abgeschlossen werden."
      );

      return;
    }

    setMessage(
      `Bestellung #${order.id} wurde fertig gemacht.`
    );

    await loadData();
  }

  /*
  =========================================================
  BESTELLUNG LÖSCHEN
  =========================================================
  */

  async function deleteOrder(order: Order) {
    const confirmed = window.confirm(
      `Möchtest du Bestellung #${order.id} wirklich löschen?`
    );

    if (!confirmed) {
      return;
    }

    const { error } = await supabase
      .from("orders")
      .delete()
      .eq("id", order.id);

    if (error) {
      console.error(
        "BESTELLUNG LÖSCHEN FEHLER:",
        {
          message: error.message,
          code: error.code,
        }
      );

      setMessage(
        error.message ||
          "Bestellung konnte nicht gelöscht werden."
      );

      return;
    }

    setMessage(
      `Bestellung #${order.id} wurde gelöscht.`
    );

    await loadData();
  }

  /*
  =========================================================
  HILFSFUNKTIONEN
  =========================================================
  */

  function formatPrice(price: number) {
    return (
      Number(price)
        .toFixed(2)
        .replace(".", ",") + " €"
    );
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleString(
      "de-DE"
    );
  }

  function getWaiterName(waiterId: string) {
    const waiter = profiles.find(
      (profile) => profile.id === waiterId
    );

    return waiter?.name || "Unbekannt";
  }

  function getOrderItems(orderId: number) {
    return orderItems.filter(
      (item) => item.order_id === orderId
    );
  }

  /*
  =========================================================
  STATISTIKEN
  =========================================================
  */

  const openOrders = orders.filter(
    (order) => order.status === "offen"
  ).length;

  const finishedOrders = orders.filter(
    (order) => order.status === "fertig"
  ).length;

  const waiterCount = profiles.filter(
    (profile) => profile.role === "waiter"
  ).length;

  const kitchenCount = profiles.filter(
    (profile) => profile.role === "kitchen"
  ).length;

  const adminCount = profiles.filter(
    (profile) => profile.role === "admin"
  ).length;

  /*
  =========================================================
  TAGESSTATISTIK
  =========================================================
  */

  const dailyStatistics: DailyStatistic[] =
    Array.from({ length: 7 }).map(
      (_, index) => {
        const date = new Date();

        date.setDate(
          date.getDate() - index
        );

        const dateString =
          date.toISOString().slice(0, 10);

        const count = orders.filter(
          (order) =>
            order.created_at.slice(0, 10) ===
            dateString
        ).length;

        return {
          date: dateString,
          label: date.toLocaleDateString(
            "de-DE",
            {
              weekday: "short",
              day: "2-digit",
              month: "2-digit",
            }
          ),
          count,
        };
      }
    );

  /*
  =========================================================
  KATEGORIEN
  =========================================================
  */

  const productCategories = Array.from(
    new Set(
      products.map(
        (product) => product.category
      )
    )
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="text-5xl mb-4">
            ⏳
          </div>

          <h1 className="text-xl font-bold">
            Adminbereich wird geladen...
          </h1>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="min-h-screen bg-gray-100 flex items-center justify-center p-5">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-md w-full">
          <div className="text-5xl mb-4">
            🔒
          </div>

          <h1 className="text-2xl font-bold">
            Kein Zugriff
          </h1>

          <p className="text-gray-600 mt-2">
            Du hast keine Berechtigung für den
            Adminbereich.
          </p>

          <button
            onClick={() => {
              window.location.href = "/";
            }}
            className="mt-6 bg-black text-white px-6 py-3 rounded-xl font-semibold"
          >
            Zur Anmeldung
          </button>
        </div>
      </main>
    );
  }

  return (
    <main
      className={
        theme === "dark"
          ? "min-h-screen bg-gray-950 text-white"
          : "min-h-screen bg-gray-100 text-gray-900"
      }
    >
      {/* =====================================================
          HEADER
      ===================================================== */}

      <header
        className={
          theme === "dark"
            ? "bg-gray-900 border-b border-gray-800 p-5 sticky top-0 z-30"
            : "bg-white border-b border-gray-200 p-5 sticky top-0 z-30"
        }
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              🌯 Döner POS
            </h1>

            <p
              className={
                theme === "dark"
                  ? "text-gray-400 text-sm"
                  : "text-gray-600 text-sm"
              }
            >
              Adminbereich
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                setTheme(
                  theme === "dark"
                    ? "light"
                    : "dark"
                )
              }
              className={
                theme === "dark"
                  ? "bg-gray-800 px-4 py-2 rounded-xl font-semibold hover:bg-gray-700"
                  : "bg-gray-100 px-4 py-2 rounded-xl font-semibold hover:bg-gray-200"
              }
            >
              {theme === "dark"
                ? "☀️ Hell"
                : "🌙 Dunkel"}
            </button>

            <button
              onClick={logout}
              className="bg-red-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-red-700"
            >
              Abmelden
            </button>
          </div>
        </div>
      </header>

      {/* =====================================================
          LAYOUT
      ===================================================== */}

      <div className="max-w-7xl mx-auto p-5 md:p-8 flex flex-col lg:flex-row gap-6">
        {/* ===================================================
            SIDEBAR
        =================================================== */}

        <aside className="lg:w-64 shrink-0">
          <div
            className={
              theme === "dark"
                ? "bg-gray-900 rounded-2xl p-3 shadow-lg"
                : "bg-white rounded-2xl p-3 shadow-sm"
            }
          >
            {[
              ["dashboard", "📊 Dashboard"],
              ["orders", "🧾 Bestellungen"],
              ["employees", "👥 Mitarbeiter"],
              ["products", "🍽️ Produkte"],
              ["prices", "💶 Preise"],
              ["statistics", "📈 Statistiken"],
              ["settings", "⚙️ Einstellungen"],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() =>
                  setActiveSection(id)
                }
                className={`w-full text-left px-4 py-3 rounded-xl font-semibold mb-1 transition ${
                  activeSection === id
                    ? "bg-black text-white"
                    : theme === "dark"
                    ? "hover:bg-gray-800"
                    : "hover:bg-gray-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </aside>

        {/* ===================================================
            CONTENT
        =================================================== */}

        <section className="flex-1 min-w-0">
          {message && (
            <div
              className={
                theme === "dark"
                  ? "bg-green-900/40 text-green-300 border border-green-800 rounded-2xl p-4 mb-6 font-semibold"
                  : "bg-green-100 text-green-800 rounded-2xl p-4 mb-6 font-semibold"
              }
            >
              {message}
            </div>
          )}

          {/* =================================================
              DASHBOARD
          ================================================= */}

          {activeSection === "dashboard" && (
            <div>
              <div className="mb-6">
                <h2 className="text-3xl font-bold">
                  Dashboard
                </h2>

                <p
                  className={
                    theme === "dark"
                      ? "text-gray-400 mt-1"
                      : "text-gray-600 mt-1"
                  }
                >
                  Übersicht über dein Restaurant.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div
                  className={
                    theme === "dark"
                      ? "bg-gray-900 rounded-2xl p-6 shadow-lg"
                      : "bg-white rounded-2xl p-6 shadow-sm"
                  }
                >
                  <div className="text-3xl mb-3">
                    🧾
                  </div>

                  <p className="text-gray-500">
                    Bestellungen
                  </p>

                  <p className="text-3xl font-bold mt-1">
                    {orders.length}
                  </p>
                </div>

                <div
                  className={
                    theme === "dark"
                      ? "bg-gray-900 rounded-2xl p-6 shadow-lg"
                      : "bg-white rounded-2xl p-6 shadow-sm"
                  }
                >
                  <div className="text-3xl mb-3">
                    🔴
                  </div>

                  <p className="text-gray-500">
                    Offene Bestellungen
                  </p>

                  <p className="text-3xl font-bold mt-1">
                    {openOrders}
                  </p>
                </div>

                <div
                  className={
                    theme === "dark"
                      ? "bg-gray-900 rounded-2xl p-6 shadow-lg"
                      : "bg-white rounded-2xl p-6 shadow-sm"
                  }
                >
                  <div className="text-3xl mb-3">
                    🍽️
                  </div>

                  <p className="text-gray-500">
                    Produkte
                  </p>

                  <p className="text-3xl font-bold mt-1">
                    {products.length}
                  </p>
                </div>

                <div
                  className={
                    theme === "dark"
                      ? "bg-gray-900 rounded-2xl p-6 shadow-lg"
                      : "bg-white rounded-2xl p-6 shadow-sm"
                  }
                >
                  <div className="text-3xl mb-3">
                    👥
                  </div>

                  <p className="text-gray-500">
                    Mitarbeiter
                  </p>

                  <p className="text-3xl font-bold mt-1">
                    {profiles.length}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div
                  className={
                    theme === "dark"
                      ? "bg-gray-900 rounded-2xl p-6"
                      : "bg-white rounded-2xl p-6"
                  }
                >
                  <p className="text-gray-500">
                    Kellner
                  </p>

                  <p className="text-2xl font-bold mt-1">
                    {waiterCount}
                  </p>
                </div>

                <div
                  className={
                    theme === "dark"
                      ? "bg-gray-900 rounded-2xl p-6"
                      : "bg-white rounded-2xl p-6"
                  }
                >
                  <p className="text-gray-500">
                    Küche
                  </p>

                  <p className="text-2xl font-bold mt-1">
                    {kitchenCount}
                  </p>
                </div>

                <div
                  className={
                    theme === "dark"
                      ? "bg-gray-900 rounded-2xl p-6"
                      : "bg-white rounded-2xl p-6"
                  }
                >
                  <p className="text-gray-500">
                    Admins
                  </p>

                  <p className="text-2xl font-bold mt-1">
                    {adminCount}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* =================================================
              BESTELLUNGEN
          ================================================= */}

          {activeSection === "orders" && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-3xl font-bold">
                    Bestellungen
                  </h2>

                  <p
                    className={
                      theme === "dark"
                        ? "text-gray-400 mt-1"
                        : "text-gray-600 mt-1"
                    }
                  >
                    Alle Bestellungen im Überblick.
                  </p>
                </div>

                <button
                  onClick={loadData}
                  className="bg-black text-white px-5 py-3 rounded-xl font-semibold"
                >
                  ↻ Aktualisieren
                </button>
              </div>

              <div className="space-y-4">
                {orders.length === 0 ? (
                  <div
                    className={
                      theme === "dark"
                        ? "bg-gray-900 rounded-2xl p-8 text-center"
                        : "bg-white rounded-2xl p-8 text-center"
                    }
                  >
                    Noch keine Bestellungen.
                  </div>
                ) : (
                  orders.map((order) => (
                    <div
                      key={order.id}
                      className={
                        theme === "dark"
                          ? "bg-gray-900 rounded-2xl p-5 shadow-lg"
                          : "bg-white rounded-2xl p-5 shadow-sm"
                      }
                    >
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-3">
                            <h3 className="text-xl font-bold">
                              Bestellung #{order.id}
                            </h3>

                            <span
                              className={`px-3 py-1 rounded-full text-sm font-bold ${
                                order.status ===
                                "offen"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-green-100 text-green-800"
                              }`}
                            >
                              {order.status ===
                              "offen"
                                ? "Offen"
                                : "Fertig"}
                            </span>
                          </div>

                          <p className="text-gray-500 mt-2">
                            Tisch{" "}
                            {order.table_number} ·{" "}
                            {getWaiterName(
                              order.waiter_id
                            )}
                          </p>

                          <p className="text-gray-500 text-sm mt-1">
                            {formatDate(
                              order.created_at
                            )}
                          </p>
                        </div>

                        <div className="flex gap-2">
                          {order.status ===
                            "offen" && (
                            <button
                              onClick={() =>
                                finishOrder(order)
                              }
                              className="bg-green-600 text-white px-4 py-3 rounded-xl font-semibold hover:bg-green-700"
                            >
                              ✓ Fertig
                            </button>
                          )}

                          <button
                            onClick={() =>
                              deleteOrder(order)
                            }
                            className="bg-red-600 text-white px-4 py-3 rounded-xl font-semibold hover:bg-red-700"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      <div className="border-t mt-4 pt-4">
                        <p className="font-semibold mb-2">
                          Artikel
                        </p>

                        <div className="space-y-2">
                          {getOrderItems(
                            order.id
                          ).map((item) => (
                            <div
                              key={item.id}
                              className="flex justify-between bg-gray-50 dark:bg-gray-800 rounded-xl p-3"
                            >
                              <span>
                                {item.product_name}
                              </span>

                              <span className="font-bold">
                                ×{" "}
                                {item.quantity}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* =================================================
              MITARBEITER
          ================================================= */}

          {activeSection === "employees" && (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-3xl font-bold">
                    Mitarbeiter
                  </h2>

                  <p className="text-gray-500 mt-1">
                    Mitarbeiter verwalten.
                  </p>
                </div>

                <button
                  onClick={() =>
                    setShowEmployeeForm(
                      !showEmployeeForm
                    )
                  }
                  className="bg-black text-white px-5 py-3 rounded-xl font-semibold"
                >
                  + Mitarbeiter hinzufügen
                </button>
              </div>

              {showEmployeeForm && (
                <div
                  className={
                    theme === "dark"
                      ? "bg-gray-900 rounded-2xl p-6 mb-6"
                      : "bg-white rounded-2xl shadow-sm p-6 mb-6"
                  }
                >
                  <h3 className="text-xl font-bold mb-4">
                    Neuer Mitarbeiter
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      value={employeeName}
                      onChange={(event) =>
                        setEmployeeName(
                          event.target.value
                        )
                      }
                      placeholder="Name"
                      className="border rounded-xl px-4 py-3 bg-transparent"
                    />

                    <input
                      value={employeeEmail}
                      onChange={(event) =>
                        setEmployeeEmail(
                          event.target.value
                        )
                      }
                      placeholder="E-Mail"
                      type="email"
                      className="border rounded-xl px-4 py-3 bg-transparent"
                    />

                    <input
                      value={employeePassword}
                      onChange={(event) =>
                        setEmployeePassword(
                          event.target.value
                        )
                      }
                      placeholder="Passwort"
                      type="password"
                      className="border rounded-xl px-4 py-3 bg-transparent"
                    />

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
                      className="border rounded-xl px-4 py-3 bg-transparent"
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

                  <div className="flex gap-3 mt-5">
                    <button
                      onClick={
                        createEmployee
                      }
                      className="bg-green-600 text-white px-5 py-3 rounded-xl font-semibold"
                    >
                      Mitarbeiter erstellen
                    </button>

                    <button
                      onClick={() =>
                        setShowEmployeeForm(
                          false
                        )
                      }
                      className="bg-gray-200 text-gray-800 px-5 py-3 rounded-xl font-semibold"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {profiles.map((profile) => (
                  <div
                    key={profile.id}
                    className={
                      theme === "dark"
                        ? "bg-gray-900 rounded-2xl p-5 flex items-center justify-between gap-4"
                        : "bg-white rounded-2xl p-5 shadow-sm flex items-center justify-between gap-4"
                    }
                  >
                    <div>
                      <h3 className="font-bold text-lg">
                        {profile.name}
                      </h3>

                      <p className="text-gray-500">
                        {profile.role ===
                        "waiter"
                          ? "Kellner"
                          : profile.role ===
                            "kitchen"
                          ? "Küche"
                          : "Admin"}
                      </p>
                    </div>

                    <button
                      onClick={() =>
                        deleteEmployee(
                          profile
                        )
                      }
                      className="bg-red-600 text-white px-4 py-2 rounded-xl font-semibold"
                    >
                      🗑️ Löschen
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* =================================================
              PRODUKTE
          ================================================= */}

          {activeSection === "products" && (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-3xl font-bold">
                    Produkte
                  </h2>

                  <p className="text-gray-500 mt-1">
                    Produkte und Preise verwalten.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={createMenu}
                    className="bg-green-600 text-white px-5 py-3 rounded-xl font-semibold hover:bg-green-700"
                  >
                    🍽️ Speisekarte anlegen
                  </button>

                  <button
                    onClick={openAddProduct}
                    className="bg-black text-white px-5 py-3 rounded-xl font-semibold"
                  >
                    + Produkt
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                {productCategories.map(
                  (category) => {
                    const categoryProducts =
                      products.filter(
                        (product) =>
                          product.category ===
                          category
                      );

                    return (
                      <div
                        key={category}
                        className={
                          theme === "dark"
                            ? "bg-gray-900 rounded-2xl overflow-hidden"
                            : "bg-white rounded-2xl shadow-sm overflow-hidden"
                        }
                      >
                        <div className="p-5 border-b border-gray-200 dark:border-gray-800">
                          <h3 className="text-xl font-bold">
                            {category}
                          </h3>

                          <p className="text-gray-500 text-sm mt-1">
                            {
                              categoryProducts.length
                            }{" "}
                            Produkte
                          </p>
                        </div>

                        <div className="divide-y dark:divide-gray-800">
                          {categoryProducts.map(
                            (product) => (
                              <div
                                key={
                                  product.id
                                }
                                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                              >
                                <div>
                                  <h4 className="font-semibold">
                                    {
                                      product.name
                                    }
                                  </h4>

                                  <p className="text-xl font-bold mt-1">
                                    {formatPrice(
                                      Number(
                                        product.price
                                      )
                                    )}
                                  </p>
                                </div>

                                <div className="flex gap-2">
                                  <button
                                    onClick={() =>
                                      openEditProduct(
                                        product
                                      )
                                    }
                                    className="bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold"
                                  >
                                    ✏️ Bearbeiten
                                  </button>

                                  <button
                                    onClick={() =>
                                      deleteProduct(
                                        product
                                      )
                                    }
                                    className="bg-red-600 text-white px-4 py-2 rounded-xl font-semibold"
                                  >
                                    🗑️ Löschen
                                  </button>
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>

              {products.filter(
                (product) =>
                  !productCategories.includes(
                    product.category
                  )
              ).length > 0 && (
                <div
                  className={
                    theme === "dark"
                      ? "bg-gray-900 rounded-2xl mt-6 overflow-hidden"
                      : "bg-white rounded-2xl shadow-sm mt-6 overflow-hidden"
                  }
                >
                  <div className="p-5 border-b border-gray-200 dark:border-gray-800">
                    <h3 className="text-xl font-bold">
                      Weitere Produkte
                    </h3>
                  </div>

                  <div className="divide-y dark:divide-gray-800">
                    {products
                      .filter(
                        (product) =>
                          !productCategories.includes(
                            product.category
                          )
                      )
                      .map((product) => (
                        <div
                          key={product.id}
                          className="p-5 flex items-center justify-between gap-4"
                        >
                          <div>
                            <h4 className="font-semibold">
                              {product.name}
                            </h4>

                            <p className="text-gray-500 text-sm">
                              {
                                product.category
                              }
                            </p>

                            <p className="font-bold mt-1">
                              {formatPrice(
                                Number(
                                  product.price
                                )
                              )}
                            </p>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                openEditProduct(
                                  product
                                )
                              }
                              className="bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold"
                            >
                              ✏️
                            </button>

                            <button
                              onClick={() =>
                                deleteProduct(
                                  product
                                )
                              }
                              className="bg-red-600 text-white px-4 py-2 rounded-xl font-semibold"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =================================================
              PREISE
          ================================================= */}

          {activeSection === "prices" && (
            <div>
              <div className="mb-6">
                <h2 className="text-3xl font-bold">
                  Preise
                </h2>

                <p className="text-gray-500 mt-1">
                  Hier kannst du die Preise deiner
                  Produkte verwalten.
                </p>
              </div>

              <div
                className={
                  theme === "dark"
                    ? "bg-gray-900 rounded-2xl p-6"
                    : "bg-white rounded-2xl shadow-sm p-6"
                }
              >
                <h3 className="text-xl font-bold">
                  Aktuelle Speisekarte
                </h3>

                <p className="text-gray-500 mt-2">
                  Die Preise werden direkt aus der
                  Produkt-Datenbank verwendet.
                </p>

                <button
                  onClick={() =>
                    setActiveSection(
                      "products"
                    )
                  }
                  className="mt-5 bg-black text-white px-5 py-3 rounded-xl font-semibold"
                >
                  Preise bearbeiten
                </button>
              </div>
            </div>
          )}

          {/* =================================================
              STATISTIKEN
          ================================================= */}

          {activeSection === "statistics" && (
            <div>
              <div className="mb-6">
                <h2 className="text-3xl font-bold">
                  Statistiken
                </h2>

                <p className="text-gray-500 mt-1">
                  Bestellungen der letzten Tage.
                </p>
              </div>

              <div
                className={
                  theme === "dark"
                    ? "bg-gray-900 rounded-2xl p-6"
                    : "bg-white rounded-2xl shadow-sm p-6"
                }
              >
                <h3 className="text-xl font-bold mb-5">
                  Letzte 7 Tage
                </h3>

                <div className="space-y-4">
                  {dailyStatistics.map(
                    (statistic) => (
                      <div
                        key={
                          statistic.date
                        }
                      >
                        <div className="flex justify-between mb-1">
                          <span className="font-semibold">
                            {
                              statistic.label
                            }
                          </span>

                          <span className="font-bold">
                            {
                              statistic.count
                            }
                          </span>
                        </div>

                        <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-black dark:bg-white rounded-full"
                            style={{
                              width: `${
                                Math.min(
                                  statistic.count *
                                    10,
                                  100
                                )
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    )
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 mt-8">
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-5">
                    <p className="text-gray-500">
                      Gesamt
                    </p>

                    <p className="text-3xl font-bold mt-1">
                      {orders.length}
                    </p>
                  </div>

                  <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-5">
                    <p className="text-gray-500">
                      Fertig
                    </p>

                    <p className="text-3xl font-bold mt-1">
                      {finishedOrders}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =================================================
              EINSTELLUNGEN
          ================================================= */}

          {activeSection === "settings" && (
            <div>
              <div className="mb-6">
                <h2 className="text-3xl font-bold">
                  Einstellungen
                </h2>

                <p className="text-gray-500 mt-1">
                  Einstellungen für dein POS-System.
                </p>
              </div>

              <div
                className={
                  theme === "dark"
                    ? "bg-gray-900 rounded-2xl p-6"
                    : "bg-white rounded-2xl shadow-sm p-6"
                }
              >
                <h3 className="text-xl font-bold">
                  Erscheinungsbild
                </h3>

                <div className="flex items-center justify-between mt-5">
                  <div>
                    <p className="font-semibold">
                      Dark Mode
                    </p>

                    <p className="text-gray-500 text-sm">
                      Aktuelles Design:
                      {" "}
                      {theme === "dark"
                        ? "Dunkel"
                        : "Hell"}
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
                    className="bg-black text-white px-5 py-3 rounded-xl font-semibold"
                  >
                    {theme === "dark"
                      ? "☀️ Hell"
                      : "🌙 Dunkel"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* =====================================================
          PRODUKT MODAL
      ===================================================== */}

      {showProductForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-5">
          <div
            className={
              theme === "dark"
                ? "bg-gray-900 text-white rounded-2xl shadow-2xl w-full max-w-lg p-6"
                : "bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6"
            }
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl font-bold">
                {editingProduct
                  ? "Produkt bearbeiten"
                  : "Produkt hinzufügen"}
              </h2>

              <button
                onClick={() =>
                  setShowProductForm(false)
                }
                className="text-xl"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block font-semibold mb-2">
                  Produktname
                </label>

                <input
                  value={productName}
                  onChange={(event) =>
                    setProductName(
                      event.target.value
                    )
                  }
                  placeholder="z. B. Döner Spezial"
                  className="w-full border rounded-xl px-4 py-3 bg-transparent"
                />
              </div>

              <div>
                <label className="block font-semibold mb-2">
                  Kategorie
                </label>

                <input
                  value={productCategory}
                  onChange={(event) =>
                    setProductCategory(
                      event.target.value
                    )
                  }
                  placeholder="z. B. Döner-Spezialitäten"
                  className="w-full border rounded-xl px-4 py-3 bg-transparent"
                />
              </div>

              <div>
                <label className="block font-semibold mb-2">
                  Preis
                </label>

                <input
                  value={productPrice}
                  onChange={(event) =>
                    setProductPrice(
                      event.target.value
                    )
                  }
                  placeholder="z. B. 7,50"
                  inputMode="decimal"
                  className="w-full border rounded-xl px-4 py-3 bg-transparent"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={saveProduct}
                className="flex-1 bg-black text-white rounded-xl py-3 font-bold"
              >
                {editingProduct
                  ? "Änderungen speichern"
                  : "Produkt hinzufügen"}
              </button>

              <button
                onClick={() =>
                  setShowProductForm(false)
                }
                className="bg-gray-200 text-gray-800 rounded-xl px-5 py-3 font-semibold"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}