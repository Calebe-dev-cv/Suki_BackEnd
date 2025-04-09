const express = require("express");
const cors = require("cors");
const axios = require("axios");
const NodeCache = require("node-cache");
const app = express();
const PORT = 5000;
const cache = new NodeCache({ stdTTL: 600 });
const GOOGLE_TRANSLATE_API_KEY = 'AIzaSyBH1TNDb25x_z6p2CFs5dCXA_Q5o1ZZr6A';
require('dotenv').config();

const mangadexAuth = require('./mangadexAuth');


app.use(cors({
  origin: ['http://34.95.174.88:3000', 'http://localhost:3000', 'http://localhost:4000', 'http://34.95.174.88:4000', 'https://sukisekai.com', 'https://api-anime.sukisekai.com'],
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Range', 'Authorization', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges'],
  credentials: true
}));

app.use(express.json());

const API_BASE_URL = "http://localhost:4000";

const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI("AIzaSyDPMkJDUEq5rDZ51GU9bQkj14Cn8hUipyE");

app.get("/", (req, res) => {
  res.send("Servidor rodando. Rotas disponíveis: /api/animes/search, /api/animes/populares, /api/genres/list, /api/genres/:genre e /proxy.");
})



app.get("/video-proxy", async (req, res) => {
  const videoUrl = req.query.url;

  if (!videoUrl) {
    return res.status(400).json({ error: "URL do vídeo é obrigatória." });
  }

  try {
    res.setHeader('Accept-Ranges', 'bytes');

    const headResponse = await axios({
      method: 'HEAD',
      url: videoUrl,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://animefire.plus/'
      }
    });

    const contentLength = headResponse.headers['content-length'];
    const contentType = headResponse.headers['content-type'] || 'video/mp4';

    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : contentLength - 1;
      const chunksize = (end - start) + 1;

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${contentLength}`);
      res.setHeader('Content-Length', chunksize);
      res.setHeader('Content-Type', contentType);

      const videoResponse = await axios({
        method: 'GET',
        url: videoUrl,
        headers: {
          'Range': `bytes=${start}-${end}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Referer': 'https://animefire.plus/'
        },
        responseType: 'stream'
      });

      videoResponse.data.pipe(res);
    } else {

      res.setHeader('Content-Length', contentLength);
      res.setHeader('Content-Type', contentType);

      const videoResponse = await axios({
        method: 'GET',
        url: videoUrl,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Referer': 'https://animefire.plus/'
        },
        responseType: 'stream'
      });

      videoResponse.data.pipe(res);
    }
  } catch (error) {
    console.error("Erro no proxy de vídeo:", error.message);
    res.status(500).json({ error: "Erro ao processar o vídeo" });
  }
});

app.get("/mangadex-image", async (req, res) => {
  const imageUrl = req.query.url;

  if (!imageUrl) {
    return res.status(400).send("URL da imagem é obrigatória.");
  }

  try {
    // Primeiro buscar a página inicial para obter cookies de sessão válidos
    const sessionResponse = await axios.get('https://mangadex.org/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
      },
      maxRedirects: 5
    });

    // Extrair cookies
    const sessionCookies = sessionResponse.headers['set-cookie'];

    // Agora buscar a imagem com os cookies de sessão
    const response = await axios({
      method: 'GET',
      url: imageUrl,
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
        'Referer': 'https://mangadex.org/',
        'Origin': 'https://mangadex.org',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Fetch-Site': 'cross-site',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Dest': 'image',
        'Cache-Control': 'no-cache',
        'Cookie': sessionCookies?.join('; ') || 'mangadex_session=1'
      }
    });

    if (response.headers['content-type']) {
      res.setHeader('Content-Type', response.headers['content-type']);
    }

    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(response.data);
  } catch (error) {
    console.error("Erro ao carregar imagem MangaDex:", error.message);
    res.redirect(imageUrl);
  }
});

app.get("/proxy", async (req, res) => {
  const imageUrl = req.query.url;
  const refererUrl = req.query.referer || 'https://mangadex.org/';

  if (!imageUrl) {
    console.error("Erro no proxy: URL não fornecida");
    return res.status(400).send("URL da imagem é obrigatória.");
  }

  try {
    const response = await axios({
      method: 'GET',
      url: imageUrl,
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7',
        'Referer': refererUrl,
        'Origin': 'https://mangadex.org',
        'Sec-Fetch-Dest': 'image',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'cross-site',
        'Cache-Control': 'no-cache'
      },
      timeout: 15000,
      maxRedirects: 5
    });

    if (response.headers['content-type']) {
      res.setHeader('Content-Type', response.headers['content-type']);
    } else {
      const extension = imageUrl.split('.').pop().toLowerCase();
      if (['jpg', 'jpeg'].includes(extension)) {
        res.setHeader('Content-Type', 'image/jpeg');
      } else if (extension === 'png') {
        res.setHeader('Content-Type', 'image/png');
      } else if (extension === 'gif') {
        res.setHeader('Content-Type', 'image/gif');
      } else if (extension === 'webp') {
        res.setHeader('Content-Type', 'image/webp');
      } else {
        res.setHeader('Content-Type', 'application/octet-stream');
      }
    }

    res.setHeader('Cache-Control', 'public, max-age=86400');

    res.send(response.data);
  } catch (error) {
    console.error("Erro detalhado ao buscar imagem:", {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: imageUrl
    });

    res.status(error.response?.status || 500).send("Erro ao carregar imagem");
  }
});

