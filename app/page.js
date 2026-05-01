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

    // UI Control States
    const [busquedaRealizada, setBusquedaRealizada] = useState(false);
    const [tablaData, setTablaData] = useState([]);

    // 2. LOGIC (Replaces your event listeners)
    const handleBuscar = () => {
        if (!sucursal || !ramo || !poliza || !vigencia) {
            alert("Por favor complete todos los filtros.");
            return;
        }

        const items = db[sucursal][ramo][poliza][vigencia];
        const flatItems = [];

        // Flattening the nested structure for the table
        for (const [itemNum, ramosPol] of Object.entries(items)) {
            for (const [ramoPolNombre, rubros] of Object.entries(ramosPol)) {
                for (const [rubroNombre, valores] of Object.entries(rubros)) {
                    flatItems.push({
                        itemNum, ramoPolNombre, rubroNombre,
                        vaOriginal: valores.valor_asegurado,
                        veOriginal: valores.valor_endosado,
                        movimiento: 0,
                        vaCalculado: valores.valor_asegurado,
                        veCalculado: valores.valor_endosado,
                        error: ""
                    });
                }
            }
        }
        setTablaData(flatItems);
        setBusquedaRealizada(true);
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
                                <select className="form-select border-primary" value={tipoMov} onChange={(e) => setTipoMov(e.target.value)}>
                                    <option value="endoso">Endoso beneficiario</option>
                                    <option value="modificacion">Modificación de suma</option>
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
                                        {tablaData.map((row, idx) => (
                                            <tr key={idx} className={row.error ? 'error-row' : ''}>
                                                <td className="text-center">{row.itemNum}</td>
                                                <td>{row.ramoPolNombre}</td>
                                                <td>{row.rubroNombre}</td>
                                                <td>
                                                    <input type="number" className="form-control form-control-sm" value={row.movimiento} onChange={(e) => handleInputChange(idx, e.target.value)}/>
                                                    {row.error && <span className="error-text">{row.error}</span>}
                                                </td>
                                                <td className="text-end">$ {row.vaCalculado.toLocaleString()}</td>
                                                <td className="text-end">$ {row.veCalculado.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}