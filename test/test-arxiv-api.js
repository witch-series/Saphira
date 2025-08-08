const https = require('https');

const testUrl = 'https://export.arxiv.org/api/query?search_query=all:test&start=0&max_results=1';

console.log('Testing arXiv API URL:', testUrl);

const req = https.get(testUrl, (res) => {
  console.log('Status code:', res.statusCode);
  console.log('Headers:', res.headers);
  
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Response length:', data.length);
    console.log('First 1000 characters:', data.substring(0, 1000));
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.setTimeout(10000, () => {
  console.log('Request timed out');
  req.destroy();
});