app.get("/proxy-alt", async (req, res) => {
  const imageUrl = req.query.url;

  if (!imageUrl) {
    return res.status(400).send("URL da imagem é obrigatória.");
  }


  try {
    const config = {
      method: 'GET',
      url: imageUrl,
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://mangadex.org/',
        'Origin': 'https://mangadex.org',
        'Sec-Fetch-Dest': 'image',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'cross-site',
        'Cache-Control': 'no-cache'
      },
      timeout: 15000,
      maxRedirects: 5
    };

    const response = await axios(config);

    if (response.headers['content-type']) {
      res.setHeader('Content-Type', response.headers['content-type']);
    } else {
      const extension = imageUrl.split('.').pop().toLowerCase();
      if (['jpg', 'jpeg'].includes(extension)) {
        res.setHeader('Content-Type', 'image/jpeg');
      } else if (extension === 'png') {
        res.setHeader('Content-Type', 'image/png');
      } else if (extension === 'gif') {
        res.setHeader('Content-Type', 'image/gif');
      } else if (extension === 'webp') {
        res.setHeader('Content-Type', 'image/webp');
      } else {
        res.setHeader('Content-Type', 'application/octet-stream');
      }
    }

    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(response.data);
  } catch (error) {
    console.error("Erro detalhado no proxy alternativo:", {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      url: imageUrl
    });

    try {
      res.setHeader('Content-Type', 'text/html');
      res.send(`
        <html>
          <head>
            <meta http-equiv="refresh" content="0;url=${imageUrl}">
            <style>
              body { margin: 0; padding: 0; }
              img { max-width: 100%; height: auto; }
            </style>
          </head>
          <body>
            <img src="${imageUrl}" alt="Manga Image">
            <p>Se a imagem não aparecer, <a href="${imageUrl}" target="_blank">clique aqui</a>.</p>
          </body>
        </html>
      `);
    } catch (fallbackError) {
      res.status(500).send(`Não foi possível carregar a imagem: ${error.message}`);
    }
  }
});

app.get("/api/genres/list", async (req, res) => {
  try {
    const cacheKey = "genres_list";
    let cachedData = cache.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    try {

      const html = await axios.get('https://animefire.plus/', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });


      const $ = require('cheerio').load(html.data);
      const genres = [];


      $('a.dropdown-item[href*="/genero/"]').each((i, element) => {
        const genre = $(element).text().trim();
        if (genre && !genres.includes(genre)) {
          genres.push(genre);
        }
      });

      if (genres.length > 0) {
        cache.set(cacheKey, genres);
        return res.json(genres);
      }
    } catch (error) {
      console.error("Erro ao buscar lista de gêneros:", error);
    }


    const fallbackGenres = [
      "Ação", "Artes Marciais", "Aventura", "Comédia", "Demônios",
      "Drama", "Ecchi", "Espaço", "Esporte", "Fantasia",
      "Ficção Científica", "Harém", "Horror", "Jogos", "Josei",
      "Magia", "Mecha", "Mistério", "Militar", "Musical",
      "Paródia", "Psicológico", "Romance", "Seinen", "Shoujo",
      "Shounen", "Slice of Life", "Sobrenatural", "Suspense",
      "Superpoder", "Vampiros", "Vida Escolar"
    ];

    cache.set(cacheKey, fallbackGenres);
    return res.json(fallbackGenres);
  } catch (error) {
    console.error("Erro ao buscar lista de gêneros:", error);
    res.status(500).json({ error: "Erro ao buscar lista de gêneros." });
  }
});

