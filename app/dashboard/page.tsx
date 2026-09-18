
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const categories = {
  "Lahmacun-Spezialitäten": [
    "Lahmacun",
    "Lahmacun mit Salat und Soße (gerollt)",
    "Lahmacun mit Käse",
    "Lahmacun Spezial",
    "Lahmacun Teller",
    "Lahmacun Spezial Teller",
  ],

  "Grillspezialitäten": [
    "Lammspieße",
    "Lammkoteletts",
    "Adana Kebap",
    "Steak",
    "Gemischter Grill",
    "Chicken Nuggets mit Pommes",
    "Chicken Wings mit Pommes",
  ],

  Burger: [
    "Hamburger (55 g)",
    "Hamburger XXL (125 g)",
    "Cheeseburger (55 g)",
    "Cheeseburger XXL (125 g)",
    "Chickenburger (90 g)",
  ],

  Salate: [
    "Gemischter Salat (klein)",
    "Gemischter Salat (groß)",
    "Hirten-Salat",
    "Salat Tonno",
    "Salat mit Putenstreifen",
  ],

  "Pizza (Ø 30 cm)": [
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

  Flammkuchen: [
    "Flammkuchen",
  ],

  "Döner-Spezialitäten": [
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

  "Falafel-Spezialitäten": [
    "Falafel im Fladenbrot",
    "Falafel Box",
    "Falafel Teller",
  ],

  Extras: [
    "Portion Pommes",
    "Iskender",
  ],

  "Pide und Seele": [
    "Pide mit Käse",
    "Pide mit Hackfleisch",
    "Pide mit Spinat & Käse",
    "Pide mit Sucuk & Käse",
    "Seele mit Putenschinken und Käse",
    "Seele mit Dönerfleisch, frischen Tomaten und Zwiebeln",
  ],

  "Warme Getränke": [
    "Tasse Kaffee (klein)",
  ],

  "Alkoholische Getränke": [
    "Hofbräu 0,5 l",
    "Pils Hofbräu 0,5 l",
    "Hefeweizen hell 0,5 l",
    "Kristallweizen 0,5 l",
    "Radler 0,5 l",
    "Beck’s 0,33 l",
    "Beck’s Lemon 0,33 l",
    "Tannenzäpfle 0,33 l",
    "Tannenzäpfle 0,33 l",
    "Desperados 0,33 l",
    "Rotwein Trollinger 0,25 l",
    "Weißwein Riesling 0,25 l",
    "Rosé Württemberger 0,25 l",
    "Weinschorle 0,25 l",
  ],

  "Kalte Getränke – Softdrinks": [
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

  "Kalte Getränke – Säfte": [
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

  Schweppes: [
    "Ginger Ale",
    "Tonic Water",
    "Bitter Lemon",
  ],

  Cocktails: [
    "Aperol Spritz",
    "Hugo",
    "Campari Orange",
    "Campari Soda",
  ],

  Longdrinks: [
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

  Spirituosen: [
    "Jägermeister",
    "Ramazzotti",
    "Wodka",
    "Tequila",
    "Asbach",
    "Baileys",
    "Williams",
  ],
};

type CartItem = {
  name: string;
  quantity: number;
};

type FinishedNotification = {
  id: number;
  tableNumber: number;
};

export default function Dashboard() {
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");

  const [selectedCategory, setSelectedCategory] =
    useState<string | null>(null);

  const [tableNumber, setTableNumber] =
    useState<number | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);

  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  const [notifications, setNotifications] =
    useState<FinishedNotification[]>([]);

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

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`waiter-finished-orders-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `waiter_id=eq.${userId}`,
        },
        (payload) => {
          const newOrder = payload.new as {
            id: number;
            table_number: number;
            status: string;
          };

          const oldOrder = payload.old as {
            status?: string;
          };

          if (
            oldOrder.status === "offen" &&
            newOrder.status === "fertig"
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
                  id: newOrder.id,
                  tableNumber: newOrder.table_number,
                },
              ];
            });

            setMessage(
              `🔔 Tisch ${newOrder.table_number} ist fertig!`
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  function addToCart(productName: string) {
    setCart((currentCart) => {
      const existing = currentCart.find(
        (item) => item.name === productName
      );

      if (existing) {
        return currentCart.map((item) =>
          item.name === productName
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
          name: productName,
          quantity: 1,
        },
      ];
    });

    setShowCart(true);
  }

  function increaseQuantity(productName: string) {
    setCart((currentCart) =>
      currentCart.map((item) =>
        item.name === productName
          ? {
              ...item,
              quantity: item.quantity + 1,
            }
          : item
      )
    );
  }

  function decreaseQuantity(productName: string) {
    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.name === productName
            ? {
                ...item,
                quantity: item.quantity - 1,
              }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function clearCart() {
    setCart([]);
  }

  function startNewOrder() {
    setTableNumber(null);
    setSelectedCategory(null);
    setCart([]);
    setShowCart(false);
    setMessage("");
  }

  function removeNotification(id: number) {
    setNotifications((current) =>
      current.filter(
        (notification) => notification.id !== id
      )
    );
  }

  async function submitOrder() {
    if (!tableNumber) {
      setMessage("Bitte zuerst einen Tisch auswählen.");
      return;
    }

    if (cart.length === 0) {
      setMessage("Der Warenkorb ist leer.");
      return;
    }

    setSending(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("USER FEHLER:", {
        message: userError?.message,
        code: userError?.code,
      });

      setSending(false);
      setMessage(
        "Du bist nicht richtig angemeldet. Bitte neu anmelden."
      );
      return;
    }

    console.log("BESTELLUNG WIRD GESPEICHERT:", {
      table_number: tableNumber,
      waiter_id: user.id,
      status: "offen",
    });

    const { data: order, error: orderError } =
      await supabase
        .from("orders")
        .insert({
          table_number: tableNumber,
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

      setMessage(
        orderError?.message ||
          "Die Bestellung konnte nicht gespeichert werden."
      );

      return;
    }

    console.log("BESTELLUNG ERSTELLT:", order);

    const orderItems = cart.map((item) => ({
      order_id: order.id,
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

      setMessage(
        itemsError.message ||
          "Die Produkte konnten nicht gespeichert werden."
      );

      return;
    }

    setSending(false);

    setCart([]);
    setSelectedCategory(null);
    setShowCart(false);

    setMessage(
      `Bestellung für Tisch ${tableNumber} wurde abgeschickt!`
    );
  }

  const products = selectedCategory
    ? categories[
        selectedCategory as keyof typeof categories
      ]
    : [];

  const totalItems = cart.reduce(
    (total, item) => total + item.quantity,
    0
  );

  const tables = Array.from(
    { length: 25 },
    (_, index) => index + 1
  );

  return (
    <main className="min-h-screen bg-gray-100">
      {notifications.length > 0 && (
        <div className="fixed top-5 right-5 z-[100] w-full max-w-sm space-y-3">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className="bg-green-600 text-white rounded-2xl shadow-2xl p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-2xl mb-1">
                    🔔
                  </div>

                  <h3 className="font-bold text-lg">
                    Bestellung fertig!
                  </h3>

                  <p className="mt-1">
                    Tisch {notification.tableNumber} ist
                    fertig.
                  </p>
                </div>

                <button
                  onClick={() =>
                    removeNotification(notification.id)
                  }
                  className="text-white/80 hover:text-white text-xl"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <header className="bg-white shadow-sm p-5 flex items-center justify-between sticky top-0 z-20">
        <div>
          <h1 className="text-2xl font-bold">
            🌯 Döner POS
          </h1>

          <p className="text-gray-600 text-sm">
            Kellner-Bereich
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCart(true)}
            className="relative bg-black text-white px-5 py-2 rounded-xl font-semibold hover:bg-gray-800"
          >
            🛒 Warenkorb

            {totalItems > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full min-w-6 h-6 flex items-center justify-center px-1">
                {totalItems}
              </span>
            )}
          </button>

          <button
            onClick={logout}
            className="bg-red-600 text-white px-5 py-2 rounded-xl font-semibold hover:bg-red-700"
          >
            Abmelden
          </button>
        </div>
      </header>

      <div className="p-5 md:p-8 max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
          <h2 className="text-xl font-bold">
            Willkommen 👋
          </h2>

          <p className="text-gray-700 mt-1">
            Angemeldet als: {email}
          </p>
        </div>

        {message && (
          <div
            className={`rounded-2xl p-4 mb-6 font-semibold ${
              message.startsWith("Bestellung")
                ? "bg-green-100 text-green-800"
                : message.startsWith("🔔")
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {message}
          </div>
        )}

        {tableNumber === null && (
          <>
            <h2 className="text-2xl font-bold mb-2">
              Tisch auswählen
            </h2>

            <p className="text-gray-600 mb-5">
              Wähle den Tisch für die Bestellung.
            </p>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
              {tables.map((table) => (
                <button
                  key={table}
                  onClick={() => setTableNumber(table)}
                  className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-lg hover:-translate-y-1 transition"
                >
                  <div className="text-3xl mb-2">
                    🪑
                  </div>

                  <div className="font-bold text-lg">
                    Tisch {table}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {tableNumber !== null && !selectedCategory && (
          <>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-2xl font-bold">
                  Bestellung für Tisch {tableNumber}
                </h2>

                <p className="text-gray-600 mt-1">
                  Kategorie auswählen
                </p>
              </div>

              <button
                onClick={() => setTableNumber(null)}
                className="bg-white px-5 py-3 rounded-xl shadow-sm font-semibold hover:bg-gray-50"
              >
                Tisch ändern
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Object.keys(categories).map(
                (category) => (
                  <button
                    key={category}
                    onClick={() =>
                      setSelectedCategory(category)
                    }
                    className="bg-white rounded-2xl shadow-sm p-5 hover:shadow-lg hover:-translate-y-1 transition text-left"
                  >
                    <h3 className="font-bold text-lg">
                      {category}
                    </h3>

                    <p className="text-gray-600 mt-2">
                      {
                        categories[
                          category as keyof typeof categories
                        ].length
                      }{" "}
                      Produkte
                    </p>
                  </button>
                )
              )}
            </div>
          </>
        )}

        {tableNumber !== null &&
          selectedCategory && (
            <>
              <div className="flex items-center justify-between mb-5">
                <button
                  onClick={() =>
                    setSelectedCategory(null)
                  }
                  className="bg-white px-5 py-3 rounded-xl shadow-sm font-semibold hover:bg-gray-50"
                >
                  ← Kategorien
                </button>

                <div className="font-bold">
                  Tisch {tableNumber}
                </div>
              </div>

              <h2 className="text-2xl font-bold mb-5">
                {selectedCategory}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {products.map((product) => (
                  <button
                    key={product}
                    onClick={() =>
                      addToCart(product)
                    }
                    className="bg-white rounded-2xl shadow-sm p-5 text-left hover:shadow-lg hover:-translate-y-1 transition"
                  >
                    <h3 className="font-bold text-lg">
                      {product}
                    </h3>

                    <p className="text-gray-600 text-sm mt-2">
                      + Zum Warenkorb
                    </p>
                  </button>
                ))}
              </div>
            </>
          )}
      </div>

      {showCart && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col">
            <div className="p-5 border-b flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">
                  🛒 Warenkorb
                </h2>

                <p className="text-gray-600 text-sm">
                  Tisch {tableNumber} · {totalItems} Artikel
                </p>
              </div>

              <button
                onClick={() => setShowCart(false)}
                className="text-2xl hover:bg-gray-100 rounded-xl px-3 py-2"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {cart.length === 0 ? (
                <div className="text-center text-gray-600 py-16">
                  <div className="text-5xl mb-4">
                    🛒
                  </div>

                  <p className="font-semibold">
                    Der Warenkorb ist leer.
                  </p>

                  <p className="text-sm mt-2">
                    Wähle ein Produkt aus.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div
                      key={item.name}
                      className="border rounded-2xl p-4"
                    >
                      <div className="font-semibold mb-3">
                        {item.name}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() =>
                              decreaseQuantity(
                                item.name
                              )
                            }
                            className="w-10 h-10 rounded-xl bg-gray-200 text-xl font-bold hover:bg-gray-300"
                          >
                            −
                          </button>

                          <span className="font-bold text-lg min-w-6 text-center">
                            {item.quantity}
                          </span>

                          <button
                            onClick={() =>
                              increaseQuantity(
                                item.name
                              )
                            }
                            className="w-10 h-10 rounded-xl bg-black text-white text-xl font-bold hover:bg-gray-800"
                          >
                            +
                          </button>
                        </div>

                        <button
                          onClick={() =>
                            setCart(
                              (currentCart) =>
                                currentCart.filter(
                                  (cartItem) =>
                                    cartItem.name !==
                                    item.name
                                )
                            )
                          }
                          className="text-red-600 font-semibold hover:text-red-800"
                        >
                          Entfernen
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t p-5 space-y-3">
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="w-full border border-red-300 text-red-600 rounded-xl py-3 font-semibold hover:bg-red-50"
                >
                  Warenkorb leeren
                </button>
              )}

              <button
                onClick={submitOrder}
                disabled={
                  cart.length === 0 || sending
                }
                className="w-full bg-black text-white rounded-xl py-4 font-bold text-lg disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {sending
                  ? "Wird abgeschickt..."
                  : "Bestellung abschicken"}
              </button>

              <button
                onClick={startNewOrder}
                className="w-full bg-gray-100 text-gray-800 rounded-xl py-3 font-semibold hover:bg-gray-200"
              >
                Neue Bestellung
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
