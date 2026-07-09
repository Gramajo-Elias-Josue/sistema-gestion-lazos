// =====================================================================
// APP: Punto de entrada
// ---------------------------------------------------------------------
// Registra la función de arranque de cada controlador en el router y
// pone en marcha la navegación. Es lo único que carga index.html.
// =====================================================================

import { iniciarRouter, registrarControlador } from './router.js';
import { iniciarSidebar } from './sidebar.js';
import { iniciarTema } from './tema.js';
import { iniciarInicio } from './controllers/inicioController.js';
import { iniciarAdmision } from './controllers/admisionController.js';
import { iniciarPacientes } from './controllers/pacientesController.js';
import { iniciarTurnos } from './controllers/turnosController.js';
import { iniciarAsistencia } from './controllers/asistenciaController.js';
import { iniciarProfesionales } from './controllers/profesionalesController.js';

// Conecta cada sección con su controlador.
registrarControlador('inicio', iniciarInicio);
registrarControlador('admision', iniciarAdmision);
registrarControlador('pacientes', iniciarPacientes);
registrarControlador('agenda', iniciarTurnos);
registrarControlador('asistencia', iniciarAsistencia);
registrarControlador('profesionales', iniciarProfesionales);

// Arranca el cambio de tema (claro/oscuro), la barra lateral y la navegación.
iniciarTema();
iniciarSidebar();
iniciarRouter();
