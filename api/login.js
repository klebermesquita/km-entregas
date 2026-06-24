// api/login.js — autenticação segura no servidor
import { sbQuery, sbRpc, corsHeaders, ok, err } from './_supabase.js';

export const config = { runtime: 'edge' };

// Rate limiting simples em memória (por IP)
const attempts = new Map();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutos

function checkRateLimit(ip) {
  const now = Date.now();
  const key = ip || 'unknown';
  const record = attempts.get(key) || { count: 0, reset: now + WINDOW_MS };
  if (now > record.reset) {
    record.count = 0;
    record.reset = now + WINDOW_MS;
  }
  record.count++;
  attempts.set(key, record);
  return record.count <= MAX_ATTEMPTS;
}

function hashPass(p) {
  let h = 0;
  for (let i = 0; i < p.length; i++) {
    h = ((h << 5) - h) + p.charCodeAt(i);
    h |= 0;
  }
  return 'h_' + Math.abs(h).toString(36) + p.length;
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response('', { headers: corsHeaders() });
  if (req.method !== 'POST') return err('Method not allowed', 405);

  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  if (!checkRateLimit(ip)) return err('Muitas tentativas. Aguarde 15 minutos.', 429);

  try {
    const { email, password } = await req.json();
    if (!email || !password) return err('Email e senha obrigatórios');

    const hash = hashPass(password);

    // Busca usuário validando hash no servidor
    const users = await sbQuery(
      `/users?email=eq.${encodeURIComponent(email.toLowerCase())}&password_hash=eq.${encodeURIComponent(hash)}&select=id,email,name,role,company_id,carrier_id,created_at`
    );

    if (!users || users.length === 0) return err('Email ou senha incorretos', 401);

    const user = users[0];

    // Verificar empresa/transportadora ativa
    if (user.company_id) {
      const companies = await sbQuery(`/companies?id=eq.${user.company_id}&select=active,name`);
      if (!companies[0]?.active) return err('Empresa inativa. Contate o suporte.', 403);
      user.company_name = companies[0].name;
    }

    if (user.carrier_id) {
      const carriers = await sbQuery(`/carriers?id=eq.${user.carrier_id}&select=active,name,delegation_mode`);
      if (!carriers[0]?.active) return err('Transportadora inativa. Contate o suporte.', 403);
      user.carrier_name = carriers[0].name;
      user.carrier_delegation_mode = carriers[0].delegation_mode;
    }

    // Nunca retornar password_hash
    delete user.password_hash;

    return ok({ user });
  } catch (e) {
    return err('Erro interno: ' + e.message, 500);
  }
}
