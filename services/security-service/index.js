const http = require('http');

const PORT = process.env.PORT || 8081;

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', service: 'security-service' }));
  } else {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Security Service', version: '0.1.0' }));
  }
});

server.listen(PORT, () => {
  console.log(`Security service running on port ${PORT}`);
});

module.exports = server;
