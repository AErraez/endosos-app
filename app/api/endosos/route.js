import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

export async function PATCH(request) {
    const { polizaId, endosoId, endosoIndex, detalle, tipo } = await request.json();

    // "beneficiario" endosos move valor_endosado_total; every "movimiento de suma"
    // subtipo (inclusión, modificación de suma, exclusión) moves valor_asegurado
    // instead. Missing/legacy tipo is treated as "beneficiario" for back-compat.
    const targetField = tipo === "movimiento de suma" ? "valor_asegurado" : "valor_endosado_total";

    try {
        const client = await clientPromise;
        const db = client.db("Data");

        // endoso_id isn't guaranteed unique (users can reuse the same number), so the
        // exact array position must be used to target the right entry — otherwise a
        // positional $ match on endoso_id can silently flip a different, already-anulado
        // entry sharing the same id while this one never gets marked.
        const estadoPath = `endosos.${endosoIndex}.estado`;
        const idPath = `endosos.${endosoIndex}.endoso_id`;

        // 1. Mark the specific endorsement as 'anulado', but only if it isn't already
        const markResult = await db.collection("Polizas").updateOne(
            {
                _id: new ObjectId(polizaId),
                [idPath]: endosoId,
                [estadoPath]: { $ne: "anulado" }
            },
            { $set: { [estadoPath]: "anulado" } }
        );

        if (markResult.matchedCount === 0) {
            return NextResponse.json(
                { error: "Este endoso ya fue anulado o no se encontró." },
                { status: 409 }
            );
        }

        // 2. Subtract the values from the corresponding items
        for (const line of detalle) {
            await db.collection("Polizas").updateOne(
                {
                    _id: new ObjectId(polizaId),
                    "items.item_id": line.item
                },
                {
                    $inc: { [`items.$[i].coberturas.$[c].${targetField}`]: -line.valor }
                },
                {
                    arrayFilters: [
                        { "i.item_id": line.item },
                        { "c.nombre": line.ramo, "c.rubro": line.rubro }
                    ]
                }
            );
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}