app.get("/api/genres/:genre", async (req, res) => {
  const { genre } = req.params;
  const { page = 1 } = req.query;

  if (!genre) {
    return res.status(400).json({ error: "Gênero é obrigatório." });
  }

  try {
    const cacheKey = `genre_${genre}_page_${page}`;
    let cachedData = cache.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    try {

      const apiUrl = `${API_BASE_URL}/api/genres/${encodeURIComponent(genre)}?page=${page}`;

      const response = await axios.get(apiUrl);

      if (response.data && Array.isArray(response.data)) {
        const formattedResults = response.data.map(anime => ({
          id: anime.id,
          title: anime.name || anime.title,
          image: anime.image,
          releaseDate: anime.releaseDate || anime.year || "",
          genres: anime.genres || [genre],
          score: anime.score,
          ageRating: anime.ageRating
        }));

        cache.set(cacheKey, formattedResults);
        return res.json(formattedResults);
      } else {
        return res.json([]);
      }
    } catch (error) {
      console.error(`Erro ao buscar animes do gênero ${genre} página ${page}:`, error);


      if (parseInt(page) === 1) {
        try {
          const fallbackUrl = `${API_BASE_URL}/api/genres/${encodeURIComponent(genre)}`;

          const fallbackResponse = await axios.get(fallbackUrl);

          if (fallbackResponse.data && Array.isArray(fallbackResponse.data)) {
            const formattedResults = fallbackResponse.data.map(anime => ({
              id: anime.id,
              title: anime.name || anime.title,
              image: anime.image,
              releaseDate: anime.releaseDate || anime.year || "",
              genres: anime.genres || [genre],
              score: anime.score,
              ageRating: anime.ageRating
            }));

            cache.set(cacheKey, formattedResults);
            return res.json(formattedResults);
          }
        } catch (fallbackError) {
          console.error("Erro na tentativa de fallback:", fallbackError);
        }
      }
    }


    return res.json([]);
  } catch (error) {
    res.status(500).json({ error: `Erro ao buscar animes do gênero ${genre}.` });
  }
});


app.get("/api/animes/search", async (req, res) => {
  const { query, page = 1 } = req.query;
  if (!query) return res.status(400).json({ error: "Parâmetro 'query' é obrigatório." });

  try {
    const cacheKey = `search_${query}_${page}`;
    let cachedData = cache.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    try {
      const response = await axios.get(`${API_BASE_URL}/api/search?q=${encodeURIComponent(query)}`);

      if (response.data && response.data.results && response.data.results.length > 0) {
        const formattedResults = await Promise.all(response.data.results.map(async anime => {
          try {
            const detailsResponse = await axios.get(`${API_BASE_URL}/api/anime?id=${anime.id}`);

            return {
              id: anime.id,
              title: anime.name,
              image: anime.image,
              releaseDate: detailsResponse.data.year || "",
              description: detailsResponse.data.synopsis || "",
              genres: detailsResponse.data.categories || [],
              score: detailsResponse.data.score || "",
              ageRating: anime.ageRating,
            };
          } catch (error) {
            return {
              id: anime.id,
              title: anime.name,
              image: anime.image,
              releaseDate: "",
              genres: [],
              score: anime.score,
              ageRating: anime.ageRating,
            };
          }
        }));

        cache.set(cacheKey, formattedResults);
        return res.json(formattedResults);
      }
    } catch (error) {
      console.error(`Erro ao buscar animes para "${query}":`, error);
    }

    return res.json([]);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar animes. Tente novamente mais tarde." });
  }
});




app.post("/api/chat", async (req, res) => {
  const { message, userData, availableAnimes, availableMangasTags, availableMangasGenres, availableGenres } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Mensagem é obrigatória." });
  }

  try {

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });


    let watchedAnimes = "Nenhum anime assistido ainda.";
    if (userData && userData.watchedAnimes && userData.watchedAnimes.length > 0) {
      watchedAnimes = userData.watchedAnimes
        .map(anime => anime.title)
        .join(", ");
    }

    let favoriteAnimes = "Nenhum anime favorito ainda.";
    if (userData && userData.favoriteAnimes && userData.favoriteAnimes.length > 0) {
      favoriteAnimes = userData.favoriteAnimes
        .map(anime => anime.title)
        .join(", ");
    }


    let readManga = "Nenhum mangá lido ainda.";
    if (userData && userData.readManga && userData.readManga.length > 0) {
      readManga = userData.readManga
        .map(manga => manga.title)
        .join(", ");
    }

    let favoriteManga = "Nenhum mangá favorito ainda.";
    if (userData && userData.favoriteManga && userData.favoriteManga.length > 0) {
      favoriteManga = userData.favoriteManga
        .map(manga => manga.title)
        .join(", ");
    }


    let popularAnimesText = "";
    if (availableAnimes && availableAnimes.length > 0) {
      const topAnimes = availableAnimes.slice(0, 20);
      popularAnimesText = topAnimes
        .map(anime => {
          const genres = anime.genres && anime.genres.length > 0
            ? `(${anime.genres.join(", ")})`
            : "";
          return `${anime.title} ${genres}`;
        })
        .join("; ");
    }


    let genresText = "Gêneros não disponíveis.";
    if (availableGenres && availableGenres.length > 0) {
      genresText = availableGenres.join(", ");
    }


    let mangaGenresText = "Gêneros de mangá não disponíveis.";
    if (availableMangasGenres && availableMangasGenres.length > 0) {
      mangaGenresText = availableMangasGenres.join(", ");
    }

    const currentDate = new Date().toLocaleDateString('pt-BR');


    const systemPrompt = `
    Você é Suki, "dona" do site de animes Suki Sekai, que é este, ele é o seu mundo de Animes e Mangás,você é especializada em animes e mangás, no momento trabalhando para um site de streaming de animes e leitura de mangás(Suki Sekai).

    INFORMAÇÕES DO USUÁRIO:
    - Animes que o usuário já assistiu: ${watchedAnimes}
    - Animes favoritos do usuário: ${favoriteAnimes}
    - Mangás que o usuário já leu: ${readManga}
    - Mangás favoritos do usuário: ${favoriteManga}

    CONTEXTO:
    - Animes populares disponíveis: ${popularAnimesText}
    - Gêneros de anime disponíveis: ${genresText}
    - Gêneros de mangá disponíveis: ${mangaGenresText}

    INSTRUÇÕES:
    1. Seja amigável, informal e use emoji ocasionalmente para parecer mais humana.
    2. Responda perguntas sobre animes E mangás, recomende baseados nos gostos do usuário e mencione títulos populares quando relevante.
    3. Se perguntado sobre datas de lançamento de novas temporadas ou capítulos, dê uma estimativa realista baseada nas informações disponíveis publicamente.
    4. Se não souber uma resposta específica, seja honesta e sugira onde o usuário pode encontrar a informação.
    5. Você pode responder perguntas sobre detalhes de animes/mangás populares, comparações entre obras, e explicar gêneros.
    6. Quando recomendar, tente sugerir 3-5 títulos relevantes e explique brevemente por que o usuário pode gostar deles.
    7. Você pode responder sobre animes e mangás +18, inclusive indica-los.
    8. Seja direta e concisa, evite respostas muito longas.
    9. Quando mencionar um anime ou mangá, use seu título oficial ou o mais conhecido.
    10. Diferencie quando está falando de animes ou mangás nas suas recomendações e respostas.

    Responda à seguinte mensagem do usuário:
    `;


    const generationConfig = {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 800,
    };


    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: systemPrompt + message }] }],
      generationConfig,
    });

    const response = result.response;
    const text = response.text();

    return res.json({
      response: text,
      success: true
    });

  } catch (error) {
    console.error("Erro ao processar mensagem no chat:", error);
    return res.status(500).json({
      error: "Ocorreu um erro ao processar sua mensagem.",
      details: error.message
    });
  }
});

