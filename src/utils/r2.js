const crypto = require('crypto');
const https  = require('https');
const http   = require('http');

const ACCOUNT_ID       = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY_ID    = process.env.R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY= process.env.R2_SECRET_ACCESS_KEY;
const PUBLIC_URL       = process.env.R2_PUBLIC_URL;
const BUCKET           = 'dob-live-images';
const ENDPOINT         = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;

function hmac(key, data, encoding) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest(encoding || 'hex');
}
function hash(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Upload a base64 image to R2.
 * Returns the public URL of the uploaded file.
 */
async function uploadImage(base64Data, mimeType, filename) {
  if (!ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
    throw new Error('R2 credentials not configured');
  }

  // Strip data URI prefix if present
  const base64 = base64Data.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');

  const now    = new Date();
  const date   = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 8);
  const amzDate= now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z';

  const key    = `entries/${date}/${filename}`;
  const method = 'PUT';
  const host   = `${ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const path   = `/${BUCKET}/${key}`;

  const payloadHash = hash(buffer);

  const headers = {
    'content-type':        mimeType || 'image/jpeg',
    'content-length':      String(buffer.length),
    'host':                host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date':          amzDate,
  };

  // Canonical request
  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers).sort().map(k => `${k}:${headers[k]}\n`).join('');
  const canonicalRequest = [method, path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');

  // String to sign
  const credentialScope = `${date}/auto/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, hash(canonicalRequest)].join('\n');

  // Signing key
  const signingKey = hmac(hmac(hmac(hmac('AWS4' + SECRET_ACCESS_KEY, date), 'auto'), 's3'), 'aws4_request', null);
  const signature  = hmac(signingKey, stringToSign);

  const authHeader = `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return new Promise((resolve, reject) => {
    const url    = new URL(ENDPOINT + path);
    const module = url.protocol === 'https:' ? https : http;
    const reqOpts = {
      hostname: url.hostname,
      path:     url.pathname,
      method,
      headers: {
        ...headers,
        'Authorization': authHeader,
      }
    };
    const req = module.request(reqOpts, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(`${PUBLIC_URL}/${key}`);
        } else {
          reject(new Error(`R2 upload failed: ${res.statusCode} ${body}`));
        }
      });
    });
    req.on('error', reject);
    req.write(buffer);
    req.end();
  });
}

module.exports = { uploadImage };
