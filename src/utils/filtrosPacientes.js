// =====================================================================
// UTILIDAD: Búsqueda y filtros del listado de pacientes
// ---------------------------------------------------------------------
// Funciones PURAS. El listado NO muestra a todos los pacientes de
// entrada (lo pidió la cátedra, para alivianar la página: no se dibuja
// una lista larga que casi nunca se recorre entera): solo aparecen los que
// se buscan, o el grupo que se elige con "Filtros". "Ver todos" queda como
// opción explícita.
// =====================================================================

// Sin ningún filtro elegido.
export const FILTROS_VACIOS = { estado: 'todos', cud: 'todos', obraSocial: 'todas', verTodos: false };

// Valor del filtro de obra social para quien no tiene ninguna cargada.
export const SIN_OBRA_SOCIAL = '_sin';

// Cuántos filtros hay elegidos (para el numerito del botón "Filtros").
export function cantidadFiltros(f = FILTROS_VACIOS) {
  return (f.estado !== 'todos') + (f.cud !== 'todos') + (f.obraSocial !== 'todas') + (f.verTodos ? 1 : 0);
}

// ¿Se muestra el listado? Solo si se escribió algo o hay algún filtro.
export function hayQueMostrar(termino = '', f = FILTROS_VACIOS) {
  return termino.trim() !== '' || cantidadFiltros(f) > 0;
}

// ¿Un paciente pasa la búsqueda y los filtros?
//   p: { buscar, estado, cud, obraSocial } (lo que lleva cada fila en sus data-*)
export function pasaFiltros(p, termino = '', f = FILTROS_VACIOS) {
  const t = termino.trim().toLowerCase();
  if (t && !(p.buscar || '').includes(t)) return false;
  if (f.estado !== 'todos' && p.estado !== f.estado) return false;
  if (f.cud !== 'todos' && p.cud !== f.cud) return false;
  if (f.obraSocial !== 'todas' && (p.obraSocial || SIN_OBRA_SOCIAL) !== f.obraSocial) return false;
  return true;
}

// Obras sociales distintas de la lista, ordenadas (para el desplegable).
export function obrasSociales(pacientes = []) {
  return [...new Set(pacientes.map(p => (p.obra_social || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'es'));
}