app.get("/api/animes/populares", async (req, res) => {
  const { page = 1, genres, classificacao } = req.query;
  const genresList = genres ? genres.split(',') : [];

  try {

    const classificacaoParam = classificacao ? `_classificacao_${classificacao}` : '';
    const cacheKey = genresList.length > 0
      ? `top_animes_${page}_genres_${genres}${classificacaoParam}`
      : `top_animes_${page}${classificacaoParam}`;

    let cachedData = cache.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    try {

      const ageRatings = ['L', 'A10', 'A14', 'A16', 'A18'];

      if (classificacao && ageRatings.includes(classificacao)) {


        const params = { page: page };
        if (classificacao) {
          params.classificacao = classificacao;
        }


        const response = await axios.get(`${API_BASE_URL}/api/top-animes`, { params });

        if (response.data && Array.isArray(response.data)) {
          const formattedResults = response.data.map(anime => ({
            id: anime.id,
            title: anime.name,
            image: anime.image,
            releaseDate: "",
            genres: [],
            ageRating: anime.ageRating || classificacao,
            score: anime.score
          }));

          cache.set(cacheKey, formattedResults);
          return res.json(formattedResults);
        }
      } else {

        const response = await axios.get(`${API_BASE_URL}/api/top-animes`, {
          params: { page: page }
        });

        if (response.data && Array.isArray(response.data)) {
          const formattedResults = response.data.map(anime => ({
            id: anime.id,
            title: anime.name,
            image: anime.image,
            releaseDate: "",
            genres: [],
            ageRating: anime.ageRating,
            score: anime.score
          }));


          const filteredResults = genresList.length > 0
            ? formattedResults.filter(anime =>
              anime.genres && genresList.some(genre =>
                anime.genres.some(g => g.toLowerCase() === genre.toLowerCase())
              )
            )
            : formattedResults;

          cache.set(cacheKey, filteredResults);
          return res.json(filteredResults);
        }
      }


      return res.json([]);
    } catch (error) {
      console.error("Erro ao buscar animes populares:", error);

      return res.json([]);
    }
  } catch (error) {
    console.error("Erro geral ao buscar animes populares:", error);

    return res.json([]);
  }
});

const translationCache = {};

function cleanHtmlEntities(text) {
  if (!text) return text;

  return text
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&#34;/g, '"');
}

