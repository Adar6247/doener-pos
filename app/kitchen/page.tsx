
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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

type OrderWithItems = Order & {
  items: OrderItem[];
};

export default function KitchenPage() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [finishingOrder, setFinishingOrder] =
    useState<number | null>(null);

  async function loadOrders() {
    const { data: ordersData, error: ordersError } =
      await supabase
        .from("orders")
        .select("*")
        .order("created_at", {
          ascending: true,
        });

    if (ordersError) {
      console.error(ordersError);
      setLoading(false);
      return;
    }

    const { data: itemsData, error: itemsError } =
      await supabase
        .from("order_items")
        .select("*");

    if (itemsError) {
      console.error(itemsError);
      setLoading(false);
      return;
    }

    const combinedOrders: OrderWithItems[] =
      (ordersData ?? []).map((order) => ({
        ...order,
        items: (itemsData ?? []).filter(
          (item) => item.order_id === order.id
        ),
      }));

    setOrders(combinedOrders);
    setLoading(false);
  }

  useEffect(() => {
    loadOrders();

    // Echtzeit-Aktualisierung
    const channel = supabase
      .channel("kitchen-orders")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        () => {
          loadOrders();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "order_items",
        },
        () => {
          loadOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function finishOrder(orderId: number) {
    setFinishingOrder(orderId);

    const { error } = await supabase
      .from("orders")
      .update({
        status: "fertig",
        finished_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (error) {
      console.error(error);
      setFinishingOrder(null);
      return;
    }

    await loadOrders();

    setFinishingOrder(null);
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const openOrders = orders.filter(
    (order) => order.status === "offen"
  );

  const finishedOrders = orders.filter(
    (order) => order.status === "fertig"
  );

  return (
    <main className="min-h-screen bg-gray-100">
      {/* HEADER */}
      <header className="bg-white shadow-sm p-5 flex items-center justify-between sticky top-0 z-20">
        <div>
          <h1 className="text-2xl font-bold">
            👨‍🍳 Küchenbereich
          </h1>

          <p className="text-gray-500 text-sm">
            Bestellungen
          </p>
        </div>

        <button
          onClick={logout}
          className="bg-red-600 text-white px-5 py-2 rounded-xl font-semibold hover:bg-red-700"
        >
          Abmelden
        </button>
      </header>

      <div className="p-5 md:p-8 max-w-7xl mx-auto">
        {/* OFFENE BESTELLUNGEN */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-2xl font-bold">
                🔔 Offene Bestellungen
              </h2>

              <p className="text-gray-500 mt-1">
                {openOrders.length} offene Bestellung
                {openOrders.length !== 1 ? "en" : ""}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl p-8 text-center">
              <p className="text-gray-500">
                Bestellungen werden geladen...
              </p>
            </div>
          ) : openOrders.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
              <div className="text-5xl mb-4">
                👨‍🍳
              </div>

              <h3 className="text-xl font-bold">
                Keine offenen Bestellungen
              </h3>

              <p className="text-gray-500 mt-2">
                Neue Bestellungen erscheinen hier automatisch.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {openOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl shadow-sm overflow-hidden"
                >
                  {/* ORDER HEADER */}
                  <div className="bg-black text-white p-5 flex items-center justify-between">
                    <div>
                      <p className="text-sm opacity-70">
                        Bestellung
                      </p>

                      <h3 className="text-2xl font-bold">
                        Tisch {order.table_number}
                      </h3>
                    </div>

                    <div className="text-right">
                      <p className="text-sm opacity-70">
                        #{order.id}
                      </p>

                      <p className="text-sm">
                        {new Date(
                          order.created_at
                        ).toLocaleTimeString("de-DE", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>

                  {/* PRODUCTS */}
                  <div className="p-5">
                    <div className="space-y-3">
                      {order.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between border-b pb-3 last:border-b-0"
                        >
                          <span className="font-medium">
                            {item.product_name}
                          </span>

                          <span className="bg-gray-100 rounded-lg px-3 py-1 font-bold">
                            {item.quantity}×
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* FINISH BUTTON */}
                    <button
                      onClick={() =>
                        finishOrder(order.id)
                      }
                      disabled={
                        finishingOrder === order.id
                      }
                      className="w-full mt-6 bg-green-600 text-white rounded-xl py-4 font-bold text-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      {finishingOrder === order.id
                        ? "Wird abgeschlossen..."
                        : "✅ Bestellung fertig"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* FERTIGE BESTELLUNGEN */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold mb-2">
            ✅ Fertige Bestellungen
          </h2>

          <p className="text-gray-500 mb-5">
            Bereits von der Küche abgeschlossene Bestellungen.
          </p>

          {finishedOrders.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-500">
              Noch keine fertigen Bestellungen.
            </div>
          ) : (
            <div className="space-y-4">
              {finishedOrders
                .slice()
                .reverse()
                .map((order) => (
                  <div
                    key={order.id}
                    className="bg-white rounded-2xl shadow-sm p-5"
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div>
                        <h3 className="font-bold text-lg">
                          Tisch {order.table_number}
                        </h3>

                        <p className="text-gray-500 text-sm">
                          Bestellung #{order.id}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {order.items.map((item) => (
                          <span
                            key={item.id}
                            className="bg-gray-100 rounded-lg px-3 py-2 text-sm"
                          >
                            {item.quantity}×{" "}
                            {item.product_name}
                          </span>
                        ))}
                      </div>

                      <div className="text-green-600 font-semibold">
                        Fertig
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}