import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

export async function PATCH(request) {
    const { polizaId, itemIds, numEndoso } = await request.json();

    if (!Array.isArray(itemIds) || itemIds.length === 0 || !numEndoso) {
        return NextResponse.json({ error: "Faltan ítems a excluir o número de endoso." }, { status: 400 });
    }

    try {
        const client = await clientPromise;
        const db = client.db("Data");

        const poliza = await db.collection("Polizas").findOne({ _id: new ObjectId(polizaId) });
        if (!poliza) {
            return NextResponse.json({ error: "Póliza no encontrada." }, { status: 404 });
        }

        const excludedItemIds = new Set(itemIds);

        // Zero out every coverage of the excluded items, recording the reduction
        // in Suma Asegurada as a "modificación de suma" movement.
        const nuevoDetalle = [];
        const updatedItems = poliza.items.map(item => {
            if (!excludedItemIds.has(item.item_id)) return item;

            const updatedCoberturas = item.coberturas.map(cob => {
                if (cob.valor_asegurado !== 0) {
                    nuevoDetalle.push({
                        item: item.item_id,
                        ramo: cob.nombre,
                        rubro: cob.rubro,
                        valor: -cob.valor_asegurado,
                    });
                }
                return {
                    ...cob,
                    valor_asegurado: 0,
                    valor_endosado_total: 0,
                    movimiento_reciente: -cob.valor_asegurado,
                };
            });

            return { ...item, coberturas: updatedCoberturas };
        });

        // Anular every currently active endoso touching an excluded item.
        const updatedEndosos = (poliza.endosos ?? []).map(endoso => {
            const estado = endoso.estado || "activo";
            if (estado === "anulado") return endoso;
            const affectsExcludedItem = endoso.detalle.some(d => excludedItemIds.has(d.item));
            return affectsExcludedItem ? { ...endoso, estado: "anulado" } : endoso;
        });

        updatedEndosos.push({
            endoso_id: numEndoso,
            tipo: "movimiento de suma",
            subtipo: "exclusion",
            estado: "activo",
            detalle: nuevoDetalle,
        });

        await db.collection("Polizas").updateOne(
            { _id: new ObjectId(polizaId) },
            { $set: { items: updatedItems, endosos: updatedEndosos } }
        );

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