app.post('/api/translate', async (req, res) => {
  try {
    const { text, targetLang = 'pt' } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Texto para tradução não fornecido' });
    }

    const isArray = Array.isArray(text);
    const textsToTranslate = isArray ? text : [text];
    const translations = [];

    for (const t of textsToTranslate) {

      const cacheKey = `${t}:${targetLang}`;


      if (translationCache[cacheKey]) {
        translations.push(translationCache[cacheKey]);
        continue;
      }


      const response = await axios({
        method: 'get',
        url: 'https://translation.googleapis.com/language/translate/v2',
        params: {
          q: t,
          target: targetLang,
          key: GOOGLE_TRANSLATE_API_KEY,
        }
      });

      if (response.data &&
        response.data.data &&
        response.data.data.translations &&
        response.data.data.translations.length > 0) {
        const translatedText = response.data.data.translations[0].translatedText;


        const cleanedText = cleanHtmlEntities(translatedText);


        translationCache[cacheKey] = cleanedText;

        translations.push(cleanedText);
      } else {
        translations.push(t);
      }
    }

    return res.json({
      success: true,
      translations: isArray ? translations : translations[0]
    });

  } catch (error) {
    console.error('Erro na tradução:', error.response?.data || error.message);
    return res.status(500).json({
      error: 'Erro ao processar a tradução',
      details: error.response?.data || error.message
    });
  }
});


app.get("/api/animes/:id", async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: "ID do anime é obrigatório." });

  try {
    const cacheKey = `anime_details_${id}`;
    let cachedData = cache.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    try {

      const response = await axios.get(`${API_BASE_URL}/api/anime?id=${id}`);

      if (response.data) {
        const animeData = response.data;


        const formattedData = {
          id: id,
          title: animeData.name,
          image: animeData.image,
          description: animeData.synopsis,
          genres: animeData.categories,
          status: animeData.status,
          studio: animeData.studio,
          audio: animeData.audio,
          votes: animeData.votes,
          releaseDate: animeData.year,
          type: "TV",
          totalEpisodes: animeData.episodiosCount,
          score: animeData.score,
          season: animeData.season || animeData.year,
          episodes: animeData.episodios ? animeData.episodios.map(ep => ({
            id: ep.numero.toString(),
            number: ep.numero,
            title: ep.nome,
            link: ep.link,
            image: animeData.image
          })) : []
        };

        cache.set(cacheKey, formattedData);
        return res.json(formattedData);
      }
    } catch (error) {
      console.error(`Erro ao buscar detalhes do anime ${id}:`, error);
    }

    return res.status(404).json({ error: "Anime não encontrado." });
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar detalhes do anime." });
  }
});

async function getMangaDexTags() {
  try {

    const cacheKey = 'mangadex_tags';
    let cachedTags = cache.get(cacheKey);

    if (cachedTags) {
      return cachedTags;
    }


    const response = await axios.get('https://api.mangadex.org/manga/tag');

    if (response.data && Array.isArray(response.data.data)) {

      const tags = {
        genres: [],
        themes: [],
        formats: [],
        demographics: [],
        allTags: []
      };

      response.data.data.forEach(tag => {
        const tagData = {
          id: tag.id,
          name: tag.attributes.name.en,
          nameJa: tag.attributes.name.ja,
          group: tag.attributes.group,
          description: tag.attributes.description.en || ""
        };

        tags.allTags.push(tagData);


        switch (tag.attributes.group) {
          case 'genre':
            tags.genres.push(tagData);
            break;
          case 'theme':
            tags.themes.push(tagData);
            break;
          case 'format':
            tags.formats.push(tagData);
            break;
          case 'content':

            break;
          default:

            if (tag.attributes.group === 'demographic') {
              tags.demographics.push(tagData);
            }
        }
      });


      tags.genres.sort((a, b) => a.name.localeCompare(b.name));
      tags.themes.sort((a, b) => a.name.localeCompare(b.name));
      tags.formats.sort((a, b) => a.name.localeCompare(b.name));
      tags.demographics.sort((a, b) => a.name.localeCompare(b.name));


      cache.set(cacheKey, tags, 86400);

      return tags;
    }

    throw new Error("Formato de resposta inválido da API do MangaDex");
  } catch (error) {
    console.error("Erro ao obter tags do MangaDex:", error);
    throw error;
  }
}

app.get("/api/mangas/tags", async (req, res) => {
  try {
    const cacheKey = 'mangadex_tags';
    let cachedTags = cache.get(cacheKey);

    if (cachedTags) {
      return res.json(cachedTags);
    }

    const response = await mangadexAuth.authenticatedMangaDexRequest('https://api.mangadex.org/manga/tag');

    if (response.data && Array.isArray(response.data.data)) {
      const tags = {
        genres: [],
        themes: [],
        formats: [],
        demographics: [],
        allTags: []
      };

      response.data.data.forEach(tag => {
        const tagData = {
          id: tag.id,
          name: tag.attributes.name.en,
          nameJa: tag.attributes.name.ja,
          group: tag.attributes.group,
          description: tag.attributes.description.en || ""
        };

        tags.allTags.push(tagData);

        switch (tag.attributes.group) {
          case 'genre':
            tags.genres.push(tagData);
            break;
          case 'theme':
            tags.themes.push(tagData);
            break;
          case 'format':
            tags.formats.push(tagData);
            break;
          default:
            if (tag.attributes.group === 'demographic') {
              tags.demographics.push(tagData);
            }
        }
      });

      tags.genres.sort((a, b) => a.name.localeCompare(b.name));
      tags.themes.sort((a, b) => a.name.localeCompare(b.name));
      tags.formats.sort((a, b) => a.name.localeCompare(b.name));
      tags.demographics.sort((a, b) => a.name.localeCompare(b.name));

      cache.set(cacheKey, tags, 86400);

      return res.json(tags);
    }

    throw new Error("Formato de resposta inválido da API do MangaDex");
  } catch (error) {
    console.error("Erro ao obter tags do MangaDex:", error);
    res.status(500).json({
      error: "Erro ao buscar tags. Tente novamente mais tarde.",
      details: error.message
    });
  }
});

