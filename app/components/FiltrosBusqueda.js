'use client';

// ── Edit these arrays to add/remove options ───────────────────────────────────
const SUCURSALES = [
    "QUITO",
    "GUAYAQUIL",
    "ES GUAYAQUIL","ES QUITO"
];

const RAMOS = [
    "MULTIRIESGO INDUSTRIAL", "INCENDIO"
];

const VIGENCIAS = [
    "2026-2027",
    "2025-2026",
];
// ─────────────────────────────────────────────────────────────────────────────

export default function FiltrosBusqueda({ sucursal, setSucursal, ramo, setRamo, poliza, setPoliza, vigencia, setVigencia, onBuscar }) {
    return (
        <div className="row py-3 align-items-end bg-light border rounded mb-3 mx-0">
            <div className="col-md-2">
                <label>Sucursal:</label>
                <select
                    className="form-select text-uppercase"
                    value={sucursal}
                    onChange={(e) => { setSucursal(e.target.value); setRamo(""); setPoliza(""); setVigencia(""); }}
                >
                    <option value="">Seleccione...</option>
                    {SUCURSALES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>
            <div className="col-md-2">
                <label>Ramo:</label>
                <select
                    className="form-select text-uppercase"
                    disabled={!sucursal}
                    value={ramo}
                    onChange={(e) => { setRamo(e.target.value); setPoliza(""); setVigencia(""); }}
                >
                    <option value="">Seleccione...</option>
                    {RAMOS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
            </div>
            <div className="col-md-2">
                <label>Nº Póliza:</label>
                <input
                    type="text"
                    className="form-control"
                    disabled={!ramo}
                    value={poliza}
                    onChange={(e) => { setPoliza(e.target.value); setVigencia(""); }}
                    placeholder="Ej: 51234"
                />
            </div>
            <div className="col-md-3">
                <label>Vigencia:</label>
                <select
                    className="form-select"
                    disabled={!poliza}
                    value={vigencia}
                    onChange={(e) => setVigencia(e.target.value)}
                >
                    <option value="">Seleccione...</option>
                    {VIGENCIAS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
            </div>
            <div className="col-md-3 text-end">
                <button
                    onClick={onBuscar}
                    className="btn btn-secondary w-100"
                    disabled={!sucursal || !ramo || !poliza || !vigencia}
                >
                    Buscar
                </button>
            </div>
        </div>
    );
}
