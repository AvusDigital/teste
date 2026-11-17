'use strict';
// Frete SIMULADO (determinístico, sem rede). Serve para montar e testar a loja inteira antes do contrato real.
// Preço = base por "distância" (primeiro dígito do CEP) + valor por kg tarifável (maior entre peso e cubagem).
async function cotar({ cep, volumes, c }) {
  const origem = Number((c.cepOrigem || '01000000')[0]);
  const zona = Math.abs(Number(cep[0]) - origem);                  // 0 (mesma região) a 9
  const real = volumes.reduce((s, v) => s + v.weight * v.quantity, 0);
  const cubado = volumes.reduce((s, v) => s + (v.length * v.width * v.height / 6000) * v.quantity, 0);
  const kg = Math.max(real, cubado, 0.3);
  const pac = Math.round((1100 + zona * 320 + kg * (180 + zona * 35)));
  const sedex = Math.round(pac * 1.75);
  return {
    demo: true,
    opcoes: [
      { id: 'pac', nome: 'PAC (simulado)', precoCent: pac, prazoMin: 3 + Math.round(zona * 1.2), prazoMax: 5 + Math.round(zona * 1.6) },
      { id: 'sedex', nome: 'SEDEX (simulado)', precoCent: sedex, prazoMin: 1 + Math.round(zona * 0.4), prazoMax: 2 + Math.round(zona * 0.7) }
    ]
  };
}
module.exports = { cotar };