function buildMangaDexParams(query = {}) {

  const params = {
    'contentRating[]': ['safe', 'suggestive', 'erotica'],
    includes: ['cover_art', 'author', 'artist'],
    hasAvailableChapters: true
  };


  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 20;
  params.limit = limit;
  params.offset = (page - 1) * limit;


  if (query.title) {
    params.title = query.title;
  }


  if (query.order) {
    switch (query.order) {
      case 'latest':
        params['order[latestUploadedChapter]'] = 'desc';
        break;
      case 'oldest':
        params['order[latestUploadedChapter]'] = 'asc';
        break;
      case 'title_asc':
        params['order[title]'] = 'asc';
        break;
      case 'title_desc':
        params['order[title]'] = 'desc';
        break;
      case 'popular':
      default:
        params['order[followedCount]'] = 'desc';
        break;
    }
  } else {

    params['order[followedCount]'] = 'desc';
  }


  if (query.status) {
    const statusMap = {
      ongoing: 'ongoing',
      completed: 'completed',
      hiatus: 'hiatus',
      cancelled: 'cancelled'
    };

    if (statusMap[query.status]) {
      params.status = [statusMap[query.status]];
    }
  }


  if (query.translatedLanguage) {

    const langs = Array.isArray(query.translatedLanguage)
      ? query.translatedLanguage
      : [query.translatedLanguage];

    langs.forEach(lang => {
      params['availableTranslatedLanguage[]'] = params['availableTranslatedLanguage[]'] || [];
      params['availableTranslatedLanguage[]'].push(lang);
    });
  }


  if (query.demographic) {
    const demographics = Array.isArray(query.demographic) ? query.demographic : [query.demographic];
    demographics.forEach(demo => {
      params['includedTags[]'] = params['includedTags[]'] || [];
      params['includedTags[]'].push(demo);
    });
  }


  if (query.genres) {
    const genres = Array.isArray(query.genres) ? query.genres : query.genres.split(',');
    genres.forEach(genre => {
      params['includedTags[]'] = params['includedTags[]'] || [];
      params['includedTags[]'].push(genre);
    });
  }


  if (query.themes) {
    const themes = Array.isArray(query.themes) ? query.themes : query.themes.split(',');
    themes.forEach(theme => {
      params['includedTags[]'] = params['includedTags[]'] || [];
      params['includedTags[]'].push(theme);
    });
  }


  if (query.formats) {
    const formats = Array.isArray(query.formats) ? query.formats : query.formats.split(',');
    formats.forEach(format => {
      params['includedTags[]'] = params['includedTags[]'] || [];
      params['includedTags[]'].push(format);
    });
  }


  if (query.excludedTags) {
    const excludedTags = Array.isArray(query.excludedTags) ? query.excludedTags : query.excludedTags.split(',');
    excludedTags.forEach(tag => {
      params['excludedTags[]'] = params['excludedTags[]'] || [];
      params['excludedTags[]'].push(tag);
    });
  }


  if (query.includedTagsMode === 'OR') {
    params.includedTagsMode = 'OR';
  } else {
    params.includedTagsMode = 'AND';
  }

  if (query.excludedTagsMode === 'AND') {
    params.excludedTagsMode = 'AND';
  } else {
    params.excludedTagsMode = 'OR';
  }

  return params;
}


