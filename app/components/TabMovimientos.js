'use client';

export default function TabMovimientos({ tablaData, setTablaData, tipoMov, setTipoMov, numEndoso, setNumEndoso, onGuardar, isGuardarDisabled }) {

    const uniqueItems = ["TODOS", ...new Set(tablaData.map(row => row.itemNum))];
    const [selectedItem, setSelectedItem] = useState("TODOS");

    const filteredData = selectedItem === "TODOS"
        ? tablaData
        : tablaData.filter(row => row.itemNum === selectedItem);

    const handleTipoMovChange = (e) => {
        setTipoMov(e.target.value);
        const resetData = tablaData.map(row => ({
            ...row,
            movimiento: 0,
            vaCalculado: row.vaOriginal,
            veCalculado: row.veOriginal,
            error: ""
        }));
        setTablaData(resetData);
    };

    const handleInputChange = (originalIndex, value) => {
        const valMov = parseFloat(value) || 0;
        const newData = [...tablaData];
        const item = newData[originalIndex];

        if (tipoMov === 'modificacion') {
            item.vaCalculado = item.vaOriginal + valMov;
            item.error = item.vaCalculado < item.veOriginal
                ? "Suma Asegurada no puede ser menor a Suma Endosada."
                : "";
        } else {
            item.veCalculado = item.veOriginal + valMov;
            item.error = valMov < 0
                ? "Valores negativos no permitidos."
                : item.veCalculated > item.vaOriginal
                    ? "Suma Endosada no puede superar la Asegurada."
                    : "";
        }

        item.movimiento = value;
        setTablaData(newData);
    };

    return (
        <>
            {/* Controls row */}
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
                    <select className="form-select" value={selectedItem} onChange={(e) => setSelectedItem(e.target.value)}>
                        {uniqueItems.map(item => (
                            <option key={item} value={item}>
                                {item === "TODOS" ? "Ver todos los items" : `Item ${item}`}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="row py-3">
                <div className="col-12 table-responsive">
                    <table className="table table-bordered table-hover">
                        <thead className="table-light">
                            <tr>
                                <th>Item</th>
                                <th>Cobertura</th>
                                <th>Rubro</th>
                                <th>Valor Movimiento</th>
                                <th>Valor Asegurado</th>
                                <th>Valor Endosado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredData.map((row) => {
                                const originalIndex = tablaData.findIndex(r => r === row);
                                return (
                                    <tr
                                        key={`${row.itemNum}-${row.rubroNombre}-${row.nombreCobertura}`}
                                        className={row.error ? 'table-danger' : ''}
                                    >
                                        <td className="text-center">{row.itemNum}</td>
                                        <td>{row.nombreCobertura}</td>
                                        <td>{row.rubroNombre}</td>
                                        <td>
                                            <input
                                                type="number"
                                                className={`form-control form-control-sm ${row.error ? 'is-invalid' : ''}`}
                                                value={row.movimiento}
                                                onChange={(e) => handleInputChange(originalIndex, e.target.value)}
                                            />
                                            {row.error && <div className="invalid-feedback d-block small">{row.error}</div>}
                                        </td>
                                        <td className="text-end">$ {row.vaCalculado.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="text-end">$ {row.veCalculado.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Save row */}
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
                    <button
                        className="btn btn-primary px-5"
                        disabled={isGuardarDisabled()}
                        onClick={onGuardar}
                    >
                        Guardar Cambios
                    </button>
                </div>
            </div>
        </>
    );
}

// useState must be imported in the actual file — adding import here:
import { useState } from 'react';