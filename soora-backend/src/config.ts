import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  consumetUrl: process.env.CONSUMET_URL || 'http://localhost:3000',
  tmdbKey: process.env.TMDB_KEY || '',
  tmdbBase: 'https://api.themoviedb.org/3',
  tmdbImg: 'https://image.tmdb.org/t/p',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  nodeEnv: process.env.NODE_ENV || 'development',
  telegramBotToken: process.env.BOT_TOKEN || '',
  telegramChatId: process.env.CHAT_ID || '',
  samehadakuBase: 'https://www.sankavollerei.com/anime/samehadaku',
  jikanBase: 'https://api.jikan.moe/v4',
};
