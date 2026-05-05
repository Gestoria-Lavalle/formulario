const https = require('https');

exports.handler = async (event) => {
  console.log('Function called, method:', event.httpMethod);
  
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body);
    const { base64, nombre, nroPedido, cliente } = body;
    
    console.log('Received file:', nombre, 'Base64 length:', base64 ? base64.length : 0);

    if (!base64 || !nombre) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ ok: false, error: 'Faltan datos' }) 
      };
    }

    const SCRIPT_URL = process.env.APPS_SCRIPT_URL;
    
    const payload = JSON.stringify({
      tipo: 'archivo_directo',
      base64: base64,
      nombre: nombre,
      nroPedido: nroPedido || 0,
      cliente: cliente || 'Sin nombre'
    });

    console.log('Payload size:', payload.length, 'bytes');

    const url = new URL(SCRIPT_URL);
    const postData = payload;

    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        console.log('Response status:', res.statusCode);
        
        // Follow redirects
        if (res.statusCode === 302 || res.statusCode === 301) {
          const redirectUrl = new URL(res.headers.location);
          console.log('Redirecting to:', redirectUrl.hostname);
          
          const redirReq = https.request({
            hostname: redirectUrl.hostname,
            path: redirectUrl.pathname + redirectUrl.search,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData)
            }
          }, (redirRes) => {
            let redirData = '';
            redirRes.on('data', chunk => redirData += chunk);
            redirRes.on('end', () => {
              console.log('Redirect response:', redirData.substring(0, 200));
              try { resolve(JSON.parse(redirData)); }
              catch(e) { resolve({ ok: true }); }
            });
          });
          redirReq.on('error', reject);
          redirReq.write(postData);
          redirReq.end();
          return;
        }
        
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          console.log('Response data:', data.substring(0, 200));
          try { resolve(JSON.parse(data)); }
          catch(e) { resolve({ ok: true }); }
        });
      });
      
      req.on('error', (err) => {
        console.error('Request error:', err.message);
        reject(err);
      });
      
      req.setTimeout(55000, () => { 
        req.destroy(); 
        reject(new Error('Timeout')); 
      });
      
      req.write(postData);
      req.end();
    });

    console.log('Result:', JSON.stringify(result).substring(0, 200));

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
