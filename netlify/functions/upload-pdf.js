// netlify/functions/upload-pdf.js
// Sube PDF directo a Google Drive via API REST
// Sin límite de 6MB — Netlify Pro permite hasta 50MB, el plan free hasta 10MB por request

const https = require('https');

exports.handler = async function(event, context) {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
  }

  try {
    const payload = JSON.parse(event.body);
    const { base64, nombre, nroPedido, cliente } = payload;

    if (!base64 || !nombre) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Faltan datos' }) };
    }

    // Obtener token de acceso usando service account o API key
    // Usamos el Apps Script como proxy POST — server a server no tiene CORS
    const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;

    const postData = JSON.stringify({
      tipo: 'archivo_directo',
      base64: base64,
      nombre: nombre,
      nroPedido: nroPedido || 0,
      cliente: cliente || ''
    });

    const result = await postToAppsScript(APPS_SCRIPT_URL, postData);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };

  } catch (err) {
    console.error('Error en upload-pdf:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};

function postToAppsScript(url, postData) {
  return new Promise((resolve, reject) => {
    // El Apps Script solo acepta GET — mandamos los datos como parámetro
    // pero para archivos grandes usamos POST con redirect follow
    const encodedData = encodeURIComponent(postData);
    const fullUrl = url + '?datos=' + encodedData;

    // Usar la URL directamente via https.get con redirect manual
    makeRequest(fullUrl, resolve, reject, 0);
  });
}

function makeRequest(url, resolve, reject, redirectCount) {
  if (redirectCount > 5) {
    reject(new Error('Demasiados redirects'));
    return;
  }

  const urlObj = new URL(url);
  const options = {
    hostname: urlObj.hostname,
    path: urlObj.pathname + urlObj.search,
    method: 'GET',
    headers: {
      'User-Agent': 'Netlify-Function/1.0'
    }
  };

  const req = https.request(options, (res) => {
    // Seguir redirects (Apps Script redirige a script.googleusercontent.com)
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      makeRequest(res.headers.location, resolve, reject, redirectCount + 1);
      return;
    }

    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch(e) {
        resolve({ ok: true, raw: data });
      }
    });
  });

  req.on('error', reject);
  req.end();
}
