import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const id = body.id;
    const name = body.name;
    const role = body.role;
    const password = body.password;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Ungültige Mitarbeiter-ID." },
        { status: 400 }
      );
    }

    if (
      role !== "waiter" &&
      role !== "kitchen" &&
      role !== "admin"
    ) {
      return NextResponse.json(
        { error: "Ungültige Mitarbeiterrolle." },
        { status: 400 }
      );
    }

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Bitte einen Namen eingeben." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            "Supabase Server-Konfiguration fehlt.",
        },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    /*
     * Namen und Rolle im Profil aktualisieren
     */
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        name: name.trim(),
        role,
      })
      .eq("id", id);

    if (profileError) {
      console.error(
        "Profil aktualisieren:",
        profileError
      );

      return NextResponse.json(
        {
          error:
            "Das Mitarbeiterprofil konnte nicht aktualisiert werden.",
        },
        { status: 500 }
      );
    }

    /*
     * Passwort nur ändern,
     * wenn tatsächlich eines eingegeben wurde.
     */
    if (
      password !== undefined &&
      password !== null &&
      password !== ""
    ) {
      if (
        typeof password !== "string" ||
        password.length < 6
      ) {
        return NextResponse.json(
          {
            error:
              "Das Passwort muss mindestens 6 Zeichen lang sein.",
          },
          { status: 400 }
        );
      }

      const { error: passwordError } =
        await supabaseAdmin.auth.admin.updateUserById(
          id,
          {
            password,
          }
        );

      if (passwordError) {
        console.error(
          "Passwort aktualisieren:",
          passwordError
        );

        return NextResponse.json(
          {
            error:
              "Das Passwort konnte nicht geändert werden.",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "Update user error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Beim Bearbeiten des Mitarbeiters ist ein Fehler aufgetreten.",
      },
      { status: 500 }
    );
  }
}