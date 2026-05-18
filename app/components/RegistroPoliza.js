'use client';
import { useState } from 'react';
import * as XLSX from 'xlsx';

// Combos that start unchecked — fill in based on business rules.
// Matching is case-insensitive and trims whitespace.
const EXCLUDED_RUBROS = [
"REMOCION DE ESCOMBROS","HONOR. DE ARQUIT., INGENIE. Y TOPOG.","ROTURA DE VIDRIOS Y CRISTALES","HON. DE AUDIT., CONTAD., ABOGAD. Y REVISORES",
"DOCUMENTOS Y MODELOS","GASTOS PARA EXTINGUIR INCENDIO","CLAUSULA ELECTRICA AMPLIA","ACEITES, LUBRICANTES Y REFRIGERANTES",
"GASTOS EXTRAORDINARIOS","TERRORISMO","ARRENDAMIENTOS","PROPIEDAD PERSONAL DE HUESPEDES","EXTINTORES","MATERIALES IMPORTADOS",
"HURTO","FLETE AEREO","HURTO","INTERESES DE CONTRATISTAS","ROTURA DE TANQUES","GASTOS PARA AMINORAR LA PRDIDA","GASTOS ADICIONALES"
];

const EXCLUDED_COBERTURAS = [
    "TERREMOTO","LUCRO CESANTE TERREMOTO"

];

function excelDateToYear(serial) {
    if (!serial || isNaN(serial)) return '';
    if (serial > 1900 && serial < 2200) return serial; // already a year
    const date = new Date((serial - 25569) * 86400 * 1000);
    return date.getUTCFullYear();
}

