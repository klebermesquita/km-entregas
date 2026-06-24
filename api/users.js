// api/users.js — CRUD de usuários no servidor
import { sbQuery, corsHeaders, ok, err } from './_supabase.js';

export const config = { runtime: 'edge' };

const SUPABASE_URL = () => process.env.SUPABASE_URL;
const SUPABASE_KEY = () => process.env.SUPABASE_SERVICE_KEY;

function hashPass(p) {
  let h = 0;
  for (let i = 0; i < p.length; i++) { h = ((h << 5) - h) + p.charCodeAt(i); h |= 0; }
  return 'h_' + Math.abs(h).toString(36) + p.length;
}

async function sbPatch(path, body) {
  return fetch(`${SUPABASE_URL()}/rest/v1${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type':'application/json', 'apikey':SUPABASE_KEY(), 'Authorization':`Bearer ${SUPABASE_KEY()}`, 'Prefer':'return=representation' },
    body: JSON.stringify(body)
  });
}
async function sbPost(path, body) {
  return fetch(`${SUPABASE_URL()}/rest/v1${path}`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'apikey':SUPABASE_KEY(), 'Authorization':`Bearer ${SUPABASE_KEY()}`, 'Prefer':'return=representation' },
    body: JSON.stringify(body)
  });
}
async function sbDelete(path) {
  return fetch(`${SUPABASE_URL()}/rest/v1${path}`, {
    method: 'DELETE',
    headers: { 'apikey':SUPABASE_KEY(), 'Authorization':`Bearer ${SUPABASE_KEY()}` }
  });
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response('', { headers: corsHeaders() });

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // GET — listar usuários
    if (req.method === 'GET') {
      const companyId = url.searchParams.get('company_id');
      const carrierId = url.searchParams.get('carrier_id');
      const all = url.searchParams.get('all');

      let path = '/users?select=id,name,email,role,company_id,carrier_id,created_at,companies(name),carriers(name)&order=created_at.desc';
      if (companyId) path += `&company_id=eq.${companyId}`;
      if (carrierId) path += `&carrier_id=eq.${carrierId}`;

      const data = await sbQuery(path);
      // Never return password_hash
      const safe = data.map(u => { delete u.password_hash; return u; });
      return ok(safe);
    }

    // POST — criar usuário
    if (req.method === 'POST') {
      const { name, email, password, role, company_id, carrier_id } = await req.json();
      if (!name||!email||!password||!role) return err('Campos obrigatórios');
      if (password.length < 6) return err('Senha mínima 6 caracteres');

      const payload = { name, email: email.toLowerCase(), password_hash: hashPass(password), role };
      if (company_id) payload.company_id = company_id;
      if (carrier_id) payload.carrier_id = carrier_id;

      const res = await sbPost('/users', payload);
      if (!res.ok) {
        const e = await res.json();
        if (e.code === '23505') return err('Email já cadastrado', 409);
        return err(e.message || 'Erro ao criar usuário');
      }
      const created = await res.json();
      delete created[0]?.password_hash;
      return ok(created[0], 201);
    }

    // DELETE — remover usuário
    if (req.method === 'DELETE') {
      const userId = url.searchParams.get('id');
      if (!userId) return err('ID obrigatório');
      await sbDelete(`/users?id=eq.${userId}`);
      return ok({ success: true });
    }

    return err('Method not allowed', 405);
  } catch (e) {
    return err('Erro: ' + e.message, 500);
  }
}
