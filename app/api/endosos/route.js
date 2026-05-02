import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

export async function PATCH(request) {
    const { polizaId, endosoId, detalle } = await request.json();

    try {
        const client = await clientPromise;
        const db = client.db("Data");

        // 1. Mark the specific endorsement as 'anulado'
        await db.collection("Polizas").updateOne(
            { _id: new ObjectId(polizaId), "endosos.endoso_id": endosoId },
            { $set: { "endosos.$.estado": "anulado" } }
        );

        // 2. Subtract the values from the corresponding items
        for (const line of detalle) {
            await db.collection("Polizas").updateOne(
                { 
                    _id: new ObjectId(polizaId),
                    "items.item_id": line.item
                },
                { 
                    $inc: { "items.$[i].coberturas.$[c].valor_endosado_total": -line.valor } 
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