import { useEffect, useState, useRef } from "react";

function shufflePages(pages) {
    const shuffled = [...pages];
    for (let i = shuffled.length - 1;i > 0 ;i--){
        const randomIndex = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[i]];
    }

    return shuffled;
}

export default function App(){
    const [dragX, setDragX] = useState(0);// хранит смещение карточки по горизонтали
    const [isDragging, setIsDragging] = useState(false);
    const swipeRef = useRef(null); //запоминает начало жеста, не вызывая обновление интерфейса
    const [movies, setMovies] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [movieDescription, setMovieDescription] = useState("");
    const [isDescriptionLoading, setIsDescriptionLoading] = useState(false);
    const [page, setPage] = useState(1); // запоминает последнюю загруженную страницу
    const [isLoadingMore, setIsLoadingMore] = useState(false); // false загрузка не идет
    const [loadMoreError, setLoadMoreError] = useState("");
    const [hasMore, setHasMore] = useState(true);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [swipeHistory, setSwipeHistory] = useState([]);
    const [remainingPages, setRemainingPages] = useState([]);
    const [savedMovies, setSavedMovies] = useState(() => {
        try {
            const saved = localStorage.getItem("movie-swipe-saved-movies");
            if (!saved) {
                return{};
            }
            const parsed = JSON.parse(saved); //JSON.parse - преобразует JSON-строку в значение JavaScrip

            if (
                typeof parsed !== "object" ||
                parsed === null ||
                Array.isArray(parsed)
            ) {
                return {};
            }

            return Object.fromEntries(
                Object.entries(parsed).filter( //Object.entries создаёт массив пар [ключ, значение]
                    ([id, movie]) =>
                        movie && 
                        movie.id === id &&
                        typeof movie.title === 'string'
                )
            );
        } catch {
            return {};
        }
    });

    const [movieStatuses, setMovieStatuses] = useState(() => {
        try {
            const savedStatuses = localStorage.getItem("movie-swipe-statuses");

            if (!savedStatuses) {
                return {};
            }

            const parsedStatuses = JSON.parse(savedStatuses);

            if (
                typeof parsedStatuses !== "object" ||
                parsedStatuses === null ||
                Array.isArray(parsedStatuses)
            ) {
                return {};
            }

            return Object.fromEntries(
                Object.entries(parsedStatuses).filter(
                    ([id, status]) => status === 'want' || status === "watched" || status === "disliked"
                )
            );
        } catch {
            return {};
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(
                "movie-swipe-statuses",
                JSON.stringify(movieStatuses)
            );
        } catch (err) {
            console.error("Не удалось сохранить списки фильмов:", err);
        }
    }, [movieStatuses]);

    useEffect(() => {
        try {
            localStorage.setItem(
                "movie-swipe-saved-movies",
                JSON.stringify(savedMovies),
            );
        } catch (err) {
            concole.error("Не удалось сохранить сведения о фильмах", err);
        }
    }, [savedMovies]);

    useEffect (() => {
        const controller = new AbortController();

        async function loadMovies() {
            try {
                const response = await fetch("/api/movies", {
                    signal: controller.signal,
                });

                if (!response.ok){
                    throw new Error(`Ошибка загрузки: ${response.status}`);
                }

                const data = await response.json();

                if (!Array.isArray(data?.items) || !Number.isInteger(data.totalPages)) {
                    throw new Error("Сервер вернул каталог в неожиданном формате");
                }

                const pages = Array.from(
                    { length: data.totalPages },
                    (_, index) => index + 1
                );

                const [firstPage, ...restPages] = shufflePages(pages);

                let items = [];

                if (firstPage === 1) {
                    items = data.items;
                } else if (firstPage !== undefined) {
                    const firstPageResponse = await fetch(
                        `/api/movies?page=${firstPage}`,
                        { signal: controller.signal }
                    );

                if (!firstPageResponse.ok) {
                    throw new Error("Не удалось загрузить первую подборку");
                }

                const firstPageData = await firstPageResponse.json();

                if (!Array.isArray(firstPageData?.items)) {
                    throw new Error("Сервер вернул каталог в неожиданном формате");
                }

                    items = firstPageData.items;
                }

                setMovies(items);
                setRemainingPages(restPages);
                setHasMore(restPages.length > 0);
            } catch (err){
                if (err.name !=="AbortError"){
                    setError("Не удалось загрузить фильм. Необходимо обновить страницу");
                }
            } finally {
                if (!controller.signal.aborted){
                    setIsLoading(false);
                }
            }
        }

        loadMovies();
        return () => {
            controller.abort();
        };
    }, []);

    const suggestedMovies = movies.filter(
        (item) => movieStatuses[item.id] !== "disliked"
    );

    const movie = suggestedMovies[currentIndex];
    const previousMovie = suggestedMovies[currentIndex - 1];
    const nextMovie = suggestedMovies[currentIndex + 1];
    const movieId = movie?.id;

    useEffect(() => {
        if (!movieId) {
            return;
        }

        const controller = new AbortController();

        setMovieDescription("");
        setIsDescriptionLoading(true);

        async function loadDescription(){
            try {
                const response = await fetch(`/api/movies/${movieId}`, {
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();

                if (!controller.signal.aborted) {
                    setMovieDescription(data.description);
                }
            } catch (err) {
                if (!controller.signal.aborted) {
                    setMovieDescription('Не удалось загрузить описание');
                }
            } finally {
                if (!controller.signal.aborted) {
                    setIsDescriptionLoading(false);
                }
            }
        }

        loadDescription();

        return () => controller.abort();
    }, [movieId]);

    const savedMoviesList = Object.values(savedMovies); //Object.values превращает объект с фильмами в массив его значений

    const wantedMovies = savedMoviesList.filter(
        (item) => movieStatuses[item.id] === "want"
    );

    const watchedMovies = savedMoviesList.filter(
        (item) => movieStatuses[item.id] === "watched"
    );

    function handleChoose(status){
        if (!movie) {
            return;
        }

        setSwipeHistory((previousHistory) => [
            ...previousHistory,
            {
                movieId: movie.id,
                index: currentIndex,
                previousStatus: movieStatuses[movie.id],
            },
        ]);

        setSavedMovies((previousMovies) => ({
            ...previousMovies,
            [movie.id]: movie,
        }));

        setMovieStatuses((previousStatuses) => ({
            ...previousStatuses,
            [movie.id]: status,
        }));

        setCurrentIndex((previousIndex) => previousIndex + 1);
        setIsMenuOpen(false);
    }

    function handleSkip() {
        setCurrentIndex((previousIndex) => previousIndex + 1);
        setIsMenuOpen(false);
    }

    function handleRestart() {
        setCurrentIndex(0);
        setIsMenuOpen(false);
        setSwipeHistory([]);;
    }

    function handleClearList(status) {
        const listName =
            status === "want" ? "Хочу посмотреть" : "Уже просмотрено";

        const confirmed = window.confirm(
            `Очистить список «${listName}»? Все фильмы будут удалены из этого списка.`
        );

        if (!confirmed) {
            return;
        }

        setMovieStatuses((previousStatuses) =>
            Object.fromEntries(
                Object.entries(previousStatuses).filter(
                    ([id, movieStatus]) => movieStatus !== status
                )
            )
        );

        setSwipeHistory([]);
    }

    function handleUndo() {
        const lastAction = swipeHistory[swipeHistory.length - 1];

        if (!lastAction) {
            return;
        }

        setMovieStatuses((previousStatuses) => {
            const updatedStatuses = { ...previousStatuses };

            if (lastAction.previousStatus === undefined) {
                delete updatedStatuses[lastAction.movieId];
            } else {
                updatedStatuses[lastAction.movieId] =
                    lastAction.previousStatus;
            }

            return updatedStatuses;
        });

        setCurrentIndex(lastAction.index);

        setSwipeHistory((previousHistory) =>
            previousHistory.slice(0, -1)
        );
    }

    async function handleLoadMore() {
        if (isLoadingMore || !hasMore) {
            return;
        }
        const [nextPage, ...restPages] = remainingPages;

        if (nextPage === undefined) {
            return;
        }

        setIsLoadingMore(true);
        setLoadMoreError("");

        try {

            const response = await fetch(`/api/movies?page=${nextPage}`);

            if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            if (!Array.isArray(data?.items) || !Number.isInteger(data.totalPages)) {
                throw new Error("Ожидался массив фильмов");
            }

            setMovies((previousMovies) => {
            const knownIds = new Set(
                previousMovies.map((item) => item.id)
            );

            const newMovies = data.items.filter((item) => {
                if (knownIds.has(item.id)) {
                    return false;
                }

                knownIds.add(item.id);
                    return true;
            });

            return [...previousMovies, ...newMovies];
            });

            setRemainingPages(restPages);
            setHasMore(restPages.length > 0);
        } catch (err) {
            setLoadMoreError("Не удалось загрузить следующую страницу.");
        } finally {
            setIsLoadingMore(false);
        }
    }

    function handleDislike() {
        if (!movie) {
            return;
        }

        setSavedMovies((previousMovies) => ({
            ...previousMovies,
            [movie.id]: movie,
        }));

        setMovieStatuses((previousStatuses) => ({
            ...previousStatuses,
            [movie.id]: 'disliked',
        }));

        setIsMenuOpen(false);
        setSwipeHistory([]);;
    }

    function handlePointerDown(event) {
        if (!event.isPrimary || event.button !== 0){ //	event.button - Какая кнопка вызвала событие; 0 — основная, обычно левая(те прекращаем если кнопка не основная или не основной указатель)
            return;
        }

        if (event.target.closest("button, a, input, select, textarea, summary")) { //event.target - Элемент, на котором возникло событие, Метод closest(...) ищет подходящий элемент сначала среди самого элемента, затем среди его родителей.
            return;
        }

        swipeRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
        };

        event.currentTarget.setPointerCapture(event.pointerId);

        setIsDragging(true);
        setIsMenuOpen(false);
    }

    function handlePointerMove(event) {
        const swipe = swipeRef.current;

        if (!swipe || swipe.pointerId !== event.pointerId) {
            return;
        }

            setDragX(event.clientX - swipe.startX);
        }

        function resetSwipe() {
            swipeRef.current = null;
            setDragX(0);
            setIsDragging(false);
        }

        function handlePointerUp(event) {
            const swipe = swipeRef.current;

            if (!swipe || swipe.pointerId !== event.pointerId) {
                return;
            }

        const distanceX = event.clientX - swipe.startX;
        const distanceY = event.clientY - swipe.startY;

  // Порог зависит от ширины карточки, но не превышает 100px.
        const threshold = Math.min(
            100,
            event.currentTarget.getBoundingClientRect().width * 0.25
        );

        const isHorizontal = Math.abs(distanceX) > Math.abs(distanceY);

        resetSwipe();

        if (!isHorizontal || Math.abs(distanceX) < threshold) {
            return;
        }

        handleChoose(distanceX > 0 ? "watched" : "want");
    }

    function handlePointerCancel() {
        resetSwipe();
    }

    useEffect(() => {
        setSavedMovies((previousMovies) => {
            const missingMovies = movies.filter(
            (item) =>
                movieStatuses[item.id] &&
                !Object.hasOwn(previousMovies, item.id)
            );

            if (missingMovies.length === 0) {
                return previousMovies;
            }

            const updatedMovies = { ...previousMovies };

            for (const item of missingMovies) {
                updatedMovies[item.id] = item;
            }

            return updatedMovies;
        });
    }, [movies, movieStatuses]);

    if (isLoading) {
        return (
        <main className="main">
            <p role="status">Загружаем фильмы…</p>
        </main>
        );
    }

    if (error) {
        return (
            <main className="main">
                <p role="alert">{error}</p>
            </main>
        );
    }

    return (
    <>
        <header className = "header">
            <h1>Movies from Alya</h1>
            <p>Выбери, что посмотреть в следущий раз</p>
        </header>

        <main className = 'main'>
            {movie ? (
                <div className="movie-stage">
                    {previousMovie?.poster && (
                        <img
                            className="movie-preview movie-preview--left"
                            src={previousMovie.poster}
                            alt=""
                            draggable={false}
                        />
                    )}

                    {nextMovie?.poster && (
                        <img
                            className="movie-preview movie-preview--right"
                            src={nextMovie.poster}
                            alt=""
                            draggable={false}
                        />
                    )}
                    <article
                        className={`movie-card swipe-card ${isDragging ? "is-dragging" : ""}`}
                        style={{
                            transform: `translateX(${dragX}px) rotate(${dragX / 25}deg)`,
                        }}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerCancel}
                        onLostPointerCapture={handlePointerCancel}
                        tabIndex={0}
                        aria-label="Карточка фильма. Стрелка вправо — хочу посмотреть, влево — уже просмотрено."
                        onKeyDown={(event) => {
                            if (event.target !== event.currentTarget || event.repeat) {
                                return;
                            }

                            if (event.key === "ArrowLeft") {
                                event.preventDefault();
                                resetSwipe();
                                handleChoose("watched");
                            }

                            if (event.key === "ArrowRight") {
                                event.preventDefault();
                                resetSwipe();
                                handleChoose("want");
                            }
                        }}
                        >
                        <div className="card-menu">
                            <button
                                type="button"
                                className="card-menu-toggle"
                                aria-label="Действия с фильмом"
                                aria-expanded={isMenuOpen}
                                onClick={() => setIsMenuOpen((previous) => !previous)}
                            >
                                ⋯
                            </button>

                            {isMenuOpen && (
                                <div className="card-menu-dropdown">
                                <button type="button" onClick={handleDislike}>
                                    Не нравится
                                </button>
                                </div>
                            )}
                            </div>

                            <div className="swipe-hints">
                                <span className="swipe-hint">
                                    <span aria-hidden="true">←</span>
                                </span>
                                <span className="swipe-hint">
                                    <span aria-hidden="true">→</span>
                                </span>
                            </div>
                        <p>Фильм {currentIndex + 1} из {suggestedMovies.length}</p>

                        {movie.poster && (
                            <img className = 'movie-poster'
                            draggable={false}
                            src = {movie.poster}
                            alt = {`Постер фильма "${movie.title}"`} />
                        )}
                        <h2>{movie.title}</h2>
                        <p>Рейтинг Кинопоиска: {movie.rating ?? "Нет оценки"}</p>
                        <p>{movie.year} * {movie.genre}</p>
                        <details>
                            <summary>Описание:</summary>
                            <p>
                                {isDescriptionLoading ? 'Загружаем описание...' : movieDescription}   
                            </p>
                        </details>
                        <div className = 'movie-actions'>
                            <button type="button" onClick={handleSkip}>Пропустить</button>
                            <button type="button" onClick={handleUndo} disabled={swipeHistory.length === 0}>↶ Отменить свайп</button>
                        </div>
                    </article>
                </div>
            ) : (
                <section className="movie-card">
                    <h2>Фильмы просмотрены</h2>
                    <button
                        type="button"
                        onClick={handleUndo}
                        disabled={swipeHistory.length === 0}
                    >
                        ↶ Отменить свайп
                    </button>
                    <p>
                        {movies.length === 0
                            ? "В подборке пока нет фильмов."
                            : "Ты просмотрела все карточки этой подборки."}
                    </p>
                    
                    {hasMore && (
                        <button
                            type="button"
                            onClick={handleLoadMore}
                            disabled={isLoadingMore}
                        >
                            {isLoadingMore ? "Загружаем…" : "Ещё фильмы"}
                        </button>
                    )}

                    {loadMoreError && (
                        <p role="alert">{loadMoreError}</p>
                        )}

                    {!hasMore && (
                        <p>Доступная подборка закончилась</p>
                    )}

                    <button type="button" onClick={handleRestart}>Начать заново</button>
                </section>
                )}

            <div className = 'movie-lists'>
                <section className = 'movie-list'>
                    <h2> Хочу посмотреть: {wantedMovies.length}</h2>

                    <button
                        type="button"
                        className="clear-list-button"
                        onClick={() => handleClearList("want")}
                        disabled={wantedMovies.length === 0}
                    >Очистить список</button>

                    {wantedMovies.length === 0 ? (
                        <p>Пока здесь нет фильмов</p>
                    ) : (
                        <ul>
                            {wantedMovies.map((item) => (
                                <li key = {item.id}>
                                    {item.title} * {item.year}
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section className = "movie-list">
                    <h2>Уже просмотрено: {watchedMovies.length}</h2>

                    <button
                        type="button"
                        className="clear-list-button"
                        onClick={() => handleClearList("watched")}
                        disabled={watchedMovies.length === 0}
                    >Очистить список</button>

                    {watchedMovies.length === 0 ? (
                        <p>Пока здесь нет фильмов</p>
                    ) : (
                        <ul>
                            {watchedMovies.map((item) => (
                                <li key = {item.id}>
                                    {item.title} * {item.year}
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
                </div>
            </main>
        </>
    );
}