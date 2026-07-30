'use client';
import { useState } from 'react';
import { EXCLUDED_RUBROS, EXCLUDED_COBERTURAS, excelDateToYear, parseXls } from '@/lib/xlsPoliza';

function mergeItems(existingItems, newItems) {
    const merged = existingItems.map(item => ({ ...item, coberturas: [...item.coberturas] }));
    for (const newItem of newItems) {
        const target = merged.find(i => i.item_id === newItem.item_id);
        if (target) {
            target.coberturas.push(...newItem.coberturas);
        } else {
            merged.push({ ...newItem });
        }
    }
    return merged;
}

export default function TabInclusion({ currentDoc, onSaved }) {
    const [step, setStep] = useState('upload'); // upload | select | preview | done
    const [parsedRows, setParsedRows] = useState([]);
    const [meta, setMeta] = useState(null);
    const [uniqueCombos, setUniqueCombos] = useState([]);
    const [selectedCombos, setSelectedCombos] = useState(new Set());
    const [previewNewItems, setPreviewNewItems] = useState([]);
    const [numEndoso, setNumEndoso] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const metaMismatch = meta && (
        meta.ciudad !== currentDoc.ciudad ||
        meta.ramo !== currentDoc.ramo ||
        meta.poliza !== currentDoc.poliza ||
        meta.vigencia !== currentDoc.vigencia
    );

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

        const shareFraction = (currentDoc.participacion ?? 100) / 100;

        const itemMap = new Map();
        const seen = new Set();
        for (const row of filtered) {
            const itemId = String(row[6]).trim();
            const rubro = String(row[10]).trim();
            const nombre = String(row[12]).trim();
            const dedupKey = `${itemId}||${rubro}||${nombre}`;
            if (seen.has(dedupKey)) continue;
            seen.add(dedupKey);

            // Skip coverages that already exist on this item in the policy
            const existingItem = currentDoc.items.find(i => i.item_id === itemId);
            const alreadyExists = existingItem?.coberturas.some(
                c => c.rubro === rubro && c.nombre === nombre
            );
            if (alreadyExists) continue;

            if (!itemMap.has(itemId)) itemMap.set(itemId, []);
            const rawVA = parseFloat(row[14]);
            itemMap.get(itemId).push({
                nombre,
                rubro,
                valor_asegurado: isNaN(rawVA) ? 0 : rawVA / shareFraction,
                valor_endosado_total: 0,
                movimiento_reciente: 0,
            });
        }

        const newItems = [...itemMap.entries()].map(([item_id, coberturas]) => ({
            item_id,
            coberturas,
        }));

        setPreviewNewItems(newItems);
        setStep('preview');
    }

    async function handleSave() {
        setSaving(true);
        setError('');
        try {
            const mergedItems = mergeItems(currentDoc.items, previewNewItems);
            const detalle = previewNewItems.flatMap(item =>
                item.coberturas.map(cob => ({
                    item: item.item_id,
                    ramo: cob.nombre,
                    rubro: cob.rubro,
                    valor: cob.valor_asegurado,
                }))
            );
            const res = await fetch('/api/data', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    polizaId: currentDoc._id,
                    updates: mergedItems,
                    numEndoso,
                    tipoMov: 'inclusion',
                    detalle,
                }),
            });
            const json = await res.json();
            if (!res.ok) {
                setError(json.error || 'Error al guardar.');
            } else {
                setStep('done');
                onSaved?.();
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
        setPreviewNewItems([]);
        setNumEndoso('');
        setError('');
    }

    const totalNewCoberturas = previewNewItems.reduce((sum, i) => sum + i.coberturas.length, 0);

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
                        <h5 className="mb-3">Cargue el reporte de coberturas a incluir</h5>
                        <p className="text-muted small mb-4">
                            Suba el archivo <strong>rptconsultacobgen.xls</strong> con los ítems/coberturas
                            a agregar a la póliza <strong>{currentDoc.poliza}</strong>.
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
                            {metaMismatch && (
                                <div className="alert alert-warning py-2 mb-0 mt-2">
                                    ⚠️ El archivo cargado corresponde a una póliza distinta a la que está
                                    gestionando (<strong>{currentDoc.ciudad} / {currentDoc.ramo} / {currentDoc.poliza} / {currentDoc.vigencia}</strong>).
                                    Verifique antes de continuar.
                                </div>
                            )}
                            {currentDoc.coaseguro_cedido && (
                                <div className="alert alert-secondary py-2 mb-0 mt-2">
                                    ℹ️ Esta póliza es de coaseguro cedido con una participación del{' '}
                                    <strong>{currentDoc.participacion}%</strong>. Los valores asegurados del
                                    archivo se dividirán automáticamente por este porcentaje al incluirse.
                                </div>
                            )}
                        </div>
                    </div>

                    <p className="fw-semibold mb-2">
                        Seleccione los rubros a incluir en esta póliza:
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
            {step === 'preview' && (
                <>
                    <div className="row mb-3">
                        <div className="col">
                            <div className="alert alert-info py-2 mb-0">
                                Se incluirán <strong>{totalNewCoberturas}</strong> coberturas nuevas en{' '}
                                <strong>{previewNewItems.length}</strong> ítem(s) de la póliza{' '}
                                <strong>{currentDoc.poliza}</strong>.
                            </div>
                        </div>
                    </div>

                    {totalNewCoberturas === 0 ? (
                        <p className="text-muted text-center py-4">
                            Todas las coberturas seleccionadas ya existen en esta póliza. No hay nada nuevo para incluir.
                        </p>
                    ) : (
                        <>
                            <p className="fw-semibold mb-2">Revise las coberturas a incluir:</p>

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
                                        {previewNewItems.flatMap(item =>
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
                        </>
                    )}

                    {totalNewCoberturas > 0 && (
                        <div className="row py-3 align-items-end mb-2 bg-light rounded p-3">
                            <div className="col-md-4">
                                <label className="fw-bold">Número de Endoso:</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={numEndoso}
                                    onChange={(e) => setNumEndoso(e.target.value)}
                                    placeholder="Ej: END-103"
                                />
                            </div>
                        </div>
                    )}

                    <div className="d-flex gap-2">
                        <button className="btn btn-secondary" onClick={() => setStep('select')}>
                            Volver
                        </button>
                        <button
                            className="btn btn-success px-5"
                            disabled={saving || totalNewCoberturas === 0 || numEndoso.trim() === ''}
                            onClick={handleSave}
                        >
                            {saving ? 'Guardando…' : 'Confirmar e Incluir'}
                        </button>
                    </div>
                </>
            )}

            {/* ── STEP: done ────────────────────────────────────────── */}
            {step === 'done' && (
                <div className="text-center py-5">
                    <div className="display-1 mb-3">✅</div>
                    <h5>Coberturas incluidas exitosamente</h5>
                    <p className="text-muted">
                        {currentDoc.ciudad} / {currentDoc.ramo} / {currentDoc.poliza} / {currentDoc.vigencia}
                    </p>
                    <button className="btn btn-primary mt-2" onClick={reset}>
                        Incluir otro archivo
                    </button>
                </div>
            )}
        </div>
    );
}
