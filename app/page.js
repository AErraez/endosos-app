'use client';
import { useState } from 'react';
import FiltrosBusqueda from './components/FiltrosBusqueda';
import TabMovimientos from './components/TabMovimientos';
import TabConsultaEndosos from './components/TabConsultaEndosos';
import TabInclusion from './components/TabInclusion';
import RegistroPoliza from './components/RegistroPoliza';

export default function EndososPage() {
    // ── Data state ────────────────────────────────────────────────
    const [currentDoc, setCurrentDoc] = useState(null);
    const [tablaData, setTablaData] = useState([]);
    const [busquedaRealizada, setBusquedaRealizada] = useState(false);

    // ── Movimiento state (shared so both tabs can read it) ────────
    const [tipoMov, setTipoMov] = useState("endoso");
    const [numEndoso, setNumEndoso] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // ── Active tab ────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState("movimientos");

    // ── Section (gestionar endosos vs registrar póliza) ───────────
    const [sectionTab, setSectionTab] = useState("gestionar");

    // ── Handlers ──────────────────────────────────────────────────
    const fetchPoliza = async ({ ciudad, ramo, poliza, vigencia }) => {
        const res = await fetch(
            `/api/data?ciudad=${encodeURIComponent(ciudad)}&ramo=${encodeURIComponent(ramo)}&poliza=${encodeURIComponent(poliza)}&vigencia=${encodeURIComponent(vigencia)}`
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

    const handleSelectPoliza = (p) => fetchPoliza({ ciudad: p.ciudad, ramo: p.ramo, poliza: p.poliza, vigencia: p.vigencia });

    const handleGuardar = async () => {
        if (isSaving) return;
        setIsSaving(true);

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

        try {
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
                await fetchPoliza({ ciudad: currentDoc.ciudad, ramo: currentDoc.ramo, poliza: currentDoc.poliza, vigencia: currentDoc.vigencia });
            }
        } finally {
            setIsSaving(false);
        }
    };

    const isGuardarDisabled = () => {
        const hasErrors = tablaData.some(row => row.error !== "");
        const hasMovement = tablaData.some(
            row => row.movimiento !== 0 && row.movimiento !== ""
        );
        return isSaving || hasErrors || !hasMovement || numEndoso.trim() === "";
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
                        <a className="nav-link" href="https://aerraez-clausulas.onrender.com">Cláusulas</a>
                    </li>
                    <li className="nav-item">
                        <a className="nav-link active" href="#">Endosos Beneficiarios</a>
                    </li>
                </ul>

                <ul className="nav nav-tabs mb-0">
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

                    {sectionTab === "gestionar" && (
                        <FiltrosBusqueda onSelectPoliza={handleSelectPoliza} />
                    )}

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
                                <li className="nav-item">
                                    <button
                                        className={`nav-link ${activeTab === "inclusion" ? "active fw-semibold" : ""}`}
                                        onClick={() => setActiveTab("inclusion")}
                                    >
                                        ➕ Inclusión
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
                                        isSaving={isSaving}
                                    />
                                )}

                                {activeTab === "consulta" && (
                                    <TabConsultaEndosos
                                        currentDoc={currentDoc}
                                        tablaData={tablaData}
                                        onRefresh={() => fetchPoliza({ ciudad: currentDoc.ciudad, ramo: currentDoc.ramo, poliza: currentDoc.poliza, vigencia: currentDoc.vigencia })}
                                    />
                                )}

                                {activeTab === "inclusion" && (
                                    <TabInclusion
                                        currentDoc={currentDoc}
                                        onSaved={() => fetchPoliza({ ciudad: currentDoc.ciudad, ramo: currentDoc.ramo, poliza: currentDoc.poliza, vigencia: currentDoc.vigencia })}
                                    />
                                )}
                            </div>
                        </>
                    )}

                    {sectionTab === "gestionar" && !busquedaRealizada && (
                        <p className="text-muted text-center py-4 mb-0">
                            Seleccione una póliza de la tabla para gestionar sus endosos.
                        </p>
                    )}
                </div>
            </main>
        </div>
    );
}