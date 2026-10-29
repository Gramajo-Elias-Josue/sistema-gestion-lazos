// =====================================================================
// Configuración de Vite (servidor de desarrollo y build)
// ---------------------------------------------------------------------
// Por seguridad, Vite solo responde a "localhost". Para probar desde el
// celular se reenvía el puerto con VS Code (pestaña PORTS), que da una
// dirección https://…devtunnels.ms: acá se la habilita. El https además
// es lo que permite pedir la ubicación (fichaje del profesional).
// =====================================================================

import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    allowedHosts: ['.devtunnels.ms'],
  },
});
