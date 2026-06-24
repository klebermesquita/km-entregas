// api/orders.js — CRUD de ordens
import { sbQuery, corsHeaders, ok, err } from './_supabase.js';

export const config = { runtime: 'edge' };

const URL_ = () => process.env.SUPABASE_URL;
const KEY_ = () => process.env.SUPABASE_SERVICE_KEY;

function headers(extra = {}) {
  return { 'Content-Type':'application/json','apikey':KEY_(),'Authorization':`Bearer ${KEY_()}`,'Prefer':'return=representation', ...extra };
}
async function sbPost(path, body) {
  const r = await fetch(`${URL_()}/rest/v1${path}`, { method:'POST', headers:headers(), body:JSON.stringify(body) });
  const d = await r.json(); if(!r.ok) throw new Error(d.message||'Error'); return Array.isArray(d)?d[0]:d;
}
async function sbPatch(path, body) {
  const r = await fetch(`${URL_()}/rest/v1${path}`, { method:'PATCH', headers:headers(), body:JSON.stringify(body) });
  return r.ok;
}
async function sbDel(path) {
  const r = await fetch(`${URL_()}/rest/v1${path}`, { method:'DELETE', headers:{'apikey':KEY_(),'Authorization':`Bearer ${KEY_()}`} });
  return r.ok;
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response('', { headers: corsHeaders() });

  try {
    const url = new URL(req.url);

    // GET
    if (req.method === 'GET') {
      const companyId = url.searchParams.get('company_id');
      const carrierId = url.searchParams.get('carrier_id');
      const driverId = url.searchParams.get('driver_id');
      const date = url.searchParams.get('date');
      const status = url.searchParams.get('status');
      const dateFrom = url.searchParams.get('date_from');
      const dateTo = url.searchParams.get('date_to');
      const id = url.searchParams.get('id');

      let path = '/orders?select=*,companies(name),carriers(name),users!orders_assigned_driver_id_fkey(name)&order=delivery_scheduled_date.desc';
      if (id) path = `/orders?id=eq.${id}&select=*,companies(name),carriers(name),users!orders_assigned_driver_id_fkey(name)`;
      else {
        if (companyId) path += `&company_id=eq.${companyId}`;
        if (carrierId) path += `&carrier_id=eq.${carrierId}`;
        if (driverId) path += `&assigned_driver_id=eq.${driverId}`;
        if (date) path += `&delivery_scheduled_date=eq.${date}`;
        if (status) path += `&status=eq.${status}`;
        if (dateFrom) path += `&delivery_scheduled_date=gte.${dateFrom}`;
        if (dateTo) path += `&delivery_scheduled_date=lte.${dateTo}`;
      }

      const data = await sbQuery(path);
      return ok(data);
    }

    // POST — criar ordem
    if (req.method === 'POST') {
      const body = await req.json();
      const { company_id, carrier_id, created_by, item_description, quantity,
              pickup_address, pickup_time, pickup_responsible,
              delivery_address, delivery_responsible,
              delivery_scheduled_time, delivery_scheduled_date } = body;

      if (!company_id||!carrier_id||!item_description||!quantity||!pickup_address||
          !pickup_time||!pickup_responsible||!delivery_address||!delivery_responsible||
          !delivery_scheduled_time||!delivery_scheduled_date) return err('Campos obrigatórios');

      const order = await sbPost('/orders', {
        company_id, carrier_id, created_by,
        item_description, quantity,
        pickup_address, pickup_time, pickup_responsible,
        delivery_address, delivery_responsible,
        delivery_scheduled_time, delivery_scheduled_date
      });
      return ok(order, 201);
    }

    // PATCH — atualizar ordem (coleta, entrega, arquivar, atribuir)
    if (req.method === 'PATCH') {
      const { id, ...updates } = await req.json();
      if (!id) return err('ID obrigatório');
      await sbPatch(`/orders?id=eq.${id}`, updates);
      return ok({ success: true });
    }

    // DELETE
    if (req.method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!id) return err('ID obrigatório');
      await sbDel(`/orders?id=eq.${id}`);
      return ok({ success: true });
    }

    return err('Not found', 404);
  } catch (e) {
    return err('Erro: ' + e.message, 500);
  }
}
