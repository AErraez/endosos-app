// Accepts numbers typed with either convention — "1,234,567.89" or
// "1.234.567,89" — and returns a plain float. Whichever separator (',' or '.')
// appears last is treated as the decimal point; the other is stripped as a
// thousands separator. When only one separator type is present, a single
// occurrence followed by 1-2 digits is treated as decimal (decimals are never
// longer than 2 digits); anything else (3+ digits, or repeated separators) is
// treated as thousands grouping.
export function parseFlexibleNumber(input) {
    if (typeof input === 'number') return input;
    if (typeof input !== 'string') return NaN;

    let s = input.trim();
    if (s === '') return NaN;

    let negative = false;
    if (s.startsWith('-')) { negative = true; s = s.slice(1); }
    else if (s.startsWith('+')) { s = s.slice(1); }

    const hasComma = s.includes(',');
    const hasDot = s.includes('.');

    let decimalSep = null;
    if (hasComma && hasDot) {
        decimalSep = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.';
    } else if (hasComma || hasDot) {
        const sep = hasComma ? ',' : '.';
        const parts = s.split(sep);
        if (parts.length === 2 && parts[1].length <= 2) {
            decimalSep = sep;
        }
    }

    let normalized;
    if (decimalSep) {
        const thousandsSep = decimalSep === ',' ? '.' : ',';
        normalized = s.split(thousandsSep).join('').replace(decimalSep, '.');
    } else {
        normalized = s.replace(/[.,]/g, '');
    }

    const num = parseFloat(normalized);
    if (isNaN(num)) return NaN;
    return negative ? -num : num;
}
