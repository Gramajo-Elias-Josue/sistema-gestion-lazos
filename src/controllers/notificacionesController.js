// =====================================================================
// CONTROLADOR: Notificaciones globales (campana del encabezado)
// ---------------------------------------------------------------------
// CAPA CONTROLADOR. A diferencia del resto de los controladores, este no
// lo llama el router: se conecta UNA vez desde app.js (como el logout o
// "Mi perfil") porque la campana vive en el encabezado, visible en toda
// la app, no dentro de una sección.
//
// Junta lo que sí requiere atención (informes/fotos pendientes del mes)
// con los avisos menores (cumpleaños próximos), filtrado según lo que el
// perfil puede ver. Se recalcula en cada login; no hay "marcar como
// visto" ni persistencia.
// =====================================================================

import * as pacienteModel from '../models/pacienteModel.js';
import * as profesionalModel from '../models/profesionalModel.js';
import * as evaluacionModel from '../models/evaluacionModel.js';
import * as fotoModel from '../models/fotoModel.js';
import { renderListaNotificaciones } from '../views/notificacionesView.js';
import { notificacionesCumpleanos, notificacionesGlobales, DIAS_AVISO_ENTREGAS } from '../utils/notificaciones.js';
import { periodoMensual, pendientesDelMes, diasHastaFinDeMes } from '../utils/periodos.js';
import { hoyISO, rangoMes } from '../utils/fechas.js';
import { perfilActual } from '../sesion.js';
import { puedeVer } from '../permisos.js';
import { htmlError } from '../utils/ui.js';

let abierto = false;

// Conecta la campana (click para abrir/cerrar, click afuera y Escape
// para cerrar). Se llama una sola vez desde app.js.
export function conectarNotificaciones() {
  const btn = document.getElementById('btn-notif');
  const drop = document.getElementById('notif-drop');
  if (!btn || !drop) return;

  const abrir = () => { drop.classList.remove('hidden'); abierto = true; };
  const cerrar = () => { drop.classList.add('hidden'); abierto = false; };

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    abierto ? cerrar() : abrir();
  });
  document.addEventListener('click', (e) => {
    if (abierto && !drop.contains(e.target) && e.target !== btn) cerrar();
  });
  document.addEventListener('keydown', (e) => {
    if (abierto && e.key === 'Escape') cerrar();
  });
}

// Trae y pinta las notificaciones + el número en la campana. Se llama
// desde app.js cada vez que arranca la sesión (login, o al recargar con
// sesión ya activa).
export async function cargarNotificaciones() {
  const badge = document.getElementById('notif-badge');
  const lista = document.getElementById('notif-lista');
  if (!badge || !lista) return;

  try {
    const perfil = perfilActual();
    const verPacientes = puedeVer(perfil, 'pacientes');
    const verProfesionales = puedeVer(perfil, 'profesionales');
    const hoy = hoyISO();

    const [pacientes, profesionales] = await Promise.all([
      verPacientes ? pacienteModel.listarPacientes({ soloActivos: true }) : [],
      verProfesionales ? profesionalModel.listarProfesionales({ soloActivos: true }) : [],
    ]);
    const cumpleanos = notificacionesCumpleanos({ pacientes, profesionales, verPacientes, verProfesionales, hoy });

    // Informes/fotos pendientes: es compliance del equipo, solo tiene
    // sentido para quien entra a la sección Profesionales. Y solo cerca
    // de fin de mes: antes todavía hay tiempo, y avisar desde el día 1
    // solo generaba ruido (quedaba "molestando" todo el mes).
    const avisarEntregas = diasHastaFinDeMes(hoy) <= DIAS_AVISO_ENTREGAS;
    let pendientes = { informes: [], fotos: [] };
    if (verProfesionales && avisarEntregas) {
      const periodo = periodoMensual(hoy);
      const { desde, hasta } = rangoMes(hoy);
      const [informes, fotos] = await Promise.all([
        evaluacionModel.listarInformesPorRango('mensual', desde, hasta),
        fotoModel.listarTodas(),
      ]);
      pendientes = pendientesDelMes({ profesionales, informes, fotos, periodo });
    }

    const items = notificacionesGlobales({ cumpleanos, pendientes, avisarEntregas });
    lista.innerHTML = renderListaNotificaciones(items);
    actualizarBadge(badge, items.length);
  } catch (err) {
    console.error('Error cargando notificaciones:', err);
    lista.innerHTML = htmlError('No se pudieron cargar las notificaciones.');
  }
}

function actualizarBadge(badge, cantidad) {
  badge.textContent = cantidad > 9 ? '9+' : String(cantidad);
  badge.classList.toggle('hidden', cantidad === 0);
}
