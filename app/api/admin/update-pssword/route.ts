
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { id, password } = body;

    if (!id || !password) {
      return NextResponse.json(
        {
          error: "Bitte alle Felder ausfüllen.",
        },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        {
          error:
            "Das Passwort muss mindestens 6 Zeichen haben.",
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

    const { error } =
      await supabaseAdmin.auth.admin.updateUserById(
        id,
        {
          password,
        }
      );

    if (error) {
      console.error(
        "UPDATE PASSWORD ERROR:",
        error
      );

      return NextResponse.json(
        {
          error:
            "Passwort konnte nicht geändert werden.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Passwort wurde erfolgreich geändert.",
    });
  } catch (error) {
    console.error(
      "UPDATE PASSWORD SERVER ERROR:",
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