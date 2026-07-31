import * as XLSX from 'xlsx';

// Combos that start unchecked — fill in based on business rules.
// Matching is case-insensitive and trims whitespace.
export const EXCLUDED_RUBROS = [
  "REMOCION DE ESCOMBROS",
  "HONOR. DE ARQUIT., INGENIE. Y TOPOG.",
  "ROTURA DE VIDRIOS Y CRISTALES",
  "HON. DE AUDIT., CONTAD., ABOGAD. Y REVISORES",
  "DOCUMENTOS Y MODELOS",
  "GASTOS PARA EXTINGUIR INCENDIO",
  "CLAUSULA ELECTRICA AMPLIA",
  "ACEITES, LUBRICANTES Y REFRIGERANTES",
  "GASTOS EXTRAORDINARIOS",
  "TERRORISMO",
  "ARRENDAMIENTOS",
  "PROPIEDAD PERSONAL DE HUESPEDES",
  "EXTINTORES",
  "MATERIALES IMPORTADOS",
  "HURTO",
  "FLETE AEREO",
  "HURTO",
  "INTERESES DE CONTRATISTAS",
  "ROTURA DE TANQUES",
  "GASTOS PARA AMINORAR LA PRDIDA",
  "GASTOS ADICIONALES",
  "AUTOEXPLOSION",
  "MANIPULEO DE PRODUCTOS",
  "COMBUSTION ESPONTANEA",
  "DERRAME DE CONTENIDOS",
  "GASTOS POR EXTINCION Y CONTROL DE SINIESTROS",
  "GASTOS PARA LA PRESERVACIàN DE BIENES",
  "GASTOS DE VIAJE Y ESTADÖA",
  "GASTOS DE SALVATAJE",
  "HONORARIOS PROFESIONALES",
  "MERCADERIAS EN CONSIGNACION",
  "PROPIEDAD PERSONAL DE EJEC. Y/O EMPLEADOS",
  "BIENES DE PROPIEDAD DE TERCEROS BAJO RESPONSABILIDAD DEL AS",
  "PROVEEDORES",
  "SUSPENSION DE SERV. DE ENER. ELECTRICA, AGUA Y GAS",
  "COMBUSTIBLES",
  "CAIDA ACCIDENTAL DE CARGA",
  "PROPIEDAD PERSONAL DE EJEC. Y/O EMPLEADOS",
  "CAIDA ACCIDENTAL DE CARGA",
  "BIENES EN EXPOSICION O DEMOSTRACION",
  "SAQUEO",
  "INCREMENTO EN EL COSTO DE OPERACION",
  "PORTADORES EXTERNOS DE DATOS SECCION II",
  "OBRA CIVIL"
];

export const EXCLUDED_COBERTURAS = [
    "TERREMOTO","LUCRO CESANTE TERREMOTO"
];

export function excelDateToYear(serial) {
    if (!serial || isNaN(serial)) return '';
    if (serial > 1900 && serial < 2200) return serial; // already a year
    const date = new Date((serial - 25569) * 86400 * 1000);
    return date.getUTCFullYear();
}

export function parseXls(arrayBuffer) {
    const wb = XLSX.read(arrayBuffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    const headerIdx = allRows.findIndex(r => String(r[0]).trim() === 'Sucursal');
    if (headerIdx === -1) throw new Error('No se encontró la fila de encabezado (Sucursal).');

    const footerIdx = allRows.findIndex(
        (r, i) => i > headerIdx && r.some(c => String(c).includes('Page') || String(c).includes('Página'))
    );
    const endIdx = footerIdx === -1 ? allRows.length : footerIdx;

    const dataRows = allRows
        .slice(headerIdx + 1, endIdx)
        .filter(r => String(r[0]).trim() !== '');

    if (dataRows.length === 0) throw new Error('No se encontraron filas de datos.');

    // Drop columns that are empty across every data row
    const numCols = dataRows[0].length;
    const emptyCols = new Set(
        Array.from({ length: numCols }, (_, i) => i)
            .filter(i => dataRows.every(row => String(row[i] ?? '').trim() === ''))
    );

    return dataRows.map(row => row.filter((_, i) => !emptyCols.has(i)));
}
