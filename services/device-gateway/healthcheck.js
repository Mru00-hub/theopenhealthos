const http = require('http');

const options = {
  host: 'localhost',
  port: process.env.PORT || 8082,
  path: '/health',
  timeout: 2000,
};

const healthCheck = http.request(options, (res) => {
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

healthCheck.on('error', () => {
  process.exit(1);
});

healthCheck.end();
