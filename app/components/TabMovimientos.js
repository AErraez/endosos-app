'use client';

import { useState } from 'react';

export default function TabMovimientos({ tablaData, setTablaData, tipoMov, setTipoMov, numEndoso, setNumEndoso, onGuardar, isGuardarDisabled, isSaving }) {

    const uniqueItems = ["TODOS", ...new Set(tablaData.map(row => row.itemNum))];
    const [selectedItem, setSelectedItem] = useState("TODOS");
    const [copyFeedback, setCopyFeedback] = useState("");

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
                : item.veCalculado > item.vaOriginal
                    ? "Suma Endosada no puede superar la Asegurada."
                    : "";
        }

        item.movimiento = value;
        setTablaData(newData);
    };

    // --- Formato de modificación (Item / Ramo / Rubro / sumas) ---
    const fmtMoney = (n) => {
        const num = isNaN(n) ? 0 : n;
        return num.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const buildModificacionOutput = (data) => {
        // Solo filas realmente modificadas
        const movidas = data.filter(row => (parseFloat(row.movimiento) || 0) !== 0);

        // Agrupar por Item (dirección) + Rubro, combinando coberturas (ramo) SOLO
        // cuando anterior, movimiento y actual coinciden exactamente
        const groups = [];
        const groupIndex = new Map();

        movidas.forEach(row => {
            const anterior = row.vaOriginal;
            const actual = row.vaCalculado;
            const diff = actual - anterior;
            const key = `${row.itemNum}||${row.rubroNombre}||${anterior.toFixed(2)}||${diff.toFixed(2)}||${actual.toFixed(2)}`;

            if (!groupIndex.has(key)) {
                groupIndex.set(key, groups.length);
                groups.push({
                    itemNum: row.itemNum,
                    rubroNombre: row.rubroNombre,
                    ramos: [row.nombreCobertura],
                    anterior,
                    actual
                });
            } else {
                const g = groups[groupIndex.get(key)];
                if (!g.ramos.includes(row.nombreCobertura)) {
                    g.ramos.push(row.nombreCobertura);
                }
            }
        });

        const blocks = groups.map(g => {
            const diff = g.actual - g.anterior;
            const isPositive = diff >= 0;

            const label1 = 'Suma asegurada anterior:';
            const label2 = isPositive ? 'Aumento:' : 'Disminución:';
            const label3 = 'Suma asegurada actual';

            const anteriorStr = fmtMoney(g.anterior);
            const diffStr = fmtMoney(Math.abs(diff));
            const actualStr = fmtMoney(g.actual);

            // Alinear los valores a la derecha para que dólares y centavos coincidan
            const maxValLen = Math.max(anteriorStr.length, diffStr.length, actualStr.length);
            const padValue = (s) => ' '.repeat(maxValLen - s.length) + s;

            const labelWidth = Math.max(label1.length, label2.length, label3.length) + 3;
            const padLabel = (label) => label + ' '.repeat(labelWidth - label.length);

            const line1 = `${padLabel(label1)}US$ ${padValue(anteriorStr)}`;
            const line2 = `${padLabel(label2)}US$ ${padValue(diffStr)}`;
            const line3 = `${padLabel(label3)}US$ ${padValue(actualStr)}`;

            // El separador empieza justo bajo "US$" y termina en el último centavo
            const sepLine = ' '.repeat(labelWidth) + '='.repeat(4 + maxValLen);

            return [
                `Item # ${g.itemNum}`,
                `Ramo: ${g.ramos.join(', ')}`,
                `Rubro: ${g.rubroNombre}`,
                '',
                line1,
                line2,
                sepLine,
                line3
            ].join('\n');
        });

        return blocks.join('\n\n');
    };

    const modificacionOutput = tipoMov === 'modificacion' ? buildModificacionOutput(tablaData) : "";

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(modificacionOutput);
            setCopyFeedback("Copiado ✓");
        } catch (e) {
            setCopyFeedback("No se pudo copiar");
        }
        setTimeout(() => setCopyFeedback(""), 2000);
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
                                        <td className="text-end">$ {row.vaCalculado.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="text-end">$ {row.veCalculado.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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
                        {isSaving ? "Guardando..." : "Guardar Cambios"}
                    </button>
                </div>
            </div>

            {/* Formato de modificación */}
            {tipoMov === 'modificacion' && (
                <div className="row py-3">
                    <div className="col-12">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                            <label className="fw-bold mb-0">Formato de modificación:</label>
                            <div className="d-flex align-items-center gap-2">
                                {copyFeedback && <span className="small text-success">{copyFeedback}</span>}
                                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={handleCopy}>
                                    Copiar
                                </button>
                            </div>
                        </div>
                        <textarea
                            readOnly
                            value={modificacionOutput}
                            className="form-control"
                            style={{ fontFamily: "'Courier New', Courier, monospace", whiteSpace: 'pre', minHeight: '220px' }}
                        />
                    </div>
                </div>
            )}
        </>
    );
}
