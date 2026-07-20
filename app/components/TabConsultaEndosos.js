'use client';
import { useState } from 'react';

export default function TabConsultaEndosos({ currentDoc, tablaData, onRefresh }) {
    const [showModal, setShowModal] = useState(false);
    const [selectedEndoso, setSelectedEndoso] = useState(null);
    const [filterItem, setFilterItem] = useState("TODOS");
    const [filterRubro, setFilterRubro] = useState("TODOS");

    const uniqueItems = ["TODOS", ...new Set(tablaData.map(row => row.itemNum))];

    const prepareHistorial = (doc) => {
        if (!doc?.endosos) return [];
        return doc.endosos.flatMap((e, endosoIndex) =>
            e.detalle.map(d => ({
                ...d,
                endoso_id: e.endoso_id,
                endosoIndex,
                estado: e.estado || "activo",
                fullEndoso: e
            }))
        );
    };

    const allHistorial = prepareHistorial(currentDoc);
    const uniqueRubros = ["TODOS", ...new Set(
        allHistorial
            .filter(d => filterItem === "TODOS" || d.item === filterItem)
            .map(d => d.rubro)
    )];

    const handleFilterItemChange = (e) => {
        setFilterItem(e.target.value);
        setFilterRubro("TODOS");
    };

    const historial = allHistorial.filter(d =>
        (filterItem === "TODOS" || d.item === filterItem) &&
        (filterRubro === "TODOS" || d.rubro === filterRubro)
    );

    const handleAnular = async () => {
        const res = await fetch('/api/endosos', {
            method: 'PATCH',
            body: JSON.stringify({
                polizaId: currentDoc._id,
                endosoId: selectedEndoso.endoso_id,
                endosoIndex: selectedEndoso.endosoIndex,
                detalle: selectedEndoso.fullEndoso.detalle
            })
        });

        if (res.ok) {
            alert("Endoso anulado y valores actualizados.");
            setShowModal(false);
            onRefresh();
        } else {
            const data = await res.json().catch(() => ({}));
            alert(data.error || "No se pudo anular el endoso. Intente nuevamente.");
        }
    };

    if (!currentDoc) {
        return (
            <div className="text-center text-muted py-5">
                <p>Realice una búsqueda para ver el historial de endosos.</p>
            </div>
        );
    }

    return (
        <>
            {/* Filter */}
            <div className="row py-2 mb-3">
                <div className="col-md-4">
                    <label className="fw-bold">Filtrar por Item:</label>
                    <select className="form-select" value={filterItem} onChange={handleFilterItemChange}>
                        {uniqueItems.map(item => (
                            <option key={item} value={item}>
                                {item === "TODOS" ? "Ver todos los items" : `Item ${item}`}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="col-md-4">
                    <label className="fw-bold">Filtrar por Rubro:</label>
                    <select className="form-select" value={filterRubro} onChange={(e) => setFilterRubro(e.target.value)}>
                        {uniqueRubros.map(rubro => (
                            <option key={rubro} value={rubro}>
                                {rubro === "TODOS" ? "Ver todos los rubros" : rubro}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* History table */}
            <div className="table-responsive">
                <table className="table table-bordered table-hover">
                    <thead className="table-light">
                        <tr>
                            <th>Acción</th>
                            <th>Item</th>
                            <th>Endoso ID</th>
                            <th>Ramo</th>
                            <th>Rubro</th>
                            <th className="text-end">Valor</th>
                            <th>Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {historial.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="text-center text-muted py-4">
                                    No hay endosos registrados para esta póliza.
                                </td>
                            </tr>
                        ) : (
                            historial.map((d, idx) => (
                                <tr key={idx} className={d.estado === "anulado" ? "table-danger text-muted" : ""}>
                                    <td>
                                        {d.estado !== "anulado" && (
                                            <button
                                                className="btn btn-danger btn-sm"
                                                onClick={() => { setSelectedEndoso(d); setShowModal(true); }}
                                            >
                                                Anular
                                            </button>
                                        )}
                                    </td>
                                    <td>{d.item}</td>
                                    <td><strong>{d.endoso_id}</strong></td>
                                    <td>{d.ramo}</td>
                                    <td>{d.rubro}</td>
                                    <td className="text-end">$ {d.valor?.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td>
                                        <span className={`badge ${d.estado === "anulado" ? "bg-secondary" : "bg-success"}`}>
                                            {d.estado === "anulado" ? "ANULADO" : "ACTIVO"}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Confirmation modal */}
            {showModal && (
                <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">Confirmar Anulación</h5>
                                <button className="btn-close" onClick={() => setShowModal(false)} />
                            </div>
                            <div className="modal-body">
                                <p>¿Estás seguro de anular el endoso <strong>{selectedEndoso?.endoso_id}</strong>?</p>
                                <p className="text-danger small">
                                    Esta acción restará los valores de todos los items afectados por este endoso.
                                </p>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button className="btn btn-danger" onClick={handleAnular}>Sí, Anular</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
