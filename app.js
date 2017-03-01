const express = require('express');

const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('Hello there!');
});

app.get('/home', (req, res) => {
  res.send('You are on home page!');
});

app.get('/hello', (req, res) => {
  res.redirect('/');
});

app.listen(port, (err) => {
  if (err) {
    return console.log('Ooops!', err);
  }
  console.log('Server is listening on http://localhost:' + port);
});

// Handle not found errors
app.use((req, res) => {
  res.status(404).json({ message: 'URL not found', url: req.url });
});
