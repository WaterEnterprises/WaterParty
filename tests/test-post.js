import http from 'http';
const data = JSON.stringify({ email: 'test@example.com', password: 'test' });
const req = http.request('http://localhost:3000/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
}, (res) => {
  let body = '';
  res.on('data', (d) => body += d);
  res.on('end', () => console.log('Response:', res.statusCode, body));
});
req.on('error', (e) => console.error(e));
req.write(data);
req.end();
