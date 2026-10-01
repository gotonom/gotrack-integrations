// Receive and verify GoTrack webhooks — Node.js, no dependencies.
//
//   GOTRACK_WEBHOOK_SECRET=... node server.js      # listens on :8080
const http = require('node:http');
const crypto = require('node:crypto');

const SECRET = process.env.GOTRACK_WEBHOOK_SECRET;

// `X-GoTrack-Signature` is 'sha256=' + hex HMAC-SHA256 of the RAW body.
function verify(rawBody, signatureHeader) {
  const expected = 'sha256=' + crypto.createHmac('sha256', SECRET).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader || '');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const raw = Buffer.concat(chunks);
    if (req.method !== 'POST' || !verify(raw, req.headers['x-gotrack-signature'])) {
      res.writeHead(401).end();
      return;
    }
    const event = JSON.parse(raw.toString('utf8'));
    // Answer first, work afterwards: GoTrack waits at most 8 seconds.
    res.writeHead(204).end();
    if (event.type === 'pickup' || event.type === 'multiple_pickup') {
      console.log(`${event.timestamp} picked up ${event.product_name} (${event.color}) in zone ${event.rack_zone}`);
    } else if (event.type === 'return') {
      console.log(`${event.timestamp} put back ${event.product_name}`);
    } else {
      console.log(event.type, event);
    }
  });
}).listen(8080);
