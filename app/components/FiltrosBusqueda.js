'use client';
import { useState, useEffect } from 'react';

const SearchIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
);

const SortIcon = ({ col, sortCol, sortDir }) => {
    if (sortCol !== col) return <span style={{ color: '#bbb', fontSize: '0.7em', marginLeft: 4 }}>↑↓</span>;
    return <span style={{ color: '#0d6efd', fontSize: '0.7em', marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
};

export default function FiltrosBusqueda({ onSelectPoliza }) {
    const [polizas, setPolizas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState(null);

    const [filterSucursal, setFilterSucursal] = useState("");
    const [filterRamo, setFilterRamo] = useState("");
    const [filterPoliza, setFilterPoliza] = useState("");
    const [filterVigencia, setFilterVigencia] = useState("");

    const [sortCol, setSortCol] = useState(null);
    const [sortDir, setSortDir] = useState('asc');

    const loadPolizas = () => {
        setLoading(true);
        fetch('/api/data')
            .then(r => r.json())
            .then(data => { setPolizas(Array.isArray(data) ? data : []); setLoading(false); })
            .catch(() => setLoading(false));
    };

    useEffect(() => {
        fetch('/api/data')
            .then(r => r.json())
            .then(data => { setPolizas(Array.isArray(data) ? data : []); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const sucursales = [...new Set(polizas.map(p => p.ciudad))].sort();
    const ramos = [...new Set(polizas.map(p => p.ramo))].sort();
    const vigencias = [...new Set(polizas.map(p => p.vigencia))].sort();

    const filtered = polizas.filter(p =>
        (!filterSucursal || p.ciudad === filterSucursal) &&
        (!filterRamo || p.ramo === filterRamo) &&
        (!filterPoliza || p.poliza.includes(filterPoliza)) &&
        (!filterVigencia || p.vigencia === filterVigencia)
    );

    const colKey = { sucursal: 'ciudad', ramo: 'ramo', poliza: 'poliza', vigencia: 'vigencia' };
    const sorted = sortCol
        ? [...filtered].sort((a, b) => {
            const av = a[colKey[sortCol]] ?? '';
            const bv = b[colKey[sortCol]] ?? '';
            return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
        })
        : filtered;

    const handleSort = (col) => {
        if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortCol(col); setSortDir('asc'); }
    };

    const clearFilters = () => {
        setFilterSucursal(""); setFilterRamo(""); setFilterPoliza(""); setFilterVigencia("");
        loadPolizas();
    };

    return (
        <div className="mb-3">
            {/* Header */}
            <div className="d-flex justify-content-between align-items-start mb-3">
                <div>
                    <h5 className="mb-0 fw-bold">Pólizas</h5>
                    <small className="text-muted">Consulta y gestión de pólizas.</small>
                </div>
                <button className="btn btn-sm btn-outline-primary d-flex align-items-center gap-2" onClick={clearFilters}>
                    <span>&#x21BB;</span> Limpiar filtros
                </button>
            </div>

            {/* Filter card */}
            <div className="bg-white border rounded p-3 mb-3">
                <div className="row g-3">
                    <div className="col-md-3">
                        <label className="form-label small fw-semibold text-muted mb-1">Sucursal</label>
                        <select className="form-select" value={filterSucursal} onChange={e => setFilterSucursal(e.target.value)}>
                            <option value="">Todas</option>
                            {sucursales.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div className="col-md-3">
                        <label className="form-label small fw-semibold text-muted mb-1">Ramo</label>
                        <select className="form-select" value={filterRamo} onChange={e => setFilterRamo(e.target.value)}>
                            <option value="">Todos</option>
                            {ramos.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    <div className="col-md-3">
                        <label className="form-label small fw-semibold text-muted mb-1"># Póliza</label>
                        <div className="input-group">
                            <span className="input-group-text bg-white text-muted"><SearchIcon /></span>
                            <input
                                type="text"
                                className="form-control border-start-0"
                                placeholder="Buscar póliza..."
                                value={filterPoliza}
                                onChange={e => setFilterPoliza(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="col-md-3">
                        <label className="form-label small fw-semibold text-muted mb-1">Vigencia</label>
                        <select className="form-select" value={filterVigencia} onChange={e => setFilterVigencia(e.target.value)}>
                            <option value="">Todas</option>
                            {vigencias.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Table card */}
            <div className="bg-white border rounded overflow-hidden">
                <div className="table-container" style={{ border: 'none' }}>
                <table className="table table-hover mb-0">
                    <thead>
                        <tr className="small text-muted text-uppercase" style={{ borderBottom: '2px solid #dee2e6' }}>
                            {[['sucursal', 'Sucursal'], ['ramo', 'Ramo'], ['poliza', 'Póliza'], ['vigencia', 'Vigencia']].map(([col, label]) => (
                                <th
                                    key={col}
                                    style={{ cursor: 'pointer', fontWeight: 600, letterSpacing: '0.05em' }}
                                    onClick={() => handleSort(col)}
                                >
                                    {label} <SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr><td colSpan="4" className="text-center text-muted py-4">Cargando...</td></tr>
                        )}
                        {!loading && sorted.length === 0 && (
                            <tr><td colSpan="4" className="text-center text-muted py-4">No se encontraron pólizas.</td></tr>
                        )}
                        {!loading && sorted.map(p => {
                            const isSelected = selectedId === p._id;
                            return (
                                <tr
                                    key={p._id}
                                    style={{
                                        cursor: 'pointer',
                                        borderLeft: isSelected ? '3px solid #0d6efd' : '3px solid transparent',
                                        backgroundColor: isSelected ? '#eff6ff' : undefined,
                                        color: isSelected ? '#0d6efd' : undefined,
                                    }}
                                    onClick={() => { setSelectedId(p._id); onSelectPoliza(p); }}
                                >
                                    <td>{p.ciudad}</td>
                                    <td>{p.ramo}</td>
                                    <td>{p.poliza}</td>
                                    <td>{p.vigencia}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                </div>
                {!loading && (
                    <div className="px-3 py-2 text-muted small border-top">{sorted.length} póliza(s)</div>
                )}
            </div>
        </div>
    );
}