function parseXls(arrayBuffer) {
    const wb = XLSX.read(arrayBuffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    const headerIdx = allRows.findIndex(r => String(r[0]).trim() === 'Sucursal');
    if (headerIdx === -1) throw new Error('No se encontró la fila de encabezado (Sucursal).');

    // Drop columns whose header cell is empty
    const headerRow = allRows[headerIdx];
    const emptyCols = new Set(
        headerRow.reduce((acc, v, i) => { if (String(v).trim() === '') acc.push(i); return acc; }, [])
    );
    const rows = allRows.map(row => row.filter((_, i) => !emptyCols.has(i)));

    const footerIdx = rows.findIndex(
        (r, i) => i > headerIdx && r.some(c => String(c).includes('Page') || String(c).includes('Página'))
    );
    const endIdx = footerIdx === -1 ? rows.length : footerIdx;

    const dataRows = rows
        .slice(headerIdx + 1, endIdx)
        .filter(r => String(r[0]).trim() !== '');

    if (dataRows.length === 0) throw new Error('No se encontraron filas de datos.');

    return dataRows;
}

export default function RegistroPoliza() {
    const [step, setStep] = useState('upload'); // upload | select | preview | done
    const [parsedRows, setParsedRows] = useState([]);
    const [meta, setMeta] = useState(null);
    const [uniqueCombos, setUniqueCombos] = useState([]);
    const [selectedCombos, setSelectedCombos] = useState(new Set());
    const [previewDoc, setPreviewDoc] = useState(null);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    function handleFile(e) {
        const file = e.target.files[0];
        if (!file) return;
        setError('');
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const rows = parseXls(ev.target.result);
                const first = rows[0];

                const year1 = excelDateToYear(first[4]);
                const year2 = excelDateToYear(first[5]);
                const extractedMeta = {
                    ciudad: String(first[0]).trim(),
                    ramo: String(first[1]).trim(),
                    poliza: String(first[2]).trim(),
                    vigencia: `${year1}-${year2}`,
                };

                const seen = new Set();
                const combos = [];
                for (const row of rows) {
                    const rubro = String(row[10]).trim();
                    const nombre = String(row[12]).trim();
                    const key = `${rubro}||${nombre}`;
                    if (rubro && !seen.has(key)) {
                        seen.add(key);
                        combos.push({ rubro, nombre });
                    }
                }

                setParsedRows(rows);
                setMeta(extractedMeta);
                setUniqueCombos(combos);
                const excRubros = EXCLUDED_RUBROS.map(r => r.trim().toLowerCase());
                const excCobs = EXCLUDED_COBERTURAS.map(c => c.trim().toLowerCase());
                const initialSelected = new Set(
                    combos
                        .filter(c =>
                            !excRubros.includes(c.rubro.toLowerCase()) &&
                            !excCobs.includes(c.nombre.toLowerCase())
                        )
                        .map(c => `${c.rubro}||${c.nombre}`)
                );
                setSelectedCombos(initialSelected);
                setStep('select');
            } catch (err) {
                setError('Error al procesar el archivo: ' + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function toggleCombo(key) {
        setSelectedCombos(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    }

    function buildPreview() {
        const filtered = parsedRows.filter(row => {
            const key = `${String(row[10]).trim()}||${String(row[12]).trim()}`;
            return selectedCombos.has(key);
        });

        const itemMap = new Map();
        for (const row of filtered) {
            const itemId = String(row[6]).trim();
            if (!itemMap.has(itemId)) itemMap.set(itemId, []);
            itemMap.get(itemId).push({
                nombre: String(row[12]).trim(),
                rubro: String(row[10]).trim(),
                valor_asegurado: parseFloat(row[14]) || 0,
                valor_endosado_total: 0,
                movimiento_reciente: 0,
            });
        }

        const items = [...itemMap.entries()].map(([item_id, coberturas]) => ({
            item_id,
            coberturas,
        }));

        setPreviewDoc({ ...meta, items, endosos: [] });
        setStep('preview');
    }

    async function handleSave() {
        setSaving(true);
        setError('');
        try {
            const res = await fetch('/api/data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(previewDoc),
            });
            const json = await res.json();
            if (!res.ok) {
                setError(json.error || 'Error al guardar.');
            } else {
                setStep('done');
            }
        } catch (err) {
            setError('Error de conexión: ' + err.message);
        } finally {
            setSaving(false);
        }
    }

    function reset() {
        setStep('upload');
        setParsedRows([]);
        setMeta(null);
        setUniqueCombos([]);
        setSelectedCombos(new Set());
        setPreviewDoc(null);
        setError('');
    }

    return (
        <div className="py-2">
            {error && (
                <div className="alert alert-danger alert-dismissible">
                    {error}
                    <button className="btn-close" onClick={() => setError('')} />
                </div>
            )}

            {/* ── STEP: upload ──────────────────────────────────────── */}
            {step === 'upload' && (
                <div className="row justify-content-center">
                    <div className="col-md-6 text-center py-4">
                        <h5 className="mb-3">Cargue el reporte de coberturas</h5>
                        <p className="text-muted small mb-4">
                            Suba el archivo <strong>rptconsultacobgen.xls</strong> exportado del sistema.
                        </p>
                        <input
                            type="file"
                            className="form-control"
                            accept=".xls,.xlsx"
                            onChange={handleFile}
                        />
                    </div>
                </div>
            )}

            {/* ── STEP: select rubros ───────────────────────────────── */}
            {step === 'select' && meta && (
                <>
                    <div className="row mb-3">
                        <div className="col">
                            <div className="alert alert-info py-2 mb-0">
                                <strong>{meta.ciudad}</strong> &nbsp;|&nbsp;
                                <strong>{meta.ramo}</strong> &nbsp;|&nbsp;
                                Póliza <strong>{meta.poliza}</strong> &nbsp;|&nbsp;
                                Vigencia <strong>{meta.vigencia}</strong>
                            </div>
                        </div>
                    </div>

                    <p className="fw-semibold mb-2">
                        Seleccione los rubros que aplican para esta póliza:
                    </p>

                    <div className="table-responsive mb-3">
                        <table className="table table-bordered table-hover">
                            <thead className="table-light">
                                <tr>
                                    <th style={{ width: 40 }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedCombos.size === uniqueCombos.length}
                                            onChange={() => {
                                                if (selectedCombos.size === uniqueCombos.length) {
                                                    setSelectedCombos(new Set());
                                                } else {
                                                    setSelectedCombos(new Set(uniqueCombos.map(c => `${c.rubro}||${c.nombre}`)));
                                                }
                                            }}
                                        />
                                    </th>
                                    <th>Rubro</th>
                                    <th>Nombre (Cobertura)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {uniqueCombos.map(c => {
                                    const key = `${c.rubro}||${c.nombre}`;
                                    return (
                                        <tr key={key} className={selectedCombos.has(key) ? '' : 'text-muted'}>
                                            <td className="text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedCombos.has(key)}
                                                    onChange={() => toggleCombo(key)}
                                                />
                                            </td>
                                            <td>{c.rubro}</td>
                                            <td>{c.nombre}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="d-flex gap-2">
                        <button className="btn btn-secondary" onClick={reset}>
                            Volver
                        </button>
                        <button
                            className="btn btn-primary"
                            disabled={selectedCombos.size === 0}
                            onClick={buildPreview}
                        >
                            Continuar
                        </button>
                    </div>
                </>
            )}

            {/* ── STEP: preview ─────────────────────────────────────── */}
            {step === 'preview' && previewDoc && (
                <>
                    <div className="row mb-3">
                        <div className="col">
                            <div className="alert alert-info py-2 mb-0">
                                <strong>{previewDoc.ciudad}</strong> &nbsp;|&nbsp;
                                <strong>{previewDoc.ramo}</strong> &nbsp;|&nbsp;
                                Póliza <strong>{previewDoc.poliza}</strong> &nbsp;|&nbsp;
                                Vigencia <strong>{previewDoc.vigencia}</strong>
                            </div>
                        </div>
                    </div>

                    <p className="fw-semibold mb-2">Revise la póliza antes de confirmar:</p>

                    <div className="table-responsive mb-4">
                        <table className="table table-bordered table-hover">
                            <thead className="table-light">
                                <tr>
                                    <th>Item</th>
                                    <th>Rubro</th>
                                    <th>Cobertura</th>
                                    <th className="text-end">Valor Asegurado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {previewDoc.items.flatMap(item =>
                                    item.coberturas.map((cob, ci) => (
                                        <tr key={`${item.item_id}-${ci}`}>
                                            <td>{item.item_id}</td>
                                            <td>{cob.rubro}</td>
                                            <td>{cob.nombre}</td>
                                            <td className="text-end">
                                                $ {cob.valor_asegurado.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="d-flex gap-2">
                        <button className="btn btn-secondary" onClick={() => setStep('select')}>
                            Volver
                        </button>
                        <button
                            className="btn btn-success px-5"
                            disabled={saving}
                            onClick={handleSave}
                        >
                            {saving ? 'Guardando…' : 'Confirmar y Guardar'}
                        </button>
                    </div>
                </>
            )}

            {/* ── STEP: done ────────────────────────────────────────── */}
            {step === 'done' && (
                <div className="text-center py-5">
                    <div className="display-1 mb-3">✅</div>
                    <h5>Póliza registrada exitosamente</h5>
                    {meta && (
                        <p className="text-muted">
                            {meta.ciudad} / {meta.ramo} / {meta.poliza} / {meta.vigencia}
                        </p>
                    )}
                    <button className="btn btn-primary mt-2" onClick={reset}>
                        Registrar otra póliza
                    </button>
                </div>
            )}
        </div>
    );
}
