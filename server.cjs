require("dotenv").config();

const express = require("express");

const app = express();
const PORT = 3001;
const apiKey = process.env.KINOPOISK_TOKEN;

if (!apiKey) {
  console.error("Добавь KINOPOISK_API_KEY в файл .env");
  process.exit(1);
}

// Сохраняем ответ на 10 минут, чтобы экономить запросы.
const catalogCache = new Map();

app.get("/api/movies", async (req, res) => {
  const page = Number(req.query.page ?? 1);

  if (!Number.isInteger(page) || page < 1 || page > 5) {
    return res.status(400).json({
      message: "Номер страницы должен быть от 1 до 5",
    });
  }

  const cached = catalogCache.get(page);

  if (cached && Date.now() < cached.expiresAt) {
    return res.json(cached.data);
  }

  try {
    const response = await fetch(
      `https://kinopoiskapiunofficial.tech/api/v2.2/films?type=FILM&order=NUM_VOTE&page=${page}`,
      {
        headers: {
          "X-API-KEY": apiKey,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) {
      console.error("API вернул HTTP-статус:", response.status);

      const messages = {
        401: "API не принял ключ. Проверь KINOPOISK_API_KEY.",
        402: "Лимит запросов к API исчерпан.",
        403: "Доступ к API запрещён.",
        429: "Слишком много запросов. Попробуй позже.",
      };

      return res.status(502).json({
        message:
          messages[response.status] || "Не удалось получить фильмы.",
      });
    }

    const data = await response.json();

    if (!Array.isArray(data.items)) {
      throw new Error("Ожидался массив data.items");
    }

    const movies = data.items.map((item) => ({
      id: `kinopoisk-${item.kinopoiskId}`,
      title:
        item.nameRu ||
        item.nameOriginal ||
        item.nameEn ||
        "Без названия",
      year: item.year ?? "Не указан",
      genre: (item.genres || [])
        .map((item) => item.genre)
        .join(", "),
      description: "Подробное описание подключим следующим этапом.",
      poster: item.posterUrlPreview || item.posterUrl || "",
      rating: item.ratingKinopoisk ?? null,
    }));

    catalogCache.set(page, {
        data: movies,
        expiresAt : Date.now() + 10 * 60 * 1000,
    });

    res.json(movies);
  } catch (err) {
    console.error("Ошибка загрузки фильмов:", err.message);
    console.error("Причина:", err.cause);

    res.status(502).json({
      message: "Не удалось загрузить фильмы. Попробуй позже.",
    });
  }
});

const detailsCache = new Map();

app.get('/api/movies/:id', async (req, res) => {
    const {id} = req.params;

    const match = /^kinopoisk-(\d+)$/.exec(id);

    if (!match) {
        return res.status(400).json({
            message: 'Неккоректный id фильма',
        });
    }

    const cached = detailsCache.get(id);

    if (cached&&Date.now() < cacheExpiresAt) {
        return res.json(cached);
    }

    try {
        const response = await fetch(
            `https://kinopoiskapiunofficial.tech/api/v2.2/films/${match[1]}`,
            {
                headers: {
                    'X-API-KEY': apiKey,
                    Acccept: 'application/json',
                },
                signal: AbortSignal.timeout(15000),
            }
        );

        if (!response.ok) {
            throw new Error (`API вернул статус ${response.status}`);
        }

        const data = await response.json();

        const details = {
            description:
            data.description ||
            data.shortDescription ||
            'Описания нет',
        };

        detailsCache.set(id, {
            data: details,
            expiresAt: Date.now() + 10*60*1000,
        });

        res.json(details);
    } catch (err) {
        console.log('Ошибка загрузки описания:', err.message);
        res.status(502).json({
            message:'Не удалось получить описание',
        });
    }
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Сервер запущен: http://127.0.0.1:${PORT}`);
});