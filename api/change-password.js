// api/change-password.js
import { sbQuery, corsHeaders, ok, err } from './_supabase.js';

export const config = { runtime: 'edge' };

function hashPass(p) {
  let h = 0;
  for (let i = 0; i < p.length; i++) { h = ((h << 5) - h) + p.charCodeAt(i); h |= 0; }
  return 'h_' + Math.abs(h).toString(36) + p.length;
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response('', { headers: corsHeaders() });
  if (req.method !== 'POST') return err('Method not allowed', 405);

  try {
    const { userId, currentPassword, newPassword, adminUserId } = await req.json();
    if (!userId || !newPassword) return err('Dados incompletos');
    if (newPassword.length < 6) return err('Senha mínima 6 caracteres');

    // Se não for reset por admin, valida senha atual
    if (!adminUserId) {
      if (!currentPassword) return err('Senha atual obrigatória');
      const users = await sbQuery(
        `/users?id=eq.${userId}&password_hash=eq.${encodeURIComponent(hashPass(currentPassword))}&select=id`
      );
      if (!users || users.length === 0) return err('Senha atual incorreta', 401);
    } else {
      // Verifica se adminUserId é realmente admin/superadmin
      const admins = await sbQuery(`/users?id=eq.${adminUserId}&select=role`);
      const role = admins[0]?.role;
      if (!['superadmin','admin_empresa','admin_transportadora'].includes(role)) {
        return err('Sem permissão', 403);
      }
    }

    // Atualiza senha
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
    await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      },
      body: JSON.stringify({ password_hash: hashPass(newPassword) })
    });

    return ok({ success: true });
  } catch (e) {
    return err('Erro: ' + e.message, 500);
  }
}
