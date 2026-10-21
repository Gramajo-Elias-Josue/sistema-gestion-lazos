// =====================================================================
// CONTROLADOR: Editor de informe / evaluación-certificado
// ---------------------------------------------------------------------
// La "hoja" donde el profesional escribe un informe o una evaluación /
// certificado. La usan la historia clínica (pacientes con legajo) y la
// agenda (pacientes casuales). Este módulo solo maneja el formulario:
// QUÉ se hace al guardar (dónde se guarda, si se adjunta el PDF) lo
// decide quien lo abre, con `alGuardar`.
// =====================================================================

import { renderFormEvaluacion } from '../views/pacientesView.js';
import { serializarEvaluacion, tituloPorTipo } from '../utils/evaluacion.js';
import { toast } from '../utils/ui.js';
import { mensajeError } from '../utils/errores.js';

// paciente     -> datos del membrete
// autores      -> profesionales habilitados [{ id, profesional_id, profesionales, hora }]
// datosPorProf -> { profesional_id: informe ya cargado } para prellenar
// vista        -> opciones de renderFormEvaluacion (tipos, título, textos)
// alGuardar    -> async ({ datos, contenido, autor, turnoId }) — guarda y
//                 genera el PDF. Si lanza error, el editor queda abierto.
export function abrirEditorInforme({ paciente, autores, datosPorProf = {}, vista = {}, alGuardar }) {
  document.body.insertAdjacentHTML('beforeend', renderFormEvaluacion(paciente, autores, datosPorProf, vista));
  const overlay = document.getElementById('overlay-eval');
  const form = document.getElementById('form-eval');
  const selProf = document.getElementById('eval-prof');
  const selTipo = document.getElementById('eval-tipo');
  const inputTitulo = document.getElementById('eval-titulo');
  const txtCuerpo = document.getElementById('eval-cuerpo'); // la hoja de escritura
  const tipoInicial = selTipo.options[0]?.value;
  const cerrar = () => overlay.remove();

  overlay.querySelectorAll('[data-cerrar]').forEach(b => b.addEventListener('click', cerrar));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });

  // Al cambiar el TIPO, se sugiere el título por defecto de ese tipo.
  selTipo.addEventListener('change', () => { inputTitulo.value = tituloPorTipo(selTipo.value); });

  // Al cambiar de PROFESIONAL, recarga tipo/título/cuerpo con lo que ese
  // profesional ya cargó (o la hoja en blanco si todavía no cargó nada).
  selProf.addEventListener('change', () => {
    const inf = datosPorProf[selProf.value] || { tipo: tipoInicial, titulo: tituloPorTipo(tipoInicial), cuerpo: '' };
    selTipo.value = inf.tipo || tipoInicial;
    inputTitulo.value = inf.titulo || tituloPorTipo(selTipo.value);
    txtCuerpo.value = inf.cuerpo || '';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const datos = { tipo: selTipo.value, titulo: inputTitulo.value, cuerpo: txtCuerpo.value };
    if (!(datos.cuerpo || '').trim()) {
      toast('Escribí el contenido antes de guardar.', 'bad');
      return;
    }

    const opt = selProf.options[selProf.selectedIndex];
    const autor = autores.find(a => String(a.profesional_id) === String(selProf.value)) || {};
    const btn = document.getElementById('btn-guardar-eval');
    btn.disabled = true;
    btn.textContent = 'Guardando…';
    try {
      await alGuardar({
        datos,
        contenido: serializarEvaluacion(datos),
        autor,
        // Vacío = sin turno (no confundir con la columna uuid, que rechaza
        // "" tanto como rechazaría "null").
        turnoId: (opt && opt.dataset.turno) ? opt.dataset.turno : null,
      });
      cerrar();
    } catch (err) {
      console.error('Error guardando el informe:', err);
      btn.disabled = false;
      btn.textContent = 'Guardar y generar PDF';
      toast(mensajeError(err, 'No se pudo guardar. Probá de nuevo.'), 'bad');
    }
  });
}
