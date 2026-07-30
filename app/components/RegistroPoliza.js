'use client';
import { useState } from 'react';
import { EXCLUDED_RUBROS, EXCLUDED_COBERTURAS, excelDateToYear, parseXls } from '@/lib/xlsPoliza';

export default function RegistroPoliza() {
    const [step, setStep] = useState('upload'); // upload | select | preview | done
    const [parsedRows, setParsedRows] = useState([]);
    const [meta, setMeta] = useState(null);
    const [uniqueCombos, setUniqueCombos] = useState([]);
    const [selectedCombos, setSelectedCombos] = useState(new Set());
    const [previewDoc, setPreviewDoc] = useState(null);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [coaseguroCedido, setCoaseguroCedido] = useState(null); // null | true | false
    const [participacion, setParticipacion] = useState('');

    const participacionNum = parseFloat(participacion);
    const participacionValid = !isNaN(participacionNum) && participacionNum > 0 && participacionNum <= 100;
    const coaseguroAnswered = coaseguroCedido === false || (coaseguroCedido === true && participacionValid);

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

        const shareFraction = coaseguroCedido ? participacionNum / 100 : 1;

        const itemMap = new Map();
        const seen = new Set();
        for (const row of filtered) {
            const itemId = String(row[6]).trim();
            const rubro = String(row[10]).trim();
            const nombre = String(row[12]).trim();
            const dedupKey = `${itemId}||${rubro}||${nombre}`;
            if (seen.has(dedupKey)) continue;
            seen.add(dedupKey);
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

        const items = [...itemMap.entries()].map(([item_id, coberturas]) => ({
            item_id,
            coberturas,
        }));

        setPreviewDoc({
            ...meta,
            coaseguro_cedido: coaseguroCedido,
            participacion: coaseguroCedido ? participacionNum : 100,
            items,
            endosos: [],
        });
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
        setCoaseguroCedido(null);
        setParticipacion('');
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

                    <div className="row mb-3">
                        <div className="col-md-6">
                            <p className="fw-semibold mb-2">¿Es coaseguro cedido?</p>
                            <div className="d-flex gap-3 mb-2">
                                <div className="form-check">
                                    <input
                                        type="radio"
                                        className="form-check-input"
                                        id="coaseguroNo"
                                        name="coaseguroCedido"
                                        checked={coaseguroCedido === false}
                                        onChange={() => setCoaseguroCedido(false)}
                                    />
                                    <label className="form-check-label" htmlFor="coaseguroNo">No</label>
                                </div>
                                <div className="form-check">
                                    <input
                                        type="radio"
                                        className="form-check-input"
                                        id="coaseguroSi"
                                        name="coaseguroCedido"
                                        checked={coaseguroCedido === true}
                                        onChange={() => setCoaseguroCedido(true)}
                                    />
                                    <label className="form-check-label" htmlFor="coaseguroSi">Sí</label>
                                </div>
                            </div>
                            {coaseguroCedido === true && (
                                <div className="mb-2" style={{ maxWidth: 220 }}>
                                    <label className="form-label small mb-1">Participación (%)</label>
                                    <input
                                        type="number"
                                        className="form-control"
                                        min="0"
                                        max="100"
                                        step="0.01"
                                        value={participacion}
                                        onChange={(e) => setParticipacion(e.target.value)}
                                        placeholder="Ej. 40"
                                    />
                                    {!participacionValid && participacion !== '' && (
                                        <div className="form-text text-danger">
                                            Ingrese un porcentaje mayor a 0 y hasta 100.
                                        </div>
                                    )}
                                </div>
                            )}
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
                            disabled={selectedCombos.size === 0 || coaseguroCedido === null || !coaseguroAnswered}
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
                                {previewDoc.coaseguro_cedido && (
                                    <>
                                        &nbsp;|&nbsp; Coaseguro cedido <strong>Sí</strong> (Participación{' '}
                                        <strong>{previewDoc.participacion}%</strong>)
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <p className="fw-semibold mb-2">Revise la póliza antes de confirmar (valores ya normalizados al 100%):</p>

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
