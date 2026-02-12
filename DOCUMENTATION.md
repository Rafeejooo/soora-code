# 📖 Consumet API - Dokumentasi Lengkap

> **Base URL:** `https://api.consumet.org` (self-hosted)
>
> **Repository:** [github.com/consumet/api.consumet.org](https://github.com/consumet/api.consumet.org)
>
> **Method:** Semua endpoint menggunakan `GET`
>
> ⚠️ **Catatan:** API ini tidak lagi di-host secara publik. Anda harus melakukan self-host untuk menggunakannya.

---

## 📑 Daftar Isi

- [1. Anime](#1-anime-)
  - [1.1 AnimePahe](#11-animepahe)
  - [1.2 AnimeUnity](#12-animeunity)
  - [1.3 HiAnime (Zoro)](#13-hianime-zoro)
  - [1.4 AnimeKai](#14-animekai)
  - [1.5 AnimeSaturn](#15-animesaturn)
  - [1.6 KickAssAnime](#16-kickassanime)
- [2. Movies / TV Shows](#2-movies--tv-shows-)
  - [2.1 FlixHQ](#21-flixhq)
  - [2.2 DramaCool](#22-dramacool)
  - [2.3 Goku](#23-goku)
  - [2.4 HiMovies](#24-himovies)
  - [2.5 SFlix](#25-sflix)
- [3. Manga](#3-manga-)
  - [3.1 MangaDex](#31-mangadex)
  - [3.2 MangaHere](#32-mangahere)
  - [3.3 MangaPill](#33-mangapill)
  - [3.4 MangaKakalot](#34-mangakakalot)
  - [3.5 MangaReader](#35-mangareader)
- [4. Comics](#4-comics-)
  - [4.1 GetComics](#41-getcomics)
- [5. Light Novels](#5-light-novels-)
- [6. Books](#6-books-)
- [7. Meta Providers](#7-meta-providers-)
  - [7.1 Anilist (Anime)](#71-anilist-anime)
  - [7.2 Anilist Manga](#72-anilist-manga)
  - [7.3 MyAnimeList (MAL)](#73-myanimelist-mal)
  - [7.4 TMDB](#74-tmdb)
- [8. News](#8-news-)
  - [8.1 Anime News Network (ANN)](#81-anime-news-network-ann)

---

## 1. Anime 🗾

### 1.1 AnimePahe

| Endpoint | Deskripsi | Parameter |
|---|---|---|
| `GET /anime/animepahe/:query` | Cari anime | `query` (path) - kata kunci pencarian |
| `GET /anime/animepahe/info/:id` | Detail info anime | `id` (path) - anime ID, `episodePage` (query, optional) - halaman episode |
| `GET /anime/animepahe/watch` | Tonton episode | `episodeId` (query, **required**) - episode ID |
| `GET /anime/animepahe/recent-episodes` | Episode terbaru | `page` (query, optional) - nomor halaman |

**Contoh:**
```
GET /anime/animepahe/naruto
GET /anime/animepahe/info/naruto-shippuden
GET /anime/animepahe/watch?episodeId=xxxx
GET /anime/animepahe/recent-episodes?page=1
```

---

### 1.2 AnimeUnity

| Endpoint | Deskripsi | Parameter |
|---|---|---|
| `GET /anime/animeunity/:query` | Cari anime | `query` (path) - kata kunci |
| `GET /anime/animeunity/info` | Detail info anime | `id` (query, **required**), `page` (query, optional) |
| `GET /anime/animeunity/watch/:episodeId` | Tonton episode | `episodeId` (path, **required**) |

**Contoh:**
```
GET /anime/animeunity/one-piece
GET /anime/animeunity/info?id=12345
GET /anime/animeunity/watch/ep-123
```

---

### 1.3 HiAnime (Zoro)

| Endpoint | Deskripsi | Parameter |
|---|---|---|
| `GET /anime/hianime/:query` | Cari anime | `query` (path), `page` (query, optional) |
| `GET /anime/hianime/info` | Detail info anime | `id` (query, **required**) |
| `GET /anime/hianime/watch/:episodeId` | Tonton episode | `episodeId` (path), `server` (query, optional), `category` (query, optional - sub/dub) |
| `GET /anime/hianime/advanced-search` | Pencarian lanjutan | Multiple query params |
| `GET /anime/hianime/top-airing` | Top airing anime | `page` (query, optional) |
| `GET /anime/hianime/most-popular` | Anime terpopuler | `page` (query, optional) |
| `GET /anime/hianime/most-favorite` | Anime terfavorit | `page` (query, optional) |
| `GET /anime/hianime/latest-completed` | Terbaru selesai | `page` (query, optional) |
| `GET /anime/hianime/recently-updated` | Baru diperbarui | `page` (query, optional) |
| `GET /anime/hianime/recently-added` | Baru ditambahkan | `page` (query, optional) |
| `GET /anime/hianime/top-upcoming` | Akan datang | `page` (query, optional) |
| `GET /anime/hianime/studio/:studio` | Anime per studio | `studio` (path) |
| `GET /anime/hianime/subbed-anime` | Anime subtitle | `page` (query, optional) |
| `GET /anime/hianime/dubbed-anime` | Anime dubbing | `page` (query, optional) |
| `GET /anime/hianime/movie` | Film anime | `page` (query, optional) |
| `GET /anime/hianime/tv` | Serial TV | `page` (query, optional) |
| `GET /anime/hianime/ova` | OVA | `page` (query, optional) |
| `GET /anime/hianime/ona` | ONA | `page` (query, optional) |
| `GET /anime/hianime/special` | Special | `page` (query, optional) |
| `GET /anime/hianime/genres` | Daftar genre | - |
| `GET /anime/hianime/genre/:genre` | Anime per genre | `genre` (path), `page` (query, optional) |
| `GET /anime/hianime/schedule` | Jadwal tayang | - |
| `GET /anime/hianime/spotlight` | Spotlight anime | - |
| `GET /anime/hianime/search-suggestions/:query` | Saran pencarian | `query` (path) |

**Contoh:**
```
GET /anime/hianime/attack-on-titan
GET /anime/hianime/info?id=attack-on-titan-112
GET /anime/hianime/watch/attack-on-titan-112$episode$1
GET /anime/hianime/top-airing?page=2
GET /anime/hianime/genre/action?page=1
```

---

### 1.4 AnimeKai

| Endpoint | Deskripsi | Parameter |
|---|---|---|
| `GET /anime/animekai/:query` | Cari anime | `query` (path), `page` (query, optional) |
| `GET /anime/animekai/info` | Detail info | `id` (query, **required**) |
| `GET /anime/animekai/watch/:episodeId` | Tonton episode | `episodeId` (path), `server` (query, optional), `category` (query, optional) |
| `GET /anime/animekai/latest-completed` | Selesai terbaru | `page` (query, optional) |
| `GET /anime/animekai/new-releases` | Rilis baru | `page` (query, optional) |
| `GET /anime/animekai/recent-added` | Baru ditambahkan | `page` (query, optional) |
| `GET /anime/animekai/recent-episodes` | Episode terbaru | `page` (query, optional) |
| `GET /anime/animekai/schedule/:date` | Jadwal per tanggal | `date` (path) |
| `GET /anime/animekai/spotlight` | Spotlight | - |
| `GET /anime/animekai/search-suggestions/:query` | Saran pencarian | `query` (path) |
| `GET /anime/animekai/servers` | Daftar server | `episodeId` (query) |
| `GET /anime/animekai/genre/list` | Daftar genre | - |
| `GET /anime/animekai/genre/:genre` | Anime per genre | `genre` (path), `page` (query, optional) |
| `GET /anime/animekai/movies` | Film anime | `page` (query, optional) |
| `GET /anime/animekai/ona` | ONA | `page` (query, optional) |
| `GET /anime/animekai/ova` | OVA | `page` (query, optional) |
| `GET /anime/animekai/specials` | Special | `page` (query, optional) |
| `GET /anime/animekai/tv` | Serial TV | `page` (query, optional) |

---

### 1.5 AnimeSaturn

| Endpoint | Deskripsi | Parameter |
|---|---|---|
| `GET /anime/animesaturn/:query` | Cari anime | `query` (path) |
| `GET /anime/animesaturn/info` | Detail info | `id` (query, **required**) |
| `GET /anime/animesaturn/watch/:episodeId` | Tonton episode | `episodeId` (path, **required**) |
| `GET /anime/animesaturn/servers/:episodeId` | Daftar server | `episodeId` (path, **required**) |

---

### 1.6 KickAssAnime

| Endpoint | Deskripsi | Parameter |
|---|---|---|
| `GET /anime/kickassanime/:query` | Cari anime | `query` (path), `page` (query, optional) |
| `GET /anime/kickassanime/info` | Detail info | `id` (query, **required**) |
| `GET /anime/kickassanime/watch/:episodeId` | Tonton episode | `episodeId` (path), `server` (query, optional) |
| `GET /anime/kickassanime/servers/:episodeId` | Daftar server | `episodeId` (path) |

---

## 2. Movies / TV Shows 🎬

### 2.1 FlixHQ

| Endpoint | Deskripsi | Parameter |
|---|---|---|
| `GET /movies/flixhq/:query` | Cari film/serial | `query` (path), `page` (query, optional) |
| `GET /movies/flixhq/info` | Detail info media | `id` (query, **required**) |
| `GET /movies/flixhq/watch` | Tonton episode/film | `episodeId` (query, **required**), `mediaId` (query, **required**), `server` (query, optional - StreamingServers) |
| `GET /movies/flixhq/servers` | Daftar server | `episodeId` (query, **required**), `mediaId` (query, **required**) |
| `GET /movies/flixhq/recent-shows` | Serial TV terbaru | - |
| `GET /movies/flixhq/recent-movies` | Film terbaru | - |
| `GET /movies/flixhq/trending` | Trending | `type` (query, optional - "tv" atau "movie") |
| `GET /movies/flixhq/country/:country` | Per negara | `country` (path), `page` (query, optional) |
| `GET /movies/flixhq/genre/:genre` | Per genre | `genre` (path), `page` (query, optional) |

**Contoh:**
```
GET /movies/flixhq/the-avengers
GET /movies/flixhq/info?id=movie/watch-the-avengers-19612
GET /movies/flixhq/watch?episodeId=1234&mediaId=movie/watch-the-avengers-19612
GET /movies/flixhq/trending?type=movie
GET /movies/flixhq/country/US?page=1
GET /movies/flixhq/genre/action?page=1
```

---

### 2.2 DramaCool

| Endpoint | Deskripsi | Parameter |
|---|---|---|
| `GET /movies/dramacool/:query` | Cari drama | `query` (path), `page` (query, optional) |
| `GET /movies/dramacool/info` | Detail info | `id` (query, **required**) |
| `GET /movies/dramacool/watch` | Tonton episode | `episodeId` (query, **required**), `server` (query, optional) |
| `GET /movies/dramacool/popular` | Drama populer | `page` (query, optional) |
| `GET /movies/dramacool/recent-movies` | Film terbaru | `page` (query, optional) |
| `GET /movies/dramacool/recent-shows` | Serial terbaru | `page` (query, optional) |

**Contoh:**
```
GET /movies/dramacool/vincenzo
GET /movies/dramacool/info?id=drama-detail/vincenzo
GET /movies/dramacool/watch?episodeId=vincenzo-episode-1
GET /movies/dramacool/popular?page=1
```

---

### 2.3 Goku

| Endpoint | Deskripsi | Parameter |
|---|---|---|
| `GET /movies/goku/:query` | Cari film/serial | `query` (path), `page` (query, optional) |
| `GET /movies/goku/info` | Detail info | `id` (query, **required**) |
| `GET /movies/goku/watch` | Tonton episode | `episodeId` (query, **required**), `mediaId` (query, **required**), `server` (query, optional) |
| `GET /movies/goku/servers` | Daftar server | `episodeId` (query, **required**), `mediaId` (query, **required**) |
| `GET /movies/goku/recent-shows` | Serial terbaru | - |
| `GET /movies/goku/recent-movies` | Film terbaru | - |
| `GET /movies/goku/trending` | Trending | `type` (query, optional - "tv"/"movie") |
| `GET /movies/goku/country/:country` | Per negara | `country` (path), `page` (query, optional) |
| `GET /movies/goku/genre/:genre` | Per genre | `genre` (path), `page` (query, optional) |

**Contoh:**
```
GET /movies/goku/avengers
GET /movies/goku/info?id=movie-xyz
GET /movies/goku/trending?type=movie
GET /movies/goku/country/US?page=1
GET /movies/goku/genre/action?page=1
```

---

### 2.4 HiMovies

| Endpoint | Deskripsi | Parameter |
|---|---|---|
| `GET /movies/himovies/:query` | Cari film/serial | `query` (path), `page` (query, optional) |
| `GET /movies/himovies/info` | Detail info | `id` (query, **required**) |
| `GET /movies/himovies/watch` | Tonton episode | `episodeId` (query, **required**), `mediaId` (query, **required**), `server` (query, optional) |
| `GET /movies/himovies/servers` | Daftar server | `episodeId` (query, **required**), `mediaId` (query, **required**) |
| `GET /movies/himovies/recent-shows` | Serial terbaru | - |
| `GET /movies/himovies/recent-movies` | Film terbaru | - |
| `GET /movies/himovies/trending` | Trending | `type` (query, optional - "tv"/"movie") |
| `GET /movies/himovies/country/:country` | Per negara | `country` (path), `page` (query, optional) |
| `GET /movies/himovies/genre/:genre` | Per genre | `genre` (path), `page` (query, optional) |

**Contoh:**
```
GET /movies/himovies/inception
GET /movies/himovies/info?id=movie-xyz
GET /movies/himovies/trending?type=tv
GET /movies/himovies/country/KR?page=1
GET /movies/himovies/genre/thriller?page=1
```

---

### 2.5 SFlix

| Endpoint | Deskripsi | Parameter |
|---|---|---|
| `GET /movies/sflix/:query` | Cari film/serial | `query` (path), `page` (query, optional) |
| `GET /movies/sflix/info` | Detail info | `id` (query, **required**) |
| `GET /movies/sflix/watch` | Tonton episode | `episodeId` (query, **required**), `mediaId` (query, **required**), `server` (query, optional) |
| `GET /movies/sflix/servers` | Daftar server | `episodeId` (query, **required**), `mediaId` (query, **required**) |
| `GET /movies/sflix/recent-shows` | Serial terbaru | - |
| `GET /movies/sflix/recent-movies` | Film terbaru | - |
| `GET /movies/sflix/trending` | Trending | `type` (query, optional) |
| `GET /movies/sflix/country/:country` | Per negara | `country` (path), `page` (query, optional) |
| `GET /movies/sflix/genre/:genre` | Per genre | `genre` (path), `page` (query, optional) |

**Contoh:**
```
GET /movies/sflix/interstellar
GET /movies/sflix/info?id=movie-xyz
GET /movies/sflix/trending?type=movie
GET /movies/sflix/country/JP?page=1
GET /movies/sflix/genre/sci-fi?page=1
```

---

## 3. Manga 📚

### 3.1 MangaDex

| Endpoint | Deskripsi | Parameter |
|---|---|---|
| `GET /manga/mangadex/:query` | Cari manga | `query` (path), `page` (query, optional) |
| `GET /manga/mangadex/info/:id` | Detail info manga | `id` (path, **required**) |
| `GET /manga/mangadex/read/:chapterId` | Baca chapter | `chapterId` (path, **required**) |

**Contoh:**
```
GET /manga/mangadex/one-piece
GET /manga/mangadex/info/a1c7c817-4e59-43b7-9365-09675a149a6f
GET /manga/mangadex/read/chapter-uuid
```

---

### 3.2 MangaHere

| Endpoint | Deskripsi | Parameter |
|---|---|---|
| `GET /manga/mangahere/:query` | Cari manga | `query` (path) |
| `GET /manga/mangahere/info` | Detail info | `id` (query, **required**) |
| `GET /manga/mangahere/read` | Baca chapter | `chapterId` (query, **required**) |

---

### 3.3 MangaPill

| Endpoint | Deskripsi | Parameter |
|---|---|---|
| `GET /manga/mangapill/:query` | Cari manga | `query` (path) |
| `GET /manga/mangapill/info` | Detail info | `id` (query, **required**) |
| `GET /manga/mangapill/read` | Baca chapter | `chapterId` (query, **required**) |

**Contoh:**
```
GET /manga/mangapill/naruto
GET /manga/mangapill/info?id=manga-123
GET /manga/mangapill/read?chapterId=chapter-456
```

---

### 3.4 MangaKakalot

| Endpoint | Deskripsi | Parameter |
|---|---|---|
| `GET /manga/mangakakalot/:query` | Cari manga | `query` (path), `page` (query, optional, default: 1) |
| `GET /manga/mangakakalot/info` | Detail info | `id` (query, **required**) |
| `GET /manga/mangakakalot/read` | Baca chapter | `chapterId` (query, **required**) |
| `GET /manga/mangakakalot/latestmanga` | Manga terbaru | `page` (query, optional, default: 1) |
| `GET /manga/mangakakalot/bygenre` | Cari per genre | `genre` (query, **required**), `page` (query, optional, default: 1) |
| `GET /manga/mangakakalot/suggestions` | Saran pencarian | `query` (query, **required**) |

**Contoh:**
```
GET /manga/mangakakalot/naruto?page=1
GET /manga/mangakakalot/info?id=manga-abc
GET /manga/mangakakalot/latestmanga?page=2
GET /manga/mangakakalot/bygenre?genre=action&page=1
GET /manga/mangakakalot/suggestions?query=one
```

---

### 3.5 MangaReader

| Endpoint | Deskripsi | Parameter |
|---|---|---|
| `GET /manga/managreader/:query` | Cari manga | `query` (path) |
| `GET /manga/managreader/info` | Detail info | `id` (query, **required**) |
| `GET /manga/managreader/read` | Baca chapter | `chapterId` (query, **required**) |

---

## 4. Comics 🦸

### 4.1 GetComics

| Endpoint | Deskripsi | Parameter |
|---|---|---|
| `GET /comics/getcomics/:query` | Cari komik | `comicTitle` (query, **required**, min 4 karakter), `page` (query, optional, default: 1) |

**Contoh:**
```
GET /comics/getcomics/s?comicTitle=spider-man&page=1
```

> ⚠️ `comicTitle` harus lebih dari 4 karakter.

---

## 5. Light Novels 📕

> ℹ️ Saat ini route light novels hanya memiliki halaman welcome. Provider belum diimplementasi di API.

| Endpoint | Deskripsi |
|---|---|
| `GET /light-novels/` | Welcome page |

---

## 6. Books 📚

> ℹ️ Saat ini route books hanya memiliki halaman welcome. Provider belum diimplementasi di API.

| Endpoint | Deskripsi |
|---|---|
| `GET /books/` | Welcome page - "Welcome to Consumet Books 📚" |

---

## 7. Meta Providers 🌐

### 7.1 Anilist (Anime)

| Endpoint | Deskripsi | Parameter |
|---|---|---|
| `GET /meta/anilist/:query` | Cari anime | `query` (path), `page` (query, optional), `perPage` (query, optional) |
| `GET /meta/anilist/advanced-search` | Pencarian lanjutan | `query`, `page`, `perPage`, `type`, `genres` (JSON string), `id`, `format`, `sort` (JSON string), `status`, `year`, `season` (WINTER/SPRING/SUMMER/FALL), `countryOfOrigin` - semua query, optional |
| `GET /meta/anilist/trending` | Anime trending | `page`, `perPage` (query, optional) |
| `GET /meta/anilist/popular` | Anime populer | `page`, `perPage` (query, optional) |
| `GET /meta/anilist/airing-schedule` | Jadwal tayang | `page`, `perPage`, `weekStart` (unix timestamp), `weekEnd` (unix timestamp), `notYetAired` (boolean) - semua optional |
| `GET /meta/anilist/genre` | Anime per genre | `genres` (query, **required**, JSON string), `page`, `perPage` (optional) |
| `GET /meta/anilist/recent-episodes` | Episode terbaru | `provider`, `page`, `perPage` (query, optional) |
| `GET /meta/anilist/random-anime` | Anime random | - |
| `GET /meta/anilist/info/:id` | Info anime (dengan episode) | `id` (path), `provider`, `dub` (boolean), `fetchFiller` (boolean), `locale` - query, optional |
| `GET /meta/anilist/data/:id` | Info anime (tanpa episode) | `id` (path) |
| `GET /meta/anilist/episodes/:id` | Daftar episode | `id` (path), `provider`, `dub`, `fetchFiller`, `locale` (query, optional) |
| `GET /meta/anilist/watch/:episodeId` | Tonton episode | `episodeId` (path), `provider`, `server`, `dub` (query, optional) |
| `GET /meta/anilist/servers/:id` | Daftar server | `id` (path), `provider` (query, optional) |
| `GET /meta/anilist/character/:id` | Info karakter | `id` (path) |
| `GET /meta/anilist/staff/:id` | Info staff | `id` (path) |
| `GET /meta/anilist/favorites` | Daftar favorit | `type` (query, optional - "ANIME"/"MANGA"/"BOTH"), **Header: Authorization required** |

**Contoh:**
```
GET /meta/anilist/one-piece?page=1&perPage=20
GET /meta/anilist/advanced-search?query=naruto&type=ANIME&genres=["Action"]&sort=["POPULARITY_DESC"]&season=WINTER&year=2023
GET /meta/anilist/trending?page=1&perPage=10
GET /meta/anilist/info/21?provider=hianime&dub=false
GET /meta/anilist/watch/episode-id-123?provider=hianime&server=vidstreaming
GET /meta/anilist/character/36765
```

---

### 7.2 Anilist Manga

| Endpoint | Deskripsi | Parameter |
|---|---|---|
| `GET /meta/anilist-manga/:query` | Cari manga | `query` (path), `page`, `perPage` (query, optional) |
| `GET /meta/anilist-manga/info/:id` | Info manga | `id` (path), `provider` (query, optional) |
| `GET /meta/anilist-manga/read/:chapterId` | Baca chapter | `chapterId` (path), `provider` (query, optional) |

---

### 7.3 MyAnimeList (MAL)

| Endpoint | Deskripsi | Parameter |
|---|---|---|
| `GET /meta/mal/:query` | Cari anime | `query` (path), `page`, `perPage` (query, optional) |
| `GET /meta/mal/info/:id` | Info anime | `id` (path), `provider`, `dub`, `fetchFiller`, `locale` (query, optional) |
| `GET /meta/mal/watch/:episodeId` | Tonton episode | `episodeId` (path), `provider` (query, optional) |

**Contoh:**
```
GET /meta/mal/naruto
GET /meta/mal/info/20?provider=hianime&dub=true
GET /meta/mal/watch/episode-123
```

---

### 7.4 TMDB

| Endpoint | Deskripsi | Parameter |
|---|---|---|
| `GET /meta/tmdb/:query` | Cari film/serial | `query` (path), `page` (query, optional) |
| `GET /meta/tmdb/info/:id` | Detail info | `id` (path), `type` (query, **required** - "movie"/"tv"), `provider` (query, optional) |
| `GET /meta/tmdb/trending` | Trending media | `type` (query, optional - default "all"), `timePeriod` (query, optional - "day"/"week", default "day"), `page` (query, optional) |
| `GET /meta/tmdb/watch/:episodeId` | Tonton episode | `episodeId` (path/query), `id` (query), `provider`, `server` (query, optional) |

> ⚠️ Memerlukan `TMDB_KEY` di environment variable.

**Contoh:**
```
GET /meta/tmdb/avengers?page=1
GET /meta/tmdb/info/299536?type=movie
GET /meta/tmdb/trending?type=movie&timePeriod=week&page=1
```

---

## 8. News 📰

### 8.1 Anime News Network (ANN)

| Endpoint | Deskripsi | Parameter |
|---|---|---|
| `GET /news/ann/recent-feeds` | Berita terbaru | `topic` (query, optional - Topics enum) |
| `GET /news/ann/info` | Detail berita | `id` (query, **required**) |

**Contoh:**
```
GET /news/ann/recent-feeds?topic=anime
GET /news/ann/info?id=12345
```

---

## 🔧 Konfigurasi Environment Variables

| Variable | Deskripsi | Required |
|---|---|---|
| `PORT` | Port server (default: 3000) | No |
| `REDIS_HOST` | Redis host untuk caching | No |
| `REDIS_PORT` | Redis port | No |
| `REDIS_PASSWORD` | Redis password | No |
| `REDIS_TTL` | Cache TTL dalam detik (default: 3600) | No |
| `TMDB_KEY` | API Key untuk TMDB provider | No (required untuk TMDB) |
| `PROXY` | Proxy URL | No |

---

## 📌 Response Umum

### Success Response
```json
{
  "currentPage": 1,
  "hasNextPage": true,
  "results": [
    {
      "id": "...",
      "title": "...",
      "image": "...",
      "url": "..."
    }
  ]
}
```

### Error Responses

**400 Bad Request:**
```json
{
  "message": "id is required"
}
```

**500 Internal Server Error:**
```json
{
  "message": "Something went wrong. Contact developer for help."
}
```

---

## 🚀 Quick Start (Self-Host)

```bash
# Clone repository
git clone https://github.com/consumet/api.consumet.org.git

# Install dependencies
cd api.consumet.org
npm install

# Start development server
npm start
```

Server berjalan di `http://localhost:3000`

---

> 📝 Dokumentasi ini dibuat berdasarkan source code dari [consumet/api.consumet.org](https://github.com/consumet/api.consumet.org).
> Dokumentasi resmi tersedia di [docs.consumet.org](https://docs.consumet.org).
