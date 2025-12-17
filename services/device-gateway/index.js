const http = require('http');

const PORT = process.env.PORT || 8082;

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', service: 'device-gateway' }));
  } else {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Device Gateway', version: '0.1.0' }));
  }
});

server.listen(PORT, () => {
  console.log(`Device gateway running on port ${PORT}`);
});

module.exports = server;
