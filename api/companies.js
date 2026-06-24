// api/companies.js — CRUD de empresas e transportadoras
import { sbQuery, corsHeaders, ok, err } from './_supabase.js';

export const config = { runtime: 'edge' };

const URL_ = () => process.env.SUPABASE_URL;
const KEY_ = () => process.env.SUPABASE_SERVICE_KEY;

function headers() {
  return { 'Content-Type':'application/json','apikey':KEY_(),'Authorization':`Bearer ${KEY_()}`,'Prefer':'return=representation' };
}

async function sbPost(path, body) {
  const r = await fetch(`${URL_()}/rest/v1${path}`, { method:'POST', headers:headers(), body:JSON.stringify(body) });
  const d = await r.json(); if(!r.ok) throw new Error(d.message||'Error'); return d;
}
async function sbPatch(path, body) {
  const r = await fetch(`${URL_()}/rest/v1${path}`, { method:'PATCH', headers:headers(), body:JSON.stringify(body) });
  return r.ok;
}
async function sbDelete(path) {
  const r = await fetch(`${URL_()}/rest/v1${path}`, { method:'DELETE', headers:{'apikey':KEY_(),'Authorization':`Bearer ${KEY_()}`} });
  return r.ok;
}
function hashPass(p) {
  let h=0; for(let i=0;i<p.length;i++){h=((h<<5)-h)+p.charCodeAt(i);h|=0;} return 'h_'+Math.abs(h).toString(36)+p.length;
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response('', { headers: corsHeaders() });

  try {
    const url = new URL(req.url);
    const type = url.searchParams.get('type') || 'company'; // company | carrier
    const action = url.searchParams.get('action');

    // GET
    if (req.method === 'GET') {
      if (type === 'company') {
        const data = await sbQuery('/companies?select=*&order=created_at.desc');
        return ok(data);
      }
      if (type === 'carrier') {
        const data = await sbQuery('/carriers?select=*&order=created_at.desc');
        return ok(data);
      }
      if (type === 'company_carriers') {
        const companyId = url.searchParams.get('company_id');
        const data = await sbQuery(`/company_carriers?company_id=eq.${companyId}&select=*,carriers(*)`);
        return ok(data);
      }
    }

    // POST — criar empresa ou transportadora
    if (req.method === 'POST') {
      const body = await req.json();

      if (type === 'company') {
        const { name, document, address, contact_name, contact_whatsapp, contact_email, admin_password, admin_name } = body;
        if (!name||!document||!address||!contact_name||!contact_whatsapp||!contact_email||!admin_password||!admin_name) return err('Campos obrigatórios');
        const company = await sbPost('/companies', { name, document, address, contact_name, contact_whatsapp, contact_email });
        await sbPost('/users', { email: contact_email.toLowerCase(), password_hash: hashPass(admin_password), name: admin_name, role: 'admin_empresa', company_id: company[0].id });
        return ok(company[0], 201);
      }

      if (type === 'carrier') {
        const { name, document, contact_name, contact_whatsapp, contact_email, admin_password, admin_name } = body;
        if (!name||!document||!contact_name||!contact_whatsapp||!contact_email||!admin_password||!admin_name) return err('Campos obrigatórios');
        const carrier = await sbPost('/carriers', { name, document, contact_name, contact_whatsapp, contact_email });
        await sbPost('/users', { email: contact_email.toLowerCase(), password_hash: hashPass(admin_password), name: admin_name, role: 'admin_transportadora', carrier_id: carrier[0].id });
        return ok(carrier[0], 201);
      }

      if (type === 'link_carrier') {
        const { company_id, carrier_id } = body;
        const data = await sbPost('/company_carriers', { company_id, carrier_id });
        return ok(data[0], 201);
      }
    }

    // PATCH — ativar/desativar
    if (req.method === 'PATCH') {
      const { id, active, delegation_mode } = await req.json();
      const table = type === 'company' ? 'companies' : 'carriers';
      const patch = {};
      if (active !== undefined) patch.active = active;
      if (delegation_mode !== undefined) patch.delegation_mode = delegation_mode;
      await sbPatch(`/${table}?id=eq.${id}`, patch);
      return ok({ success: true });
    }

    // DELETE
    if (req.method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (type === 'company') {
        await sbDelete(`/orders?company_id=eq.${id}`);
        await sbDelete(`/users?company_id=eq.${id}`);
        await sbDelete(`/company_carriers?company_id=eq.${id}`);
        await sbDelete(`/companies?id=eq.${id}`);
      } else if (type === 'carrier') {
        await sbDelete(`/users?carrier_id=eq.${id}`);
        await sbDelete(`/company_carriers?carrier_id=eq.${id}`);
        await sbDelete(`/carriers?id=eq.${id}`);
      } else if (type === 'link_carrier') {
        await sbDelete(`/company_carriers?id=eq.${id}`);
      }
      return ok({ success: true });
    }

    return err('Not found', 404);
  } catch (e) {
    return err('Erro: ' + e.message, 500);
  }
}
