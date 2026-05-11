'use client';
import { useState } from 'react';
import FiltrosBusqueda from './components/FiltrosBusqueda';
import TabMovimientos from './components/TabMovimientos';
import TabConsultaEndosos from './components/TabConsultaEndosos';
import RegistroPoliza from './components/RegistroPoliza';

export default function EndososPage() {
    // ── Filter state ──────────────────────────────────────────────
    const [sucursal, setSucursal] = useState("");
    const [ramo, setRamo] = useState("");
    const [poliza, setPoliza] = useState("");
    const [vigencia, setVigencia] = useState("");

    // ── Data state ────────────────────────────────────────────────
    const [currentDoc, setCurrentDoc] = useState(null);
    const [tablaData, setTablaData] = useState([]);
    const [busquedaRealizada, setBusquedaRealizada] = useState(false);

    // ── Movimiento state (shared so both tabs can read it) ────────
    const [tipoMov, setTipoMov] = useState("endoso");
    const [numEndoso, setNumEndoso] = useState("");

    // ── Active tab ────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState("movimientos");

    // ── Section (gestionar endosos vs registrar póliza) ───────────
    const [sectionTab, setSectionTab] = useState("gestionar");

    // ── Handlers ──────────────────────────────────────────────────
    const handleBuscar = async () => {
        if (!sucursal || !ramo || !poliza || !vigencia) return;

        const res = await fetch(
            `/api/data?ciudad=${sucursal}&ramo=${ramo}&poliza=${poliza}&vigencia=${vigencia}`
        );

        if (!res.ok) {
            alert("Error de conexión con la base de datos. Intente nuevamente.");
            return;
        }

        const data = await res.json();

        if (!data || data.error || !data.items) {
            alert("Póliza no encontrada.");
            return;
        }

        setCurrentDoc(data);

        const flattened = data.items.flatMap(item =>
            item.coberturas.map(cob => ({
                itemNum: item.item_id,
                ramoPolNombre: data.ramo,
                rubroNombre: cob.rubro,
                nombreCobertura: cob.nombre,
                vaOriginal: cob.valor_asegurado,
                veOriginal: cob.valor_endosado_total,
                movimiento: 0,
                vaCalculado: cob.valor_asegurado,
                veCalculado: cob.valor_endosado_total,
                error: ""
            }))
        );

        setTablaData(flattened);
        setBusquedaRealizada(true);
        setNumEndoso("");
        setTipoMov("endoso");
    };

    const handleGuardar = async () => {
        const updatedItems = currentDoc.items.map(item => {
            const updatedCoverages = item.coberturas.map(cob => {
                const row = tablaData.find(
                    r => r.itemNum === item.item_id && r.rubroNombre === cob.rubro
                );
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
                numEndoso,
                tipoMov
            })
        });

        if (res.ok) {
            alert("Guardado exitosamente");
            handleBuscar();
        }
    };

    const isGuardarDisabled = () => {
        const hasErrors = tablaData.some(row => row.error !== "");
        const hasMovement = tablaData.some(
            row => row.movimiento !== 0 && row.movimiento !== ""
        );
        return hasErrors || !hasMovement || numEndoso.trim() === "";
    };

    // ── Render ────────────────────────────────────────────────────
    return (
        <div className="px-3">
            <header className="text-center py-3">
                <h1>Endosos Beneficiarios</h1>
            </header>

            <main className="container-fluid py-3 bg-white shadow rounded">
                {/* App-level nav */}
                <ul className="nav nav-pills mb-4">
                    <li className="nav-item">
                        <a className="nav-link" href="#">Cláusulas</a>
                    </li>
                    <li className="nav-item">
                        <a className="nav-link active" href="#">Endosos Beneficiarios</a>
                    </li>
                </ul>

                {/* Search filters — only in gestionar mode */}
                {sectionTab === "gestionar" && (
                    <FiltrosBusqueda
                        sucursal={sucursal} setSucursal={setSucursal}
                        ramo={ramo} setRamo={setRamo}
                        poliza={poliza} setPoliza={setPoliza}
                        vigencia={vigencia} setVigencia={setVigencia}
                        onBuscar={handleBuscar}
                    />
                )}

                {/* Section tabs — between searcher and endosos nav */}
                <ul className="nav nav-tabs mb-0 mt-2">
                    <li className="nav-item">
                        <button
                            className={`nav-link ${sectionTab === "gestionar" ? "active fw-semibold" : ""}`}
                            onClick={() => setSectionTab("gestionar")}
                        >
                            Gestionar Endosos
                        </button>
                    </li>
                    <li className="nav-item">
                        <button
                            className={`nav-link ${sectionTab === "registrar" ? "active fw-semibold" : ""}`}
                            onClick={() => setSectionTab("registrar")}
                        >
                            Registrar Póliza
                        </button>
                    </li>
                </ul>

                <div className="border border-top-0 rounded-bottom p-3 mb-3">
                    {sectionTab === "registrar" && <RegistroPoliza />}

                    {sectionTab === "gestionar" && busquedaRealizada && (
                        <>
                            <ul className="nav nav-tabs mt-1 mb-0">
                                <li className="nav-item">
                                    <button
                                        className={`nav-link ${activeTab === "movimientos" ? "active fw-semibold" : ""}`}
                                        onClick={() => setActiveTab("movimientos")}
                                    >
                                        ✏️ Movimientos
                                    </button>
                                </li>
                                <li className="nav-item">
                                    <button
                                        className={`nav-link ${activeTab === "consulta" ? "active fw-semibold" : ""}`}
                                        onClick={() => setActiveTab("consulta")}
                                    >
                                        📋 Consulta de Endosos
                                    </button>
                                </li>
                            </ul>

                            <div className="border border-top-0 rounded-bottom p-3">
                                {activeTab === "movimientos" && (
                                    <TabMovimientos
                                        tablaData={tablaData}
                                        setTablaData={setTablaData}
                                        tipoMov={tipoMov}
                                        setTipoMov={setTipoMov}
                                        numEndoso={numEndoso}
                                        setNumEndoso={setNumEndoso}
                                        onGuardar={handleGuardar}
                                        isGuardarDisabled={isGuardarDisabled}
                                    />
                                )}

                                {activeTab === "consulta" && (
                                    <TabConsultaEndosos
                                        currentDoc={currentDoc}
                                        tablaData={tablaData}
                                        onRefresh={handleBuscar}
                                    />
                                )}
                            </div>
                        </>
                    )}

                    {sectionTab === "gestionar" && !busquedaRealizada && (
                        <p className="text-muted text-center py-4 mb-0">
                            Realice una búsqueda para gestionar los endosos de una póliza.
                        </p>
                    )}
                </div>
            </main>
        </div>
    );
}