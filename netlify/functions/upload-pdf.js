const https = require('https');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body);
    const { base64, nombre, nroPedido, cliente } = body;

    if (!base64 || !nombre) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ ok: false, error: 'Faltan datos' }) 
      };
    }

    // Send to Google Apps Script
    const SCRIPT_URL = process.env.APPS_SCRIPT_URL;
    
    const payload = JSON.stringify({
      tipo: 'archivo_directo',
      base64: base64,
      nombre: nombre,
      nroPedido: nroPedido || 0,
      cliente: cliente || 'Sin nombre'
    });

    const result = await new Promise((resolve, reject) => {
      const url = new URL(SCRIPT_URL + '?datos=' + encodeURIComponent(payload));
      
      const req = https.get({
        hostname: url.hostname,
        path: url.pathname + url.search,
        headers: { 'Content-Type': 'application/json' }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch(e) { resolve({ ok: true }); }
        });
      });
      
      req.on('error', reject);
      req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
    });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify(result)
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};
