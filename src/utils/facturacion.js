// =====================================================================
// UTILIDADES: Facturación (control de estado, no facturación real)
// ---------------------------------------------------------------------
// Funciones PURAS (sin DOM ni Supabase). Solo controla en qué estado
// está cada paciente dentro del mes: no calcula montos ni genera nada.
// =====================================================================

// Estados posibles, en el orden en que se pasa de uno a otro.
export const ESTADOS_FACTURACION = [
  { valor: 'no_facturado',          label: 'No facturado', on: 'on-nf'  },
  { valor: 'facturado_no_cobrado',  label: 'Facturado',    on: 'on-fnc' },
  { valor: 'facturado_cobrado',     label: 'Cobrado',      on: 'on-fc'  },
];

export const ESTADO_POR_DEFECTO = 'no_facturado';

// Cuenta cuántos pacientes hay en cada estado dentro de un período.
// `estadosPorId` = { paciente_id: estado } (lo ya guardado en la base;
// el que no tiene fila todavía cuenta como "no_facturado").
export function resumenFacturacion(pacientes = [], estadosPorId = {}) {
  const cuenta = { no_facturado: 0, facturado_no_cobrado: 0, facturado_cobrado: 0 };
  pacientes.forEach(p => {
    const estado = estadosPorId[p.id] || ESTADO_POR_DEFECTO;
    cuenta[estado] = (cuenta[estado] ?? 0) + 1;
  });
  return cuenta;
}
