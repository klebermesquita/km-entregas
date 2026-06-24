// api/upload.js — upload seguro de fotos via servidor
export const config = { runtime: 'edge' };

import { corsHeaders, ok, err } from './_supabase.js';

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response('', { headers: corsHeaders() });
  if (req.method !== 'POST') return err('Method not allowed', 405);

  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const orderId = formData.get('order_id');

    if (!file || !orderId) return err('Arquivo e order_id obrigatórios');

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

    const fileName = `${orderId}_${Date.now()}.jpg`;
    const arrayBuffer = await file.arrayBuffer();

    const uploadRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/delivery-photos/${fileName}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': file.type || 'image/jpeg',
          'x-upsert': 'true'
        },
        body: arrayBuffer
      }
    );

    if (!uploadRes.ok) {
      const e = await uploadRes.json();
      return err('Erro no upload: ' + (e.message || 'desconhecido'), 500);
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/delivery-photos/${fileName}`;
    return ok({ url: publicUrl });
  } catch (e) {
    return err('Erro: ' + e.message, 500);
  }
}
