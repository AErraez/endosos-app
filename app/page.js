'use client'; // Required for interactivity (buttons, inputs, state)
import { useState, useEffect } from 'react';

export default function EndososPage() {
    // 1. STATE MANAGEMENT (Replaces your 'let db' and DOM references)
    const [db, setDb] = useState({
        "QUITO": { "MULTIRIESGO": { "51234": { "2026-2027": {
            "1": { "INCENDIO": { "EDIFICIO": { "valor_asegurado": 20000, "valor_endosado": 5000 }, "MERCADERIA": { "valor_asegurado": 300000, "valor_endosado": 200000 } } },
            "2": { "INCENDIO": { "MERCADERIA": { "valor_asegurado": 500000, "valor_endosado": 0 } } },
            // ... (rest of your items)
        }}}},
        "GUAYAQUIL": { "MULTIRIESGO": { "51234": { "2026-2027": {
            "1": { "INCENDIO": { "EDIFICIO": { "valor_asegurado": 400000, "valor_endosado": 400000 } } },
        }}}}
    });

    // Form States
    const [sucursal, setSucursal] = useState("");
    const [ramo, setRamo] = useState("");
    const [poliza, setPoliza] = useState("");
    const [vigencia, setVigencia] = useState("");
    const [tipoMov, setTipoMov] = useState("endoso");
    const [numEndoso, setNumEndoso] = useState("");
    const [currentDoc, setCurrentDoc] = useState(null); // To store the raw Mongo doc
const [selectedItem, setSelectedItem] = useState("TODOS");

// Reset values when Tipo Movimiento changes
const handleTipoMovChange = (e) => {
        const newTipo = e.target.value;
        setTipoMov(newTipo);
        
        // This ensures the calculations revert to original database values
        const resetData = tablaData.map(row => ({
            ...row,
            movimiento: 0, // Reset input
            vaCalculado: row.vaOriginal, // Revert to DB original
            veCalculado: row.veOriginal, // Revert to DB original
            error: ""
        }));
        setTablaData(resetData);
    };
    // UI Control States
    const [busquedaRealizada, setBusquedaRealizada] = useState(false);
    const [tablaData, setTablaData] = useState([]);

    // 2. LOGIC (Replaces your event listeners)
const handleBuscar = async () => {
        if (!sucursal || !ramo || !poliza || !vigencia) return;
        const res = await fetch(`/api/data?ciudad=${sucursal}&ramo=${ramo}&poliza=${poliza}&vigencia=${vigencia}`);
        const data = await res.json();

        if (data) {
            setCurrentDoc(data);
            const flattened = data.items.flatMap(item => 
                item.coberturas.map(cob => ({
                    itemNum: item.item_id,
                    ramoPolNombre: data.ramo,
                    rubroNombre: cob.rubro,
                    nombreCobertura: cob.nombre, // added for backend ref
                    vaOriginal: cob.valor_asegurado,
                    veOriginal: cob.valor_endosado_total,
                    movimiento: 0,
                    vaCalculado: cob.valor_asegurado,
                    veCalculado: cob.valor_endosado_total,
                    error: ""
                }))
            );
            setSelectedItem("TODOS");
            setTablaData(flattened);
            setBusquedaRealizada(true);
        }
    };


    const handleInputChange = (index, value) => {
        const valMov = parseFloat(value) || 0;
        const newData = [...tablaData];
        const item = newData[index];

        if (tipoMov === 'modificacion') {
            item.vaCalculado = item.vaOriginal + valMov;
            item.error = item.vaCalculado < item.veOriginal ? "Suma Asegurada no puede ser menor a Suma Endosada." : "";
        } else {
            item.veCalculado = item.veOriginal + valMov;
            item.error = (valMov < 0) ? "Valores negativos no permitidos." : 
                         (item.veCalculado > item.vaOriginal) ? "Suma Endosada no puede superar la Asegurada." : "";
        }
        
        item.movimiento = value;
        setTablaData(newData);
    };

// Helper to get unique items for the dropdown
    const uniqueItems = ["TODOS", ...new Set(tablaData.map(row => row.itemNum))];

    // Filter the data based on selection before rendering
    const filteredData = selectedItem === "TODOS" 
        ? tablaData 
        : tablaData.filter(row => row.itemNum === selectedItem);
const handleGuardar = async () => {
        // Build the updated 'items' array for Mongo
        const updatedItems = currentDoc.items.map(item => {
            const updatedCoverages = item.coberturas.map(cob => {
                const row = tablaData.find(r => r.itemNum === item.item_id && r.rubroNombre === cob.rubro);
                return {
                    ...cob,
                    valor_asegurado: row.vaCalculado,
                    valor_endosado_total: row.veCalculado,
                    movimiento_reciente: parseFloat(row.movimiento) || 0
                };
            });
            return { ...item, coberturas: updatedCoverages };
        });

        const res = await fetch('/api/data', {
            method: 'PATCH',
            body: JSON.stringify({
                polizaId: currentDoc._id,
                updates: updatedItems,
                numEndoso: numEndoso,
                tipoMov: tipoMov
            })
        });

        if (res.ok) {
            alert("Guardado exitosamente");
            handleBuscar(); // Refresh data
        }
    };

    const isGuardarDisabled = () => {
        const hasErrors = tablaData.some(row => row.error !== "");
        const hasMovement = tablaData.some(row => row.movimiento !== 0 && row.movimiento !== "");
        return hasErrors || !hasMovement || numEndoso.trim() === "";
    };

    // Inside EndososPage component
const [historialEndosos, setHistorialEndosos] = useState([]);
const [showModal, setShowModal] = useState(false);
const [selectedEndoso, setSelectedEndoso] = useState(null);

// Flatten endosos for the table
const prepareHistorial = (doc) => {
    if (!doc.endosos) return [];
    return doc.endosos.flatMap(e => 
        e.detalle.map(d => ({
            ...d,
            endoso_id: e.endoso_id,
            estado: e.estado || "activo",
            fullEndoso: e // Store full object for anulación logic
        }))
    );
};

const handleAnular = async () => {
    const res = await fetch('/api/endosos', {
        method: 'PATCH',
        body: JSON.stringify({
            polizaId: currentDoc._id,
            endosoId: selectedEndoso.endoso_id,
            detalle: selectedEndoso.fullEndoso.detalle
        })
    });

    if (res.ok) {
        alert("Endoso anulado y valores actualizados.");
        setShowModal(false);
        handleBuscar(); // Refresh everything
    }
};
    // 3. RENDER (Replaces your index.html)
    return (
        <div className="px-3">
            <header className="text-center py-3">
                <h1>Endosos Beneficiarios</h1>
            </header>

            <main className="container-fluid py-3 bg-white shadow rounded">
                {/* Navigation[cite: 1] */}
                <ul className="nav nav-pills app-nav mb-4">
                    <li className="nav-item"><a className="nav-link" href="#">Cláusulas</a></li>
                    <li className="nav-item"><a className="nav-link active" href="#">Endosos Beneficiarios</a></li>
                </ul>

                {/* Filters[cite: 1, 2] */}
                <div className="row py-3 align-items-end bg-light border rounded mb-3 mx-0">
                    <div className="col-md-2">
                        <label>Sucursal:</label>
                        <select className="form-select text-uppercase" value={sucursal} onChange={(e) => setSucursal(e.target.value)}>
                            <option value="">Seleccione...</option>
                            {Object.keys(db).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div className="col-md-2">
                        <label>Ramo:</label>
                        <select className="form-select text-uppercase" disabled={!sucursal} value={ramo} onChange={(e) => setRamo(e.target.value)}>
                            <option value="">Seleccione...</option>
                            {sucursal && Object.keys(db[sucursal]).map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    <div className="col-md-2">
                        <label>Nº Póliza:</label>
                        <input type="text" className="form-control" disabled={!ramo} value={poliza} onChange={(e) => setPoliza(e.target.value)} placeholder="Ej: 51234"/>
                    </div>
                    <div className="col-md-3">
                        <label>Vigencia:</label>
                        <select className="form-select" disabled={!poliza || !db[sucursal]?.[ramo]?.[poliza]} value={vigencia} onChange={(e) => setVigencia(e.target.value)}>
                            <option value="">Seleccione...</option>
                            {poliza && db[sucursal]?.[ramo]?.[poliza] && Object.keys(db[sucursal][ramo][poliza]).map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </div>
                    <div className="col-md-3 text-end">
                        <button onClick={handleBuscar} className="grey-but w-100">Buscar</button>
                    </div>
                </div>

                {/* Table Results[cite: 1, 2] */}
                {busquedaRealizada && (
                    <>
                        <div className="row py-2">
                            <div className="col-md-4">
                                <label className="fw-bold">Tipo de Movimiento:</label>
                                <select className="form-select border-primary" value={tipoMov} onChange={handleTipoMovChange}>
                                    <option value="endoso">Endoso beneficiario</option>
                                    <option value="modificacion">Modificación de suma</option>
                                </select>
                            </div>
                            <div className="col-md-4">
                                <label className="fw-bold">Filtrar por Item:</label>
                                <select 
                                    className="form-select" 
                                    value={selectedItem} 
                                    onChange={(e) => setSelectedItem(e.target.value)}
                                >
                                    {uniqueItems.map(item => (
                                        <option key={item} value={item}>{item === "TODOS" ? "Ver todos los items" : `Item ${item}`}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="row py-3">
                            <div className="col-12 table-container">
                                <table className="table table-bordered table-hover">
                                    <thead className="table-light">
                                        <tr>
                                            <th>Item</th><th>Ramo Pol</th><th>Rubro</th><th>Valor Movimiento</th><th>Valor Asegurado</th><th>Valor Endosado</th>
                                        </tr>
                                    </thead>
<tbody>
                                        {/* Map over filteredData instead of tablaData[cite: 2] */}
                                        {filteredData.map((row) => {
                                            // We need the actual index in tablaData to update the correct row
                                            const originalIndex = tablaData.findIndex(r => r === row);
                                            return (
                                                <tr key={`${row.itemNum}-${row.rubroNombre}`} className={row.error ? 'error-row' : ''}>
                                                    <td className="text-center">{row.itemNum}</td>
                                                    <td>{row.ramoPolNombre}</td>
                                                    <td>{row.rubroNombre}</td>
                                                    <td>
                                                        <input 
                                                            type="number" 
                                                            className="form-control form-control-sm" 
                                                            value={row.movimiento} 
                                                            onChange={(e) => handleInputChange(originalIndex, e.target.value)}
                                                        />
                                                        {row.error && <span className="text-danger error-text">{row.error}</span>}
                                                    </td>
                                                    <td className="text-end">$ {row.vaCalculado.toLocaleString()}</td>
                                                    <td className="text-end">$ {row.veCalculado.toLocaleString()}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="row py-3 align-items-end mt-4 bg-light rounded p-3">
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
                                <button 
                                    className="btn btn-primary px-5" 
                                    disabled={isGuardarDisabled()}
                                    onClick={handleGuardar}
                                >
                                    Guardar Cambios
                                </button>
                            </div>
                        </div>
                        {/* Historial Section */}
<div className="mt-5">
    <h3>Historial de Endosos</h3>
    <div className="table-container bg-white rounded shadow-sm">
        <table className="table table-sm table-hover">
            <thead className="table-dark">
                <tr>
                    <th>Acción</th>
                    <th>Item</th>
                    <th>Endoso ID</th>
                    <th>Ramo</th>
                    <th>Rubro</th>
                    <th>Valor</th>
                    <th>Estado</th>
                </tr>
            </thead>
            <tbody>
                {prepareHistorial(currentDoc)
                    .filter(d => selectedItem === "TODOS" || d.item === selectedItem)
                    .map((d, idx) => (
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
                        <td>$ {d.valor.toLocaleString()}</td>
                        <td>
                            <span className={`badge ${d.estado === "anulado" ? "bg-secondary" : "bg-success"}`}>
                                {d.estado === "anulado" ? "ANULADO" : "ACTIVO"}
                            </span>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
</div>

{/* Modal Simplificado */}
{showModal && (
    <div className="modal d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
        <div className="modal-dialog">
            <div className="modal-content">
                <div className="modal-header"><h5>Confirmar Anulación</h5></div>
                <div className="modal-body">
                    <p>¿Estás seguro de anular el endoso <strong>{selectedEndoso?.endoso_id}</strong>?</p>
                    <p className="text-danger small">Esta acción restará los valores de todos los items afectados por este endoso.</p>
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
                )}
            </main>
        </div>
    );
}