app.get("/api/mangas/populares", async (req, res) => {
  try {
    const cacheKey = `mangas_populares_${JSON.stringify(req.query)}`;
    let cachedData = cache.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    try {
      const params = buildMangaDexParams(req.query);

      const response = await mangadexAuth.authenticatedMangaDexRequest('https://api.mangadex.org/manga', {
        params: params
      });

      if (response.data && Array.isArray(response.data.data)) {
        const formattedResults = response.data.data.map(manga => {
          const coverRelationship = manga.relationships?.find(rel => rel.type === 'cover_art');
          const coverFilename = coverRelationship?.attributes?.fileName;
          const imageUrl = coverFilename ?
            `https://uploads.mangadex.org/covers/${manga.id}/${coverFilename}` :
            null;

          const genres = manga.attributes.tags
            ?.filter(tag => tag.attributes.group === 'genre')
            ?.map(tag => tag.attributes.name.en || tag.attributes.name.ja || Object.values(tag.attributes.name)[0]);

          let originalLanguage = manga.attributes.originalLanguage || "";
          if (originalLanguage === "ja") {
            originalLanguage = "Japonês";
          } else if (originalLanguage === "ko") {
            originalLanguage = "Coreano";
          } else if (originalLanguage === "zh") {
            originalLanguage = "Chinês";
          } else if (originalLanguage === "en") {
            originalLanguage = "Inglês";
          } else if (originalLanguage === "pt" || originalLanguage === "pt-br") {
            originalLanguage = "Português";
          }

          const availableTranslations = manga.attributes.availableTranslatedLanguages || [];
          const hasPortugueseTranslation = availableTranslations.some(lang =>
            lang === 'pt' || lang === 'pt-br'
          );

          return {
            id: manga.id,
            title: manga.attributes.title.en || manga.attributes.title.pt || manga.attributes.title['pt-br'] || Object.values(manga.attributes.title)[0],
            altTitles: manga.attributes.altTitles,
            image: imageUrl,
            releaseDate: manga.attributes.year?.toString() || "",
            description: manga.attributes.description?.en || manga.attributes.description?.pt || manga.attributes.description?.['pt-br'] || "",
            genres: genres || [],
            status: manga.attributes.status || "",
            originalLanguage: originalLanguage,
            lastChapter: manga.attributes.lastChapter || "",
            availableTranslations: availableTranslations,
            hasPortugueseTranslation: hasPortugueseTranslation
          };
        });

        cache.set(cacheKey, formattedResults, 300);
        return res.json(formattedResults);
      } else {
        throw new Error("Formato de resposta inválido");
      }
    } catch (error) {
      console.error("Erro ao buscar mangás populares:", error);
      return res.json([]);
    }
  } catch (error) {
    console.error("Erro ao buscar mangás populares:", error);
    res.status(500).json({ error: "Erro ao buscar mangás populares. Tente novamente mais tarde." });
  }
});


app.get("/api/mangas/search", async (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ error: "Parâmetro 'query' é obrigatório." });
  }

  try {
    const cacheKey = `mangas_search_${JSON.stringify(req.query)}`;
    let cachedData = cache.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    try {
      const params = buildMangaDexParams({
        ...req.query,
        title: query
      });

      const response = await mangadexAuth.authenticatedMangaDexRequest('https://api.mangadex.org/manga', {
        params: params
      });

      if (response.data && Array.isArray(response.data.data)) {
        const formattedResults = response.data.data.map(manga => {
          const coverRelationship = manga.relationships?.find(rel => rel.type === 'cover_art');
          const coverFilename = coverRelationship?.attributes?.fileName;
          const imageUrl = coverFilename ?
            `https://uploads.mangadex.org/covers/${manga.id}/${coverFilename}` :
            null;

          const genres = manga.attributes.tags
            ?.filter(tag => tag.attributes.group === 'genre')
            ?.map(tag => tag.attributes.name.en || tag.attributes.name.ja || Object.values(tag.attributes.name)[0]);

          return {
            id: manga.id,
            title: manga.attributes.title.en || manga.attributes.title.pt || manga.attributes.title['pt-br'] || Object.values(manga.attributes.title)[0],
            altTitles: manga.attributes.altTitles,
            image: imageUrl,
            releaseDate: manga.attributes.year?.toString() || "",
            description: manga.attributes.description?.en || manga.attributes.description?.pt || manga.attributes.description?.['pt-br'] || "",
            genres: genres || [],
            status: manga.attributes.status || ""
          };
        });

        cache.set(cacheKey, formattedResults, 300);
        return res.json(formattedResults);
      } else {
        throw new Error("Formato de resposta inválido");
      }
    } catch (error) {
      console.error(`Erro ao buscar mangás para "${query}":`, error);
      return res.json([]);
    }
  } catch (error) {
    console.error(`Erro ao buscar mangás para "${query}":`, error);
    res.status(500).json({ error: "Erro ao buscar mangás. Tente novamente mais tarde." });
  }
});


