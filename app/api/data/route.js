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
        const db = client.db("Data");

        if (!ciudad && !ramo && !poliza && !vigencia) {
            const list = await db.collection("Polizas")
                .find({}, { projection: { _id: 1, ciudad: 1, ramo: 1, poliza: 1, vigencia: 1 } })
                .toArray();
            return NextResponse.json(list);
        }

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
    const { ciudad, ramo, poliza, vigencia, items, endosos, coaseguro_cedido, participacion } = body;

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
            ciudad, ramo, poliza, vigencia,
            coaseguro_cedido: coaseguro_cedido ?? false,
            participacion: participacion ?? 100,
            items, endosos: endosos ?? []
        });
        return NextResponse.json({ success: true, _id: result.insertedId });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function PATCH(request) {
    const body = await request.json();
    const { polizaId, updates, numEndoso, tipoMov, detalle } = body;

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

        // Rows the frontend recomputed this session carry their delta in
        // movimiento_reciente (0 for anything untouched), so a sweep across every
        // item/cobertura only picks up what actually changed here.
        const buildDetalleFromMovimientos = () => updates.flatMap(item =>
            item.coberturas.map(cob => ({
                item: item.item_id,
                ramo: cob.nombre,
                rubro: cob.rubro,
                valor: cob.movimiento_reciente
            })).filter(d => d.valor !== 0)
        );

        // 2. Every movement gets recorded in the endoso history, under the
        // "beneficiario" bucket (Endoso beneficiario) or the "movimiento de suma"
        // bucket (inclusiones, aumentos/modificaciones de suma, exclusiones).
        let endosoEntry = null;
        if (tipoMov === "endoso") {
            endosoEntry = { endoso_id: numEndoso, tipo: "beneficiario", detalle: buildDetalleFromMovimientos() };
        } else if (tipoMov === "modificacion") {
            endosoEntry = { endoso_id: numEndoso, tipo: "movimiento de suma", subtipo: "modificacion de suma", detalle: buildDetalleFromMovimientos() };
        } else if (tipoMov === "inclusion") {
            // Inclusion adds brand-new coverages rather than moving an existing one,
            // so TabInclusion sends the exact detalle itself instead of relying on
            // movimiento_reciente (which would also resurface stale values left over
            // on unrelated, already-existing coverages).
            endosoEntry = { endoso_id: numEndoso, tipo: "movimiento de suma", subtipo: "inclusion", detalle: detalle ?? [] };
        }

        if (endosoEntry) {
            updateOps.$push = { endosos: endosoEntry };
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