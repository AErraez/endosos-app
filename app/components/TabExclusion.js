'use client';
import { useState } from 'react';

function countEndososActivos(endosos, itemId) {
    const activeIds = new Set();
    for (const e of endosos ?? []) {
        const estado = e.estado || "activo";
        if (estado === "anulado") continue;
        if (e.detalle.some(d => d.item === itemId)) activeIds.add(e.endoso_id);
    }
    return activeIds.size;
}

function isFullyExcluded(item) {
    return item.coberturas.every(c => c.valor_asegurado === 0);
}

export default function TabExclusion({ currentDoc, onSaved }) {
    const [selectedItems, setSelectedItems] = useState(new Set());
    const [numEndoso, setNumEndoso] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [filterItem, setFilterItem] = useState("TODOS");

    if (!currentDoc) {
        return (
            <div className="text-center text-muted py-5">
                <p>Realice una búsqueda para excluir ítems.</p>
            </div>
        );
    }

    const toggleItem = (itemId) => {
        setSelectedItems(prev => {
            const next = new Set(prev);
            next.has(itemId) ? next.delete(itemId) : next.add(itemId);
            return next;
        });
    };

    const uniqueItems = ["TODOS", ...new Set(currentDoc.items.map(item => item.item_id))];
    const filteredItems = currentDoc.items.filter(
        item => filterItem === "TODOS" || item.item_id === filterItem
    );

    const isConfirmDisabled = saving || selectedItems.size === 0 || numEndoso.trim() === "";

    const handleConfirm = async () => {
        if (isConfirmDisabled) return;
        const itemsList = [...selectedItems].join(', ');
        if (!window.confirm(
            `¿Excluir el/los ítem(s) ${itemsList}? Se pondrán en 0 todos sus valores asegurados y endosados, y se anularán sus endosos activos.`
        )) return;

        setSaving(true);
        setError("");
        try {
            const res = await fetch('/api/exclusion', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    polizaId: currentDoc._id,
                    itemIds: [...selectedItems],
                    numEndoso,
                }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(json.error || "No se pudo excluir. Intente nuevamente.");
            } else {
                setSelectedItems(new Set());
                setNumEndoso("");
                onSaved?.();
            }
        } catch (err) {
            setError("Error de conexión: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="py-2">
            {error && (
                <div className="alert alert-danger alert-dismissible">
                    {error}
                    <button className="btn-close" onClick={() => setError('')} />
                </div>
            )}

            <div className="row py-2 mb-3">
                <div className="col-md-4">
                    <label className="fw-bold">Filtrar por Item:</label>
                    <select className="form-select" value={filterItem} onChange={(e) => setFilterItem(e.target.value)}>
                        {uniqueItems.map(item => (
                            <option key={item} value={item}>
                                {item === "TODOS" ? "Ver todos los items" : `Item ${item}`}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="table-responsive table-container mb-3">
                <table className="table table-bordered table-hover">
                    <thead className="table-light">
                        <tr>
                            <th style={{ width: 120 }}></th>
                            <th>Item</th>
                            <th>Endosos activos</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredItems.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="text-center text-muted py-4">
                                    No hay ítems para este filtro.
                                </td>
                            </tr>
                        ) : filteredItems.map(item => {
                            const excluded = isFullyExcluded(item);
                            const selected = selectedItems.has(item.item_id);
                            return (
                                <tr key={item.item_id} className={selected ? 'table-warning' : excluded ? 'text-muted' : ''}>
                                    <td>
                                        {excluded ? (
                                            <span className="badge bg-secondary">Excluido</span>
                                        ) : (
                                            <button
                                                className="btn btn-danger btn-sm"
                                                onClick={() => toggleItem(item.item_id)}
                                            >
                                                {selected ? '✓ Excluir' : 'Excluir'}
                                            </button>
                                        )}
                                    </td>
                                    <td>Item # {item.item_id}</td>
                                    <td>Endosos activos: {countEndososActivos(currentDoc.endosos, item.item_id)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="row py-3 align-items-end mt-2 bg-light rounded p-3">
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
                <div className="col-md-8 text-end">
                    {selectedItems.size > 0 && (
                        <span className="text-muted small me-3">
                            Ítems a excluir: {[...selectedItems].join(', ')}
                        </span>
                    )}
                    <button
                        className="btn btn-danger px-5"
                        disabled={isConfirmDisabled}
                        onClick={handleConfirm}
                    >
                        {saving ? "Excluyendo…" : "Confirmar Exclusión"}
                    </button>
                </div>
            </div>
        </div>
    );
}
