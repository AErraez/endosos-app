'use client';
import { useState } from 'react';
import FiltrosBusqueda from './FiltrosBusqueda';
import { EXCLUDED_RUBROS, EXCLUDED_COBERTURAS, excelDateToYear, parseXls } from '@/lib/xlsPoliza';

const SUBTIPOS = [
    { value: 'inclusion', label: 'Inclusión' },
    { value: 'modificacion de suma', label: 'Modificación de suma (aumento)' },
    { value: 'exclusion', label: 'Exclusión' },
];

function emptyRow() {
    return { item_id: '', comboKey: '', valor: '' };
}

export default function RegistroManual() {
    const [currentDoc, setCurrentDoc] = useState(null);
    const [loadingDoc, setLoadingDoc] = useState(false);

    const [mode, setMode] = useState('endoso'); // endoso | editar

    const [tipo, setTipo] = useState('movimiento de suma');
    const [subtipo, setSubtipo] = useState('inclusion');
    const [endosoId, setEndosoId] = useState('');
    const [estado, setEstado] = useState('activo');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // ── Direct valor asegurado editor ────────────────────────────────────
    const [editValues, setEditValues] = useState({});
    const [filterItemEdit, setFilterItemEdit] = useState('TODOS');

    // ── Manual row entry (beneficiario / modificación de suma / exclusión) ──
    const [rows, setRows] = useState([emptyRow()]);

    // ── File-driven inclusion flow (mirrors TabInclusion) ───────────────────
    const [inclusionStep, setInclusionStep] = useState('upload'); // upload | select | preview
    const [parsedRows, setParsedRows] = useState([]);
    const [fileMeta, setFileMeta] = useState(null);
    const [uniqueCombos, setUniqueCombos] = useState([]);
    const [selectedCombos, setSelectedCombos] = useState(new Set());
    const [previewItems, setPreviewItems] = useState([]);

    const isInclusion = tipo === 'movimiento de suma' && subtipo === 'inclusion';

    const resetAllFlows = () => {
        setRows([emptyRow()]);
        setInclusionStep('upload');
        setParsedRows([]);
        setFileMeta(null);
        setUniqueCombos([]);
        setSelectedCombos(new Set());
        setPreviewItems([]);
    };

    const handleSelectPoliza = async (p) => {
        setLoadingDoc(true);
        setError('');
        setSuccess('');
        try {
            const res = await fetch(
                `/api/data?ciudad=${encodeURIComponent(p.ciudad)}&ramo=${encodeURIComponent(p.ramo)}&poliza=${encodeURIComponent(p.poliza)}&vigencia=${encodeURIComponent(p.vigencia)}`
            );
            const data = await res.json();
            if (!res.ok || !data?.items) {
                setError('No se pudo cargar la póliza.');
                setCurrentDoc(null);
            } else {
                setCurrentDoc(data);
                resetAllFlows();
                setEditValues({});
                setFilterItemEdit('TODOS');
            }
        } catch (err) {
            setError('Error de conexión: ' + err.message);
        } finally {
            setLoadingDoc(false);
        }
    };

    const handleTipoChange = (value) => {
        setTipo(value);
        resetAllFlows();
    };

    const handleSubtipoChange = (value) => {
        setSubtipo(value);
        resetAllFlows();
    };

    // ── Manual rows helpers ──────────────────────────────────────────────
    const updateRow = (idx, field, value) => {
        setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
    };
    const addRow = () => setRows(prev => [...prev, emptyRow()]);
    const removeRow = (idx) => setRows(prev => prev.filter((_, i) => i !== idx));

    const rowsValid = rows.length > 0 && rows.every(r => r.item_id && r.comboKey && r.valor !== '' && !isNaN(parseFloat(r.valor)));

    const handleSubmitManual = async () => {
        const detalle = rows.map(r => {
            const [rubro, nombre] = r.comboKey.split('||');
            return { item: r.item_id, ramo: nombre, rubro, valor: parseFloat(r.valor) };
        });
        await submitEndoso(detalle);
    };

    // ── Direct valor asegurado editor helpers ───────────────────────────
    const cobKey = (itemId, rubro, nombre) => `${itemId}||${rubro}||${nombre}`;

    const updateEditValue = (key, value) => {
        setEditValues(prev => ({ ...prev, [key]: value }));
    };

    const buildEditedItems = () => currentDoc.items.map(item => ({
        ...item,
        coberturas: item.coberturas.map(cob => {
            const key = cobKey(item.item_id, cob.rubro, cob.nombre);
            const edited = editValues[key];
            const valor_asegurado = edited !== undefined && edited !== '' && !isNaN(parseFloat(edited))
                ? parseFloat(edited)
                : cob.valor_asegurado;
            return { ...cob, valor_asegurado };
        }),
    }));

    const changedRows = Object.entries(editValues).filter(([key, val]) => {
        if (val === '' || isNaN(parseFloat(val))) return false;
        const [itemId, rubro, nombre] = key.split('||');
        const cob = currentDoc.items.find(i => i.item_id === itemId)?.coberturas.find(c => c.rubro === rubro && c.nombre === nombre);
        return cob && parseFloat(val) !== cob.valor_asegurado;
    });

    const isSaveEditsDisabled = saving || changedRows.length === 0;

    const handleSaveEdits = async () => {
        if (isSaveEditsDisabled) return;
        if (!window.confirm(
            `¿Guardar ${changedRows.length} cambio(s) de valor asegurado? Esto sobrescribe los valores directamente y no queda registrado en el historial de endosos.`
        )) return;

        const updatedItems = buildEditedItems();

        setSaving(true);
        setError('');
        setSuccess('');
        try {
            const res = await fetch('/api/data', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ polizaId: currentDoc._id, updates: updatedItems }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(json.error || 'No se pudo guardar los cambios.');
            } else {
                setCurrentDoc({ ...currentDoc, items: updatedItems });
                setEditValues({});
                setSuccess(`${changedRows.length} valor(es) asegurado(s) actualizado(s).`);
            }
        } catch (err) {
            setError('Error de conexión: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    // ── File-driven inclusion helpers ───────────────────────────────────
    const metaMismatch = fileMeta && currentDoc && (
        fileMeta.ciudad !== currentDoc.ciudad ||
        fileMeta.ramo !== currentDoc.ramo ||
        fileMeta.poliza !== currentDoc.poliza ||
        fileMeta.vigencia !== currentDoc.vigencia
    );

    function handleFile(e) {
        const file = e.target.files[0];
        if (!file) return;
        setError('');
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const rowsData = parseXls(ev.target.result);
                const first = rowsData[0];

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
                for (const row of rowsData) {
                    const rubro = String(row[10]).trim();
                    const nombre = String(row[12]).trim();
                    const key = `${rubro}||${nombre}`;
                    if (rubro && !seen.has(key)) {
                        seen.add(key);
                        combos.push({ rubro, nombre });
                    }
                }

                setParsedRows(rowsData);
                setFileMeta(extractedMeta);
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
                setInclusionStep('select');
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

    function buildInclusionPreview() {
        const filtered = parsedRows.filter(row => {
            const key = `${String(row[10]).trim()}||${String(row[12]).trim()}`;
            return selectedCombos.has(key);
        });

        const shareFraction = currentDoc.coaseguro_cedido ? (currentDoc.participacion ?? 100) / 100 : 1;

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
            });
        }

        const items = [...itemMap.entries()].map(([item_id, coberturas]) => ({ item_id, coberturas }));
        setPreviewItems(items);
        setInclusionStep('preview');
    }

    const totalPreviewCoberturas = previewItems.reduce((sum, i) => sum + i.coberturas.length, 0);

    const handleSubmitInclusion = async () => {
        const detalle = previewItems.flatMap(item =>
            item.coberturas.map(cob => ({ item: item.item_id, ramo: cob.nombre, rubro: cob.rubro, valor: cob.valor_asegurado }))
        );
        await submitEndoso(detalle);
    };

    // ── Shared submit ────────────────────────────────────────────────────
    const submitEndoso = async (detalle) => {
        if (!window.confirm(
            `¿Registrar el endoso ${endosoId} (${tipo === 'beneficiario' ? 'beneficiario' : subtipo}) con ${detalle.length} línea(s)? Esto solo añade el registro al historial; no modifica los valores asegurados actuales.`
        )) return;

        setSaving(true);
        setError('');
        setSuccess('');
        try {
            const res = await fetch('/api/registro-manual', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    polizaId: currentDoc._id,
                    endoso_id: endosoId,
                    tipo,
                    subtipo: tipo === 'movimiento de suma' ? subtipo : undefined,
                    estado,
                    detalle,
                }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(json.error || 'No se pudo registrar el endoso.');
            } else {
                setSuccess(`Endoso ${endosoId} registrado en el historial.`);
                setEndosoId('');
                resetAllFlows();
            }
        } catch (err) {
            setError('Error de conexión: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const isManualSubmitDisabled = saving || !currentDoc || endosoId.trim() === '' || !rowsValid;
    const isInclusionSubmitDisabled = saving || !currentDoc || endosoId.trim() === '' || totalPreviewCoberturas === 0;

    return (
        <div className="px-3">
            <header className="text-center py-3">
                <h1>Registro Manual de Endosos</h1>
                <p className="text-muted mb-0">
                    Herramienta interna para registrar en el historial endosos ya aplicados anteriormente
                    (los valores asegurados actuales no se modifican).
                </p>
            </header>

            <main className="container-fluid py-3 bg-white shadow rounded">
                <FiltrosBusqueda onSelectPoliza={handleSelectPoliza} />

                {loadingDoc && <p className="text-muted text-center py-3">Cargando póliza…</p>}

                {error && (
                    <div className="alert alert-danger alert-dismissible">
                        {error}
                        <button className="btn-close" onClick={() => setError('')} />
                    </div>
                )}
                {success && (
                    <div className="alert alert-success alert-dismissible">
                        {success}
                        <button className="btn-close" onClick={() => setSuccess('')} />
                    </div>
                )}

                {currentDoc && !loadingDoc && (
                    <div className="border rounded p-3">
                        <div className="alert alert-info py-2 mb-3">
                            <strong>{currentDoc.ciudad}</strong> &nbsp;|&nbsp;
                            <strong>{currentDoc.ramo}</strong> &nbsp;|&nbsp;
                            Póliza <strong>{currentDoc.poliza}</strong> &nbsp;|&nbsp;
                            Vigencia <strong>{currentDoc.vigencia}</strong>
                        </div>

                        <ul className="nav nav-pills mb-3">
                            <li className="nav-item">
                                <button
                                    className={`nav-link ${mode === 'endoso' ? 'active fw-semibold' : ''}`}
                                    onClick={() => setMode('endoso')}
                                >
                                    Registrar Endoso Histórico
                                </button>
                            </li>
                            <li className="nav-item">
                                <button
                                    className={`nav-link ${mode === 'editar' ? 'active fw-semibold' : ''}`}
                                    onClick={() => setMode('editar')}
                                >
                                    Editar Valores Asegurados
                                </button>
                            </li>
                        </ul>

                        {mode === 'editar' && (
                            <>
                                <div className="alert alert-warning py-2 mb-3">
                                    ⚠️ Esto sobrescribe el valor asegurado directamente en la póliza. No queda
                                    registrado ningún endoso en el historial.
                                </div>

                                <div className="row py-2 mb-3">
                                    <div className="col-md-4">
                                        <label className="fw-bold">Filtrar por Item:</label>
                                        <select
                                            className="form-select"
                                            value={filterItemEdit}
                                            onChange={(e) => setFilterItemEdit(e.target.value)}
                                        >
                                            <option value="TODOS">Ver todos los items</option>
                                            {currentDoc.items.map(i => (
                                                <option key={i.item_id} value={i.item_id}>Item {i.item_id}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="table-responsive table-container mb-3">
                                    <table className="table table-bordered table-hover">
                                        <thead className="table-light">
                                            <tr>
                                                <th>Item</th>
                                                <th>Rubro</th>
                                                <th>Cobertura</th>
                                                <th className="text-end">Valor Asegurado Actual</th>
                                                <th style={{ width: 220 }}>Nuevo Valor Asegurado</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentDoc.items
                                                .filter(item => filterItemEdit === 'TODOS' || item.item_id === filterItemEdit)
                                                .flatMap(item => item.coberturas.map((cob, ci) => {
                                                    const key = cobKey(item.item_id, cob.rubro, cob.nombre);
                                                    const value = editValues[key] ?? String(cob.valor_asegurado);
                                                    const isChanged = changedRows.some(([k]) => k === key);
                                                    return (
                                                        <tr key={`${item.item_id}-${ci}`} className={isChanged ? 'table-warning' : ''}>
                                                            <td>{item.item_id}</td>
                                                            <td>{cob.rubro}</td>
                                                            <td>{cob.nombre}</td>
                                                            <td className="text-end">
                                                                $ {cob.valor_asegurado.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </td>
                                                            <td>
                                                                <input
                                                                    type="number"
                                                                    className="form-control"
                                                                    value={value}
                                                                    onChange={(e) => updateEditValue(key, e.target.value)}
                                                                />
                                                            </td>
                                                        </tr>
                                                    );
                                                }))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="d-flex justify-content-end">
                                    <button
                                        className="btn btn-danger px-5"
                                        disabled={isSaveEditsDisabled}
                                        onClick={handleSaveEdits}
                                    >
                                        {saving ? 'Guardando…' : `Guardar Cambios${changedRows.length > 0 ? ` (${changedRows.length})` : ''}`}
                                    </button>
                                </div>
                            </>
                        )}

                        {mode === 'endoso' && (
                        <>
                        <div className="row g-3 mb-3">
                            <div className="col-md-3">
                                <label className="fw-bold">Tipo:</label>
                                <select className="form-select" value={tipo} onChange={(e) => handleTipoChange(e.target.value)}>
                                    <option value="beneficiario">Beneficiario</option>
                                    <option value="movimiento de suma">Movimiento de suma</option>
                                </select>
                            </div>
                            {tipo === 'movimiento de suma' && (
                                <div className="col-md-3">
                                    <label className="fw-bold">Subtipo:</label>
                                    <select className="form-select" value={subtipo} onChange={(e) => handleSubtipoChange(e.target.value)}>
                                        {SUBTIPOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                </div>
                            )}
                            <div className="col-md-3">
                                <label className="fw-bold">Número de Endoso:</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={endosoId}
                                    onChange={(e) => setEndosoId(e.target.value)}
                                    placeholder="Ej: END-103"
                                />
                            </div>
                            <div className="col-md-3">
                                <label className="fw-bold">Estado:</label>
                                <select className="form-select" value={estado} onChange={(e) => setEstado(e.target.value)}>
                                    <option value="activo">Activo</option>
                                    <option value="anulado">Anulado</option>
                                </select>
                            </div>
                        </div>

                        {isInclusion ? (
                            <>
                                {/* ── STEP: upload ─────────────────────────────── */}
                                {inclusionStep === 'upload' && (
                                    <div className="row justify-content-center">
                                        <div className="col-md-6 text-center py-4">
                                            <h5 className="mb-3">Cargue el reporte de coberturas a registrar</h5>
                                            <p className="text-muted small mb-4">
                                                Suba el mismo archivo <strong>rptconsultacobgen.xls</strong> que se usó para
                                                la inclusión original.
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

                                {/* ── STEP: select rubros ──────────────────────── */}
                                {inclusionStep === 'select' && fileMeta && (
                                    <>
                                        <div className="row mb-3">
                                            <div className="col">
                                                <div className="alert alert-info py-2 mb-0">
                                                    <strong>{fileMeta.ciudad}</strong> &nbsp;|&nbsp;
                                                    <strong>{fileMeta.ramo}</strong> &nbsp;|&nbsp;
                                                    Póliza <strong>{fileMeta.poliza}</strong> &nbsp;|&nbsp;
                                                    Vigencia <strong>{fileMeta.vigencia}</strong>
                                                </div>
                                                {metaMismatch && (
                                                    <div className="alert alert-warning py-2 mb-0 mt-2">
                                                        ⚠️ El archivo cargado corresponde a una póliza distinta a la seleccionada.
                                                        Verifique antes de continuar.
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <p className="fw-semibold mb-2">Seleccione los rubros a registrar:</p>

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
                                            <button className="btn btn-secondary" onClick={resetAllFlows}>
                                                Volver
                                            </button>
                                            <button
                                                className="btn btn-primary"
                                                disabled={selectedCombos.size === 0}
                                                onClick={buildInclusionPreview}
                                            >
                                                Continuar
                                            </button>
                                        </div>
                                    </>
                                )}

                                {/* ── STEP: preview ─────────────────────────────── */}
                                {inclusionStep === 'preview' && (
                                    <>
                                        <div className="alert alert-info py-2 mb-3">
                                            Se registrarán <strong>{totalPreviewCoberturas}</strong> coberturas en{' '}
                                            <strong>{previewItems.length}</strong> ítem(s). Los valores asegurados actuales
                                            de la póliza no se modificarán.
                                        </div>

                                        {totalPreviewCoberturas === 0 ? (
                                            <p className="text-muted text-center py-4">
                                                No hay coberturas seleccionadas.
                                            </p>
                                        ) : (
                                            <div className="table-responsive mb-3">
                                                <table className="table table-bordered table-hover">
                                                    <thead className="table-light">
                                                        <tr>
                                                            <th>Item</th>
                                                            <th>Rubro</th>
                                                            <th>Cobertura</th>
                                                            <th className="text-end">Valor Asegurado</th>
                                                            <th>En póliza actual</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {previewItems.flatMap(item =>
                                                            item.coberturas.map((cob, ci) => {
                                                                const existingItem = currentDoc.items.find(i => i.item_id === item.item_id);
                                                                const yaExiste = existingItem?.coberturas.some(
                                                                    c => c.rubro === cob.rubro && c.nombre === cob.nombre
                                                                );
                                                                return (
                                                                    <tr key={`${item.item_id}-${ci}`}>
                                                                        <td>{item.item_id}</td>
                                                                        <td>{cob.rubro}</td>
                                                                        <td>{cob.nombre}</td>
                                                                        <td className="text-end">
                                                                            $ {cob.valor_asegurado.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                        </td>
                                                                        <td>
                                                                            <span className={`badge ${yaExiste ? 'bg-success' : 'bg-warning text-dark'}`}>
                                                                                {yaExiste ? 'Ya existe' : 'No existe'}
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}

                                        <div className="d-flex gap-2">
                                            <button className="btn btn-secondary" onClick={() => setInclusionStep('select')}>
                                                Volver
                                            </button>
                                            <button
                                                className="btn btn-primary px-5"
                                                disabled={isInclusionSubmitDisabled}
                                                onClick={handleSubmitInclusion}
                                            >
                                                {saving ? 'Guardando…' : 'Registrar Endoso'}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </>
                        ) : (
                            <>
                                <p className="fw-semibold mb-2">Líneas del endoso:</p>
                                <div className="table-responsive mb-2">
                                    <table className="table table-bordered">
                                        <thead className="table-light">
                                            <tr>
                                                <th style={{ width: 160 }}>Item</th>
                                                <th>Rubro / Cobertura</th>
                                                <th style={{ width: 200 }}>Valor</th>
                                                <th style={{ width: 60 }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rows.map((row, idx) => {
                                                const itemCoberturas = currentDoc.items.find(i => i.item_id === row.item_id)?.coberturas ?? [];
                                                return (
                                                    <tr key={idx}>
                                                        <td>
                                                            <select
                                                                className="form-select"
                                                                value={row.item_id}
                                                                onChange={(e) => updateRow(idx, 'item_id', e.target.value)}
                                                            >
                                                                <option value="">Seleccione…</option>
                                                                {currentDoc.items.map(i => (
                                                                    <option key={i.item_id} value={i.item_id}>Item {i.item_id}</option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td>
                                                            <select
                                                                className="form-select"
                                                                value={row.comboKey}
                                                                disabled={!row.item_id}
                                                                onChange={(e) => updateRow(idx, 'comboKey', e.target.value)}
                                                            >
                                                                <option value="">Seleccione…</option>
                                                                {itemCoberturas.map((c, ci) => (
                                                                    <option key={ci} value={`${c.rubro}||${c.nombre}`}>
                                                                        {c.rubro} — {c.nombre}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="number"
                                                                className="form-control"
                                                                value={row.valor}
                                                                onChange={(e) => updateRow(idx, 'valor', e.target.value)}
                                                                placeholder="0.00"
                                                            />
                                                        </td>
                                                        <td className="text-center">
                                                            <button
                                                                className="btn btn-outline-danger btn-sm"
                                                                disabled={rows.length === 1}
                                                                onClick={() => removeRow(idx)}
                                                            >
                                                                ×
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="d-flex justify-content-between">
                                    <button className="btn btn-outline-secondary btn-sm" onClick={addRow}>
                                        + Agregar línea
                                    </button>
                                    <button
                                        className="btn btn-primary px-5"
                                        disabled={isManualSubmitDisabled}
                                        onClick={handleSubmitManual}
                                    >
                                        {saving ? 'Guardando…' : 'Registrar Endoso'}
                                    </button>
                                </div>
                            </>
                        )}
                        </>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
