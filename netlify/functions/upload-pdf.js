const https = require('https');

function httpsPost(hostname, path, data) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    const req = https.request(options, (res) => {
      let body = '';
      console.log(`${hostname} status: ${res.statusCode}`);
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        const loc = new URL(res.headers.location);
        console.log('Following redirect to:', loc.hostname + loc.pathname);
        return httpsPost(loc.hostname, loc.pathname + loc.search, data).then(resolve).catch(reject);
      }
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log('Response:', body.substring(0, 300));
        try { resolve(JSON.parse(body)); }
        catch(e) { resolve({ ok: true, raw: body.substring(0, 100) }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(55000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(data);
    req.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body);
    const { base64, nombre, nroPedido, cliente } = body;
    
    console.log('File:', nombre, 'Base64 length:', base64 ? base64.length : 0);

    if (!base64 || !nombre) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Faltan datos' }) };
    }

    const SCRIPT_URL = new URL(process.env.APPS_SCRIPT_URL);
    
    const payload = JSON.stringify({
      tipo: 'archivo_directo',
      base64,
      nombre,
      nroPedido: nroPedido || 0,
      cliente: cliente || 'Sin nombre'
    });

    console.log('Payload size:', payload.length);

    const result = await httpsPost(SCRIPT_URL.hostname, SCRIPT_URL.pathname, payload);
    console.log('Final result:', JSON.stringify(result).substring(0, 200));

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' },
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
