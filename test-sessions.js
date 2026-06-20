const http = require('http');

http.get('http://localhost:5237/api/Sessions/active?pageSize=5', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log(data);
  });
});
