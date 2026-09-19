import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const id = body.id;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Ungültige Mitarbeiter-ID." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Supabase Server-Konfiguration fehlt." },
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
     * Profil zuerst löschen.
     * Der Auth-Benutzer wird anschließend ebenfalls gelöscht.
     */
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", id);

    if (profileError) {
      console.error("Profil löschen:", profileError);

      return NextResponse.json(
        {
          error:
            "Das Mitarbeiterprofil konnte nicht gelöscht werden.",
        },
        { status: 500 }
      );
    }

    const { error: authError } =
      await supabaseAdmin.auth.admin.deleteUser(id);

    if (authError) {
      console.error("Auth-User löschen:", authError);

      return NextResponse.json(
        {
          error:
            "Das Mitarbeiterkonto konnte nicht vollständig gelöscht werden.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Delete user error:", error);

    return NextResponse.json(
      {
        error: "Beim Löschen ist ein Fehler aufgetreten.",
      },
      { status: 500 }
    );
  }
}