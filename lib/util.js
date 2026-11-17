'use strict';
// Utilidades pequenas e sem dependências.
const brl = cent => (cent / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const soDigitos = v => String(v ?? '').replace(/\D+/g, '');
const limpa = (v, max = 120) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

function slugify(s) {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'produto';
}

function cpfValido(v) {
  const c = soDigitos(v); if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  for (const t of [9, 10]) {
    let s = 0; for (let i = 0; i < t; i++) s += Number(c[i]) * (t + 1 - i);
    if (((s * 10) % 11) % 10 !== Number(c[t])) return false;
  }
  return true;
}
function cnpjValido(v) {
  const c = soDigitos(v); if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  for (const t of [12, 13]) {
    let s = 0, p = t - 7;
    for (let i = 0; i < t; i++) { s += Number(c[i]) * p--; if (p < 2) p = 9; }
    if (((s % 11) < 2 ? 0 : 11 - (s % 11)) !== Number(c[t])) return false;
  }
  return true;
}
const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');

module.exports = { brl, soDigitos, limpa, slugify, cpfValido, cnpjValido, UFS };
