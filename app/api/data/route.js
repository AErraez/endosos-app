import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const ciudad = searchParams.get('ciudad');
    const ramo = searchParams.get('ramo');
    const poliza = searchParams.get('poliza');
    const vigencia = searchParams.get('vigencia');

    try {
        const client = await clientPromise;
        const db = client.db("Data"); // Your DB name
        
        const policy = await db.collection("Polizas").findOne({
            ciudad, ramo, poliza, vigencia
        });

        return NextResponse.json(policy);
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
    }
}

export async function POST(request) {
    const body = await request.json();
    const { ciudad, ramo, poliza, vigencia, items, endosos } = body;

    try {
        const client = await clientPromise;
        const db = client.db("Data");

        const existing = await db.collection("Polizas").findOne({ ciudad, ramo, poliza, vigencia });
        if (existing) {
            return NextResponse.json(
                { error: `Ya existe una póliza: ${ciudad} / ${ramo} / ${poliza} / ${vigencia}` },
                { status: 409 }
            );
        }

        const result = await db.collection("Polizas").insertOne({
            ciudad, ramo, poliza, vigencia, items, endosos: endosos ?? []
        });
        return NextResponse.json({ success: true, _id: result.insertedId });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function PATCH(request) {
    const body = await request.json();
    const { polizaId, updates, numEndoso, tipoMov } = body;

    try {
        const client = await clientPromise;
        const db = client.db("Data");
        const { ObjectId } = require('mongodb');

        // 1. Prepare the update for the 'items' array values
        const updateOps = {
            $set: { 
                "items": updates // Send the fully recalculated items array from frontend
            }
        };

        // 2. If it's an endoso, push to the history array
        if (tipoMov === "endoso") {
            const endosoDetalle = updates.flatMap(item => 
                item.coberturas.map(cob => ({
                    item: item.item_id,
                    ramo: cob.nombre,
                    rubro: cob.rubro,
                    valor: cob.movimiento_reciente // We'll add this field in frontend
                })).filter(d => d.valor !== 0) // Only save if there was a change
            );

            updateOps.$push = {
                endosos: {
                    endoso_id: numEndoso,
                    detalle: endosoDetalle
                }
            };
        }

        await db.collection("Polizas").updateOne(
            { _id: new ObjectId(polizaId) },
            updateOps
        );

        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}