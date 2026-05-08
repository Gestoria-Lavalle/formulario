exports.handler = async () => {
  return {
    statusCode: 200,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ 
      apiKey: process.env.GOOGLE_API_KEY 
    })
  };
};
