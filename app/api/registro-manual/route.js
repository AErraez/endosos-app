import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { roundDetalle } from "@/lib/money";

// Backfills a historical endoso into the history array only. Unlike /api/data
// and /api/exclusion, this never touches `items` — it exists purely to register
// endosos (inclusiones / aumentos de suma) whose values were already applied to
// the current valores asegurados before this history tracking existed.
export async function PATCH(request) {
    const { polizaId, endoso_id, tipo, subtipo, estado, detalle } = await request.json();

    if (!polizaId || !endoso_id || !tipo || !Array.isArray(detalle) || detalle.length === 0) {
        return NextResponse.json({ error: "Faltan datos del endoso." }, { status: 400 });
    }

    const endosoEntry = {
        endoso_id,
        tipo,
        ...(tipo === "movimiento de suma" ? { subtipo } : {}),
        ...(estado === "anulado" ? { estado: "anulado" } : {}),
        detalle: roundDetalle(detalle),
    };

    try {
        const client = await clientPromise;
        const db = client.db("Data");

        await db.collection("Polizas").updateOne(
            { _id: new ObjectId(polizaId) },
            { $push: { endosos: endosoEntry } }
        );

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
