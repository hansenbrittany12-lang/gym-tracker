const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

const server = http.createServer(function(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache'
  });
  fs.createReadStream(path.join(__dirname, 'index.html')).pipe(res);
});

server.listen(PORT, '0.0.0.0', function() {
  console.log('Server running on port ' + PORT);
});
