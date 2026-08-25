// =====================================================================
// UTILIDADES: Gastos (rendición de cuentas entre socios)
// ---------------------------------------------------------------------
// Funciones PURAS (sin DOM ni Supabase). El centro es una sociedad, no
// un solo dueño: cada gasto queda atado a qué socio lo pagó, para poder
// repartir/rendir cuentas entre ellos.
// =====================================================================

// Formatea un monto en pesos argentinos. '—' si no hay valor.
export function formatearMonto(monto) {
  if (monto == null || Number.isNaN(Number(monto))) return '—';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(monto));
}

// Cuánto pagó cada socio en total, de mayor a menor. `gastos` = lo que
// devuelve gastoModel.listarPorRango(): [{ socio, monto, … }].
export function resumenPorSocio(gastos = []) {
  const totales = {};
  gastos.forEach(g => {
    const socio = g.socio || 'Sin asignar';
    totales[socio] = (totales[socio] ?? 0) + Number(g.monto || 0);
  });
  return Object.entries(totales)
    .map(([socio, total]) => ({ socio, total }))
    .sort((a, b) => b.total - a.total);
}

// Total general del período.
export function totalGastos(gastos = []) {
  return gastos.reduce((acc, g) => acc + Number(g.monto || 0), 0);
}
