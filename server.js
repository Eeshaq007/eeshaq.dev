const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Fetch DuckDuckGo pages
app.get('/duck', async (req, res) => {
  const query = req.query.q || '';
  const url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(url);
    let text = await response.text();

    // Optional: Rewrite relative URLs to go through proxy
    text = text.replace(/href="\/\?/g, 'href="/duck?q=');
    text = text.replace(/src="\/\//g, 'src="https://');

    res.send(text);
  } catch (err) {
    res.status(500).send("Error fetching DuckDuckGo");
  }
});

app.listen(PORT, () => console.log(`DuckDuckGo proxy running on port ${PORT}`));
