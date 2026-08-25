// =====================================================================
// CONTROLADOR: Convenios (obras sociales)
// ---------------------------------------------------------------------
// CAPA CONTROLADOR. Sección recién creada: por ahora solo lista los
// convenios cargados. El alta/edición se agrega cuando se defina qué
// datos lleva cada convenio.
// =====================================================================

import * as convenioModel from '../models/convenioModel.js';
import { renderEstructura, renderLista } from '../views/conveniosView.js';
import { htmlCargando, htmlError } from '../utils/ui.js';

export async function iniciarConvenios() {
  const contenedor = document.getElementById('v-convenios');
  contenedor.innerHTML = renderEstructura();

  const caja = document.getElementById('convenios-lista');
  caja.innerHTML = htmlCargando('Cargando convenios…');
  try {
    const convenios = await convenioModel.listarConvenios();
    caja.innerHTML = renderLista(convenios);
  } catch (err) {
    console.error('Error cargando convenios:', err);
    caja.innerHTML = htmlError('No se pudieron cargar los convenios.');
  }
}
