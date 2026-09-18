
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { id, name, role } = body;

    if (!id || !name || !role) {
      return NextResponse.json(
        {
          error: "Bitte alle Felder ausfüllen.",
        },
        { status: 400 }
      );
    }

    if (!["waiter", "kitchen", "admin"].includes(role)) {
      return NextResponse.json(
        {
          error: "Ungültige Rolle.",
        },
        { status: 400 }
      );
    }

    if (name.trim().length < 2) {
      return NextResponse.json(
        {
          error:
            "Der Name muss mindestens 2 Zeichen lang sein.",
        },
        { status: 400 }
      );
    }

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

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

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        name: name.trim(),
        role: role,
      })
      .eq("id", id);

    if (error) {
      console.error(
        "UPDATE EMPLOYEE ERROR:",
        error
      );

      return NextResponse.json(
        {
          error:
            "Mitarbeiter konnte nicht aktualisiert werden.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Mitarbeiter wurde erfolgreich aktualisiert.",
    });
  } catch (error) {
    console.error(
      "UPDATE USER ERROR:",
      error
    );

    return NextResponse.json(
      {
        error: "Interner Serverfehler.",
      },
      { status: 500 }
    );
  }
}
