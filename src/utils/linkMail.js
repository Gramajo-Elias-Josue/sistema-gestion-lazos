// =====================================================================
// UTILIDAD: link de los mails de Supabase (bienvenida y recuperar)
// ---------------------------------------------------------------------
// Los botones de los mails NO llevan el link de Supabase que se gasta al
// abrirlo: llevan a la app con el código (`token_hash`) en la dirección.
// Así, si un antivirus o el filtro del correo "revisa" el link antes que
// la persona, no lo gasta: el código se usa recién cuando ella toca el
// botón en la app (ver loginController.montarLinkDelMail).
//
//   bienvenida:  <app>?token_hash=XXXX&type=invite
//   recuperar:   <app>?token_hash=XXXX&type=recovery
//
// Si Supabase rechaza un link (vencido o ya usado) vuelve a la app con el
// error en el hash: #error=access_denied&error_code=otp_expired&...
//
// Función pura: recibe `location.search` y `location.hash` y devuelve qué
// hay que mostrar. No toca la página.
// =====================================================================

const TIPOS = ['invite', 'recovery'];

// Devuelve:
//   { tipo: 'invite' | 'recovery', tokenHash }  → link válido para usar
//   { error: 'otp_expired' | ... }               → Supabase lo rechazó
//   null                                         → no vino de un mail
export function leerLinkDelMail(search = '', hash = '') {
  const q = new URLSearchParams(search.replace(/^\?/, ''));
  const tokenHash = q.get('token_hash');
  const tipo = q.get('type');
  if (tokenHash && TIPOS.includes(tipo)) return { tipo, tokenHash };

  const h = new URLSearchParams(hash.replace(/^#/, ''));
  if (h.get('error') || h.get('error_code')) {
    return { error: h.get('error_code') || h.get('error') };
  }
  return null;
}
