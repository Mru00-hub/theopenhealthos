const http = require('http');

const PORT = process.env.PORT || 8083;

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', service: 'cdss-engine' }));
  } else {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'CDSS Engine', version: '0.1.0' }));
  }
});

server.listen(PORT, () => {
  console.log(`CDSS engine running on port ${PORT}`);
});

module.exports = server;
