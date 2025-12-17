const http = require('http');

const PORT = process.env.PORT || 8000;

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', service: 'api-gateway' }));
  } else {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'API Gateway', version: '0.1.0' }));
  }
});

server.listen(PORT, () => {
  console.log(`API gateway running on port ${PORT}`);
});

module.exports = server;
