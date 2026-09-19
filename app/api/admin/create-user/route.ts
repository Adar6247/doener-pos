import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      name,
      email,
      password,
      role,
    } = body;

    // Eingaben prüfen
    if (
      !name ||
      !email ||
      !password ||
      !role
    ) {
      return NextResponse.json(
        {
          error:
            "Bitte alle Felder ausfüllen.",
        },
        { status: 400 }
      );
    }

    // Rolle prüfen
    if (
      !["waiter", "kitchen", "admin"].includes(
        role
      )
    ) {
      return NextResponse.json(
        {
          error: "Ungültige Rolle.",
        },
        { status: 400 }
      );
    }

    // Name prüfen
    if (name.trim().length < 2) {
      return NextResponse.json(
        {
          error:
            "Der Name muss mindestens 2 Zeichen lang sein.",
        },
        { status: 400 }
      );
    }

    // E-Mail prüfen
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail.includes("@")) {
      return NextResponse.json(
        {
          error:
            "Bitte eine gültige E-Mail-Adresse eingeben.",
        },
        { status: 400 }
      );
    }

    // Passwort prüfen
    if (password.length < 6) {
      return NextResponse.json(
        {
          error:
            "Das Passwort muss mindestens 6 Zeichen lang sein.",
        },
        { status: 400 }
      );
    }

    // Supabase Server-Konfiguration
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      return NextResponse.json(
        {
          error:
            "Supabase Server-Konfiguration fehlt.",
        },
        { status: 500 }
      );
    }

    // Supabase Admin Client
    const supabaseAdmin =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );

    // ==========================================
    // 1. Benutzer in Supabase Auth erstellen
    // ==========================================

    const {
      data: authData,
      error: authError,
    } =
      await supabaseAdmin.auth.admin.createUser(
        {
          email: cleanEmail,
          password,
          email_confirm: true,
        }
      );

    if (authError) {
      console.error(
        "CREATE AUTH USER ERROR:",
        authError
      );

      // E-Mail bereits vorhanden
      if (
        authError.message
          .toLowerCase()
          .includes("already")
      ) {
        return NextResponse.json(
          {
            error:
              "Diese E-Mail-Adresse wird bereits verwendet.",
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          error:
            authError.message ||
            "Mitarbeiter konnte nicht erstellt werden.",
        },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        {
          error:
            "Benutzer konnte nicht erstellt werden.",
        },
        { status: 500 }
      );
    }

    const userId = authData.user.id;

    // ==========================================
    // 2. Profil erstellen
    // ==========================================

    const { error: profileError } =
      await supabaseAdmin
        .from("profiles")
        .insert({
          id: userId,
          name: name.trim(),
          role,
        });

    if (profileError) {
      console.error(
        "CREATE PROFILE ERROR:",
        profileError
      );

      // Auth-Benutzer wieder löschen,
      // falls das Profil nicht erstellt werden konnte
      await supabaseAdmin.auth.admin.deleteUser(
        userId
      );

      return NextResponse.json(
        {
          error:
            "Mitarbeiterprofil konnte nicht erstellt werden.",
        },
        { status: 500 }
      );
    }

    // ==========================================
    // Erfolgreich
    // ==========================================

    return NextResponse.json(
      {
        success: true,
        message:
          "Mitarbeiter wurde erfolgreich erstellt.",
        user: {
          id: userId,
          name: name.trim(),
          email: cleanEmail,
          role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "CREATE USER ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Interner Serverfehler.",
      },
      { status: 500 }
    );
  }
}