// =====================================================================
// CONFIGURACIÓN: Cliente de Supabase
// ---------------------------------------------------------------------
// Único punto donde se crea el cliente. Todos los modelos lo importan
// desde acá, así no se duplica la conexión.
//
// SEGURIDAD: se usa SOLO la PUBLISHABLE KEY (clave pública). Es un
// frontend, por lo que la clave queda expuesta en el navegador —y está
// bien, para eso existe la publishable key—. La SECRET KEY jamás debe
// estar del lado del cliente.
//
// Las credenciales se leen desde variables de entorno (.env) mediante
// import.meta.env de Vite. Solo las variables con prefijo VITE_ quedan
// disponibles en el navegador.
// =====================================================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Validación temprana: si faltan las credenciales, avisamos con un
// mensaje claro en lugar de fallar de forma confusa más adelante.
if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Faltan las variables de entorno de Supabase. ' +
    'Copiá ".env.example" a ".env" y completá VITE_SUPABASE_URL y ' +
    'VITE_SUPABASE_PUBLISHABLE_KEY.'
  );
}

// Cliente único, reutilizable en toda la aplicación.
export const supabase = createClient(supabaseUrl, supabaseKey);
