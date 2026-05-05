const https = require('https');

exports.handler = async (event) => {
  console.log('Function called, method:', event.httpMethod);
  
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body);
    const { base64, nombre, nroPedido, cliente } = body;
    
    console.log('Received file:', nombre, 'for pedido:', nroPedido, 'cliente:', cliente);
    console.log('Base64 length:', base64 ? base64.length : 0);

    if (!base64 || !nombre) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ ok: false, error: 'Faltan datos' }) 
      };
    }

    const SCRIPT_URL = process.env.APPS_SCRIPT_URL;
    console.log('Script URL configured:', !!SCRIPT_URL);
    
    const payload = JSON.stringify({
      tipo: 'archivo_directo',
      base64: base64,
      nombre: nombre,
      nroPedido: nroPedido || 0,
      cliente: cliente || 'Sin nombre'
    });

    console.log('Sending to Apps Script, payload size:', payload.length);

    const result = await new Promise((resolve, reject) => {
      const encodedPayload = encodeURIComponent(payload);
      const fullUrl = SCRIPT_URL + '?datos=' + encodedPayload;
      const url = new URL(fullUrl);
      
      const req = https.get({
        hostname: url.hostname,
        path: url.pathname + url.search,
        headers: { 'Content-Type': 'application/json' }
      }, (res) => {
        let data = '';
        console.log('Response status:', res.statusCode);
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          console.log('Response data:', data.substring(0, 200));
          try { resolve(JSON.parse(data)); }
          catch(e) { resolve({ ok: true, raw: data.substring(0, 100) }); }
        });
      });
      
      req.on('error', (err) => {
        console.error('Request error:', err.message);
        reject(err);
      });
      req.setTimeout(55000, () => { 
        console.error('Request timeout');
        req.destroy(); 
        reject(new Error('Timeout')); 
      });
    });

    console.log('Result:', JSON.stringify(result));

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify(result)
    };

  } catch (err) {
    console.error('Error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};
