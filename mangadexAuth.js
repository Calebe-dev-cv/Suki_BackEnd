const axios = require('axios');
const NodeCache = require('node-cache');

const tokenCache = new NodeCache({ stdTTL: 800 }); 

const MANGADEX_AUTH_CONFIG = {
  clientId: 'personal-client-dbb5fd74-369c-4e53-a8cc-0f0a56aa55c2-0112e0bb',
  clientSecret: 'q31sQpQMCZwJPPfF3PYqOX09tQ8YTeF6',
  username: process.env.MANGADEX_USERNAME || '',  
  password: process.env.MANGADEX_PASSWORD || '',  
};

/**
 * Obtém um token de acesso para a API do MangaDex
 * @returns {Promise<string>} Token de acesso
 */
async function getMangaDexAccessToken() {
  const cachedToken = tokenCache.get('mangadex_access_token');
  if (cachedToken) {
    return cachedToken;
  }

  try {
    const authData = new URLSearchParams({
      grant_type: 'password',
      username: MANGADEX_AUTH_CONFIG.username,
      password: MANGADEX_AUTH_CONFIG.password,
      client_id: MANGADEX_AUTH_CONFIG.clientId,
      client_secret: MANGADEX_AUTH_CONFIG.clientSecret
    });

    const response = await axios.post(
      'https://auth.mangadex.org/realms/mangadex/protocol/openid-connect/token',
      authData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const { access_token, refresh_token } = response.data;

    tokenCache.set('mangadex_access_token', access_token);
    tokenCache.set('mangadex_refresh_token', refresh_token);

    return access_token;
  } catch (error) {
    console.error('Erro ao obter token de acesso do MangaDex:', error.message);
    throw error;
  }
}

/**
 * Atualiza o token de acesso usando o refresh token
 * @returns {Promise<string>} Novo token de acesso
 */
async function refreshMangaDexToken() {
  const refreshToken = tokenCache.get('mangadex_refresh_token');
  
  if (!refreshToken) {
    return getMangaDexAccessToken();
  }

  try {
    const refreshData = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: MANGADEX_AUTH_CONFIG.clientId,
      client_secret: MANGADEX_AUTH_CONFIG.clientSecret
    });

    const response = await axios.post(
      'https://auth.mangadex.org/realms/mangadex/protocol/openid-connect/token',
      refreshData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const { access_token, refresh_token } = response.data;

    tokenCache.set('mangadex_access_token', access_token);
    
    if (refresh_token) {
      tokenCache.set('mangadex_refresh_token', refresh_token);
    }

    return access_token;
  } catch (error) {
    console.error('Erro ao atualizar token do MangaDex:', error.message);
    tokenCache.del('mangadex_access_token');
    tokenCache.del('mangadex_refresh_token');
    return getMangaDexAccessToken();
  }
}

/**
 * Faz uma requisição autenticada para a API do MangaDex
 * @param {string} url URL da requisição
 * @param {object} options Opções adicionais para a requisição
 * @returns {Promise<any>} Resposta da requisição
 */
async function authenticatedMangaDexRequest(url, options = {}) {
  try {
    let accessToken = await getMangaDexAccessToken();
    
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${accessToken}`
    };
    
    try {
      const response = await axios({
        ...options,
        url,
        headers
      });
      
      return response;
    } catch (error) {
      if (error.response && error.response.status === 401) {
        accessToken = await refreshMangaDexToken();
        
        const retryResponse = await axios({
          ...options,
          url,
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${accessToken}`
          }
        });
        
        return retryResponse;
      }
      
      throw error;
    }
  } catch (error) {
    console.error('Erro na requisição autenticada para o MangaDex:', error.message);
    throw error;
  }
}

/**
 * Obtém a URL do servidor para leitura de um capítulo
 * @param {string} chapterId ID do capítulo
 * @returns {Promise<object>} Dados do servidor e capítulo
 */
async function getMangaDexChapterServer(chapterId) {
  try {
    const response = await axios.get(`https://api.mangadex.org/at-home/server/${chapterId}`);
    return response.data;
  } catch (error) {
    console.error(`Erro ao obter servidor para o capítulo ${chapterId}:`, error.message);
    throw error;
  }
}

module.exports = {
  getMangaDexAccessToken,
  refreshMangaDexToken,
  authenticatedMangaDexRequest,
  getMangaDexChapterServer
};