"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    setError("");
    setLoading(true);

    const { data, error: loginError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (loginError || !data.user) {
      setLoading(false);
      setError("E-Mail oder Passwort ist falsch.");
      return;
    }

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

    if (profileError || !profile) {
      console.error(profileError);

      await supabase.auth.signOut();

      setLoading(false);
      setError(
        "Für diesen Benutzer wurde keine Rolle gefunden."
      );

      return;
    }

    // ==============================
    // KÜCHE
    // ==============================

    if (profile.role === "kitchen") {
      window.location.href = "/kitchen";
      return;
    }

    // ==============================
    // KELLNER
    // ==============================

    if (profile.role === "waiter") {
      window.location.href = "/dashboard";
      return;
    }

    // ==============================
    // ADMIN
    // ==============================

    if (profile.role === "admin") {
      window.location.href = "/admin";
      return;
    }

    // ==============================
    // UNBEKANNTE ROLLE
    // ==============================

    await supabase.auth.signOut();

    setLoading(false);
    setError("Unbekannte Benutzerrolle.");
  }

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        
        {/* Logo / Überschrift */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🌯</div>

          <h1 className="text-3xl font-bold">
            Döner POS
          </h1>

          <p className="text-gray-500 mt-2">
            Bestellsystem
          </p>
        </div>

        {/* Login */}
        <form
          onSubmit={handleLogin}
          className="space-y-5"
        >

          {/* E-Mail */}
          <div>
            <label className="block font-medium mb-2">
              E-Mail
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              placeholder="E-Mail eingeben"
              required
              className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          {/* Passwort */}
          <div>
            <label className="block font-medium mb-2">
              Passwort
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              placeholder="Passwort eingeben"
              required
              className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          {/* Fehlermeldung */}
          {error && (
            <div className="bg-red-100 text-red-700 rounded-xl p-3 text-sm">
              {error}
            </div>
          )}

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white rounded-xl py-3 font-semibold text-lg hover:bg-gray-800 disabled:opacity-50"
          >
            {loading
              ? "Anmelden..."
              : "Anmelden"}
          </button>

        </form>
      </div>
    </main>
  );
}