app.get("/api/mangas/:id", async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: "ID do mangá é obrigatório." });
  }

  try {
    const cacheKey = `manga_details_${id}`;
    let cachedData = cache.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    try {
      const response = await mangadexAuth.authenticatedMangaDexRequest(`https://api.mangadex.org/manga/${id}`, {
        params: {
          includes: ['cover_art', 'author', 'artist']
        }
      });

      if (!response.data || !response.data.data) {
        throw new Error("Mangá não encontrado");
      }

      const manga = response.data.data;

      const coverFilename = manga.relationships?.find(rel => rel.type === 'cover_art')?.attributes?.fileName;
      const imageUrl = coverFilename ?
        `https://uploads.mangadex.org/covers/${manga.id}/${coverFilename}` :
        null;

      const chaptersResponse = await mangadexAuth.authenticatedMangaDexRequest(`https://api.mangadex.org/manga/${id}/feed`, {
        params: {
          limit: 100,
          includes: ['scanlation_group'],
          order: { chapter: 'desc' },
          translatedLanguage: ['pt-br', 'pt', 'en'],
        }
      });

      let chapters = [];
      if (chaptersResponse.data && Array.isArray(chaptersResponse.data.data)) {
        chapters = chaptersResponse.data.data.map(chapter => {
          const scanGroup = chapter.relationships?.find(rel => rel.type === 'scanlation_group')?.attributes?.name || 'Desconhecido';

          return {
            id: chapter.id,
            chapterNumber: chapter.attributes.chapter || '0',
            title: chapter.attributes.title || `Capítulo ${chapter.attributes.chapter || '?'}`,
            pages: chapter.attributes.pages || 0,
            lang: chapter.attributes.translatedLanguage,
            volume: chapter.attributes.volume,
            publishAt: chapter.attributes.publishAt,
            scanGroup: scanGroup
          };
        });
      }

      const genres = manga.attributes.tags
        ?.filter(tag => tag.attributes.group === 'genre')
        ?.map(tag => tag.attributes.name.en || tag.attributes.name.ja || Object.values(tag.attributes.name)[0]);

      const formattedManga = {
        id: manga.id,
        title: manga.attributes.title.en || manga.attributes.title.pt || manga.attributes.title['pt-br'] || Object.values(manga.attributes.title)[0],
        altTitles: manga.attributes.altTitles,
        description: manga.attributes.description?.en || manga.attributes.description?.pt || manga.attributes.description?.['pt-br'] || "",
        genres: genres || [],
        themes: manga.attributes.tags
          ?.filter(tag => tag.attributes.group === 'theme')
          ?.map(tag => tag.attributes.name.en || tag.attributes.name.ja || Object.values(tag.attributes.name)[0]) || [],
        status: manga.attributes.status || "Unknown",
        releaseDate: manga.attributes.year?.toString() || "",
        chapters: chapters,
        image: imageUrl
      };

      cache.set(cacheKey, formattedManga);
      return res.json(formattedManga);
    } catch (error) {
      console.error(`Erro ao buscar detalhes do mangá ${id}:`, error.message);
      return res.status(404).json({ error: "Mangá não encontrado." });
    }
  } catch (error) {
    console.error(`Erro ao buscar detalhes do mangá:`, error);
    res.status(500).json({ error: "Erro ao buscar detalhes do mangá. Tente novamente mais tarde." });
  }
});


app.get("/api/mangas/capitulo/:id", async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: "ID do capítulo é obrigatório." });
  }

  try {
    const cacheKey = `manga_chapter_${id}`;
    let cachedData = cache.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    try {
      const chapterData = await mangadexAuth.getMangaDexChapterServer(id);

      if (!chapterData || !chapterData.chapter) {
        throw new Error("Capítulo não encontrado");
      }

      const baseUrl = chapterData.baseUrl;
      const chapter = chapterData.chapter;
      const hash = chapter.hash;

      const pages = chapter.data.map((page, index) => {
        return {
          page: index + 1,
          url: `${baseUrl}/data/${hash}/${page}`
        };
      });

      cache.set(cacheKey, pages);
      return res.json(pages);
    } catch (error) {
      console.error(`Erro ao buscar páginas do capítulo ${id}:`, error.message);
      return res.status(404).json({ error: "Capítulo não encontrado ou sem páginas disponíveis." });
    }
  } catch (error) {
    console.error(`Erro ao buscar páginas do capítulo:`, error);
    res.status(500).json({ error: "Erro ao buscar páginas do capítulo. Tente novamente mais tarde." });
  }
});


app.get("/api/mangas/genres/list", async (req, res) => {
  try {
    const cacheKey = "manga_genres_list";
    let cachedData = cache.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    try {
      const response = await axios.get('https://api.mangadex.org/manga/tag');

      if (response.data && Array.isArray(response.data.data)) {
        const genres = response.data.data
          .filter(tag => tag.attributes.group === 'genre')
          .map(tag => tag.attributes.name.en);

        cache.set(cacheKey, genres);
        return res.json(genres);
      } else {
        throw new Error("Formato de resposta inválido");
      }
    } catch (error) {
      console.error("Erro ao buscar gêneros da API:", error);


      const fallbackGenres = [
        "Action", "Adventure", "Comedy", "Drama", "Fantasy",
        "Horror", "Mystery", "Psychological", "Romance", "Sci-Fi",
        "Slice of Life", "Sports", "Supernatural", "Thriller",
        "Historical", "School Life", "Seinen", "Shoujo", "Shounen"
      ];

      cache.set(cacheKey, fallbackGenres);
      return res.json(fallbackGenres);
    }
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar lista de gêneros de mangás." });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});