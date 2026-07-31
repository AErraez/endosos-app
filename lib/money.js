// Values persisted to the DB (sumas aseguradas, endosos, participación) must
// never carry more than 2 decimal places, regardless of how many decimals
// user input or intermediate division produced them with.
export function round2(n) {
    if (typeof n !== 'number' || !isFinite(n)) return n;
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function roundDetalle(detalle) {
    return (detalle ?? []).map(d => ({ ...d, valor: round2(d.valor) }));
}

export function roundItems(items) {
    return (items ?? []).map(item => ({
        ...item,
        coberturas: (item.coberturas ?? []).map(cob => ({
            ...cob,
            valor_asegurado: round2(cob.valor_asegurado),
            valor_endosado_total: round2(cob.valor_endosado_total),
            ...(cob.movimiento_reciente !== undefined ? { movimiento_reciente: round2(cob.movimiento_reciente) } : {}),
        })),
    }));
}

export function roundEndosos(endosos) {
    return (endosos ?? []).map(endoso => ({
        ...endoso,
        detalle: roundDetalle(endoso.detalle),
    }));
}
