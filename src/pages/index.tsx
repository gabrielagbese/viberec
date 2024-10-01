import { useState, FormEvent, useRef, useEffect } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { MovieDetails, Still, WatchProvider } from "./api/tmdb";

gsap.registerPlugin(useGSAP);

// interface Provider {
//     provider_id: number;
//     provider_name: string;
//     logo_path: string | null; // Allowing null since the logo path might not always be available
// }

// interface WatchProvidersResponse {
//     [region: string]: {
//         results: {
//             flatrate?: Provider[]; // Optional property for flat-rate providers
//             rent?: Provider[]; // Optional property for rental providers
//             buy?: Provider[]; // Optional property for purchase providers
//         };
//     };
// }

interface RecommendedMovie {
    title: string; // Title of the recommended movie
    reason: string; // Reason why the movie is recommended
}

const Home = () => {
    const [movieInput, setMovieInput] = useState("");
    const [movies, setMovies] = useState<string[]>([]);
    const [movieDetails, setMovieDetails] = useState<MovieDetails[]>([]);
    const [selectedMovie, setSelectedMovie] = useState<MovieDetails | null>(
        null
    );

    const [userCountry, setUserCountry] = useState<string | null>(null);
    const [recommendationStatus, setRecommendationStatus] = useState<
        "idle" | "loading" | "completed"
    >("idle");
    const [isSmallScreen, setIsSmallScreen] = useState(false);

    const recDetailsRef = useRef<HTMLDivElement>(null);

    const recommendationSectionRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const checkScreenSize = () => {
            setIsSmallScreen(window.innerWidth < 1025);
        };

        checkScreenSize();
        window.addEventListener("resize", checkScreenSize);
        // Fetch user's country
        fetch("/api/country")
            .then((res) => res.json())
            .then((data) => setUserCountry(data.country))
            .catch((error) => console.error("Error fetching country:", error));
        //console.log(userCountry);
        return () => window.removeEventListener("resize", checkScreenSize);
    }, []);

    const addMovieToList = () => {
        if (movieInput.trim() === "") return;
        setMovies([...movies, movieInput]);
        setMovieInput("");
    };

    const removeMovieFromList = (index: number) => {
        const updatedMovies = movies.filter((_, i) => i !== index);
        setMovies(updatedMovies);
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        if (movies.length === 0) {
            alert("Please add at least one movie title");
            return;
        }

        setRecommendationStatus("loading");
        setMovieDetails([]);
        setSelectedMovie(null);

        if (isSmallScreen && recommendationSectionRef.current) {
            recommendationSectionRef.current.scrollIntoView({
                behavior: "smooth",
            });
        }

        const moviePrompt = movies.join(", ");
        const prompt = `Give me the names of four films that are similar to ${moviePrompt}. Give the response as the movie titles and why they were recommended (in detail) in JSON format. Give just the answer, so I only receive JSON.`;

        try {
            const res = await fetch("/api/anthropic", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ userInput: prompt }),
            });

            const data = await res.json();
            let recommendedMovies = [];

            try {
                const parsedResponse = JSON.parse(data.completion);
                if (
                    parsedResponse &&
                    parsedResponse.recommendations &&
                    Array.isArray(parsedResponse.recommendations)
                ) {
                    recommendedMovies = parsedResponse.recommendations.map(
                        (movie: RecommendedMovie) => ({
                            title: movie.title,
                            reason: movie.reason,
                        })
                    );
                } else {
                    console.error(
                        "Recommendations are not in the expected format:",
                        parsedResponse
                    );
                }
            } catch (error) {
                console.error("Error parsing JSON:", error);
                alert("Error in the response format. Please try again.");
            }

            if (recommendedMovies.length > 0) {
                const tmdbRes = await fetch("/api/tmdb", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        titles: recommendedMovies.map(
                            (movie: RecommendedMovie) => movie.title
                        ),
                    }),
                });

                const tmdbData = await tmdbRes.json();

                const combinedData = tmdbData.map(
                    (tmdbMovie: MovieDetails, index: number) => ({
                        ...tmdbMovie,
                        reason: recommendedMovies[index].reason,
                    })
                );

                setMovieDetails(combinedData);
            }

            setRecommendationStatus("completed");
        } catch (error) {
            console.error("Error during submission:", error);
            setRecommendationStatus("idle");
        }
    };

    const calculateBrightness = (r: number, g: number, b: number): number => {
        return (r * 299 + g * 587 + b * 114) / 1000;
    };

    const isNearBlack = (r: number, g: number, b: number): boolean => {
        return r <= 10 && g <= 10 && b <= 10;
    };

    const brightenColor = (color: string, factor: number = 7): string => {
        const rgb = color.match(/\d+/g)!.map(Number);
        if (isNearBlack(rgb[0], rgb[1], rgb[2])) {
            return "rgb(128, 128, 128)"; // Return medium grey for near-black colors
        }
        const brightenedRgb = rgb.map((channel) =>
            Math.min(255, Math.round(channel * factor))
        );
        return `rgb(${brightenedRgb.join(",")})`;
    };

    const getDominantColors = (
        imageUrl: string,
        colorCount: number = 5
    ): Promise<string[]> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.src = imageUrl;

            img.onload = () => {
                const canvas = document.createElement("canvas");
                const context = canvas.getContext("2d");
                if (!context) return resolve(["rgb(200,200,200)"]);

                canvas.width = img.width;
                canvas.height = img.height;
                context.drawImage(img, 0, 0);

                const imageData = context.getImageData(
                    0,
                    0,
                    canvas.width,
                    canvas.height
                );
                const data = imageData.data;

                const colorCounts: { [key: string]: number } = {};
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    const rgb = `${r},${g},${b}`;
                    colorCounts[rgb] = (colorCounts[rgb] || 0) + 1;
                }

                const sortedColors = Object.entries(colorCounts)
                    .sort(([, a], [, b]) => b - a)
                    .map(([color]) => {
                        const [r, g, b] = color.split(",").map(Number);
                        const brightness = calculateBrightness(r, g, b);
                        return {
                            color: `rgb(${color})`,
                            brightness,
                            isNearBlack: isNearBlack(r, g, b),
                        };
                    });

                const selectedColors = sortedColors
                    .slice(0, colorCount)
                    .map(({ color, brightness, isNearBlack }) =>
                        isNearBlack
                            ? "rgb(128, 128, 128)"
                            : brightness <= 80
                            ? brightenColor(color)
                            : color
                    );

                resolve(selectedColors);
            };

            img.onerror = () => {
                console.error("Error loading image:", imageUrl);
                resolve(["rgb(200,200,200)"]);
            };
        });
    };

    const handleMovieClick = async (movie: MovieDetails) => {
        const posterUrl = `/api/tmdb/w200${movie.poster_path}`;

        // Directly use the movie object, which already includes OMDb data
        const movieWithDetails = movie; // This already has omdb_data included

        setSelectedMovie(movieWithDetails); // Update state to include TMDB and OMDb data

        const dominantColors = await getDominantColors(posterUrl);
        if (recDetailsRef.current && dominantColors.length > 0) {
            const backgroundColor = dominantColors[0];
            recDetailsRef.current.style.backgroundColor = backgroundColor;

            const [r, g, b] = backgroundColor.match(/\d+/g)!.map(Number);
            const brightness = calculateBrightness(r, g, b);
            recDetailsRef.current.style.color =
                brightness > 125 ? "black" : "white";
        }

        openDetails();
    };

    const openDetails = () => {
        gsap.to(recDetailsRef.current, { y: "-100%" });
    };
    const closeDetails = () => {
        gsap.to(recDetailsRef.current, { y: "100%" });
        // Optionally reset background color when closed
        if (recDetailsRef.current) {
            recDetailsRef.current.style.backgroundColor = "transparent"; // or a default color
        }
    };

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    //console.log(selectedMovie);

    return (
        <div className="main-container">
            <div className="title-input-section">
                <h1>Movie Recommendation System</h1>
                <form onSubmit={handleSubmit}>
                    <div>
                        <input
                            type="text"
                            value={movieInput}
                            onChange={(e) => setMovieInput(e.target.value)}
                            placeholder="Enter a movie title"
                        />
                        <button type="button" onClick={addMovieToList}>
                            +
                        </button>
                    </div>

                    <ul>
                        {movies.map((movie, index) => (
                            <li key={index}>
                                {movie}{" "}
                                <button
                                    onClick={() => removeMovieFromList(index)}
                                >
                                    Remove
                                </button>
                            </li>
                        ))}
                    </ul>

                    <button type="submit">Submit</button>
                </form>
            </div>
            <div
                className="recommendation-section"
                ref={recommendationSectionRef}
            >
                {isSmallScreen && (
                    <button onClick={scrollToTop} className="back-to-top">
                        Back to Top
                    </button>
                )}
                <div>
                    <div className="recommended-titles-container magicpattern">
                        {recommendationStatus === "idle" ? (
                            <p>
                                Enter movie titles and click Submit to get
                                recommendations.
                            </p>
                        ) : recommendationStatus === "loading" ? (
                            <p>Loading movie recommendations...</p>
                        ) : (
                            <>
                                <div className="recommended-titles ">
                                    {movieDetails.map((movie, index) => (
                                        <div
                                            key={index}
                                            className="movie-card"
                                            onClick={() =>
                                                handleMovieClick(movie)
                                            }
                                            style={{ cursor: "pointer" }}
                                        >
                                            <img
                                                src={`https://image.tmdb.org/t/p/w200${movie.poster_path}`}
                                                alt={`${movie.title} poster`}
                                                style={{ width: "100%" }}
                                            />
                                            <h4>{movie.title}</h4>
                                        </div>
                                    ))}
                                </div>
                                <div>
                                    {/*empty div to centralize recommended-titles*/}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="recommended-details" ref={recDetailsRef}>
                        {selectedMovie ? (
                            <>
                                <h2>{selectedMovie.title}</h2>
                                <p>
                                    <strong>Release Date:</strong>{" "}
                                    {selectedMovie.release_date}
                                </p>
                                <button onClick={closeDetails}>Close</button>
                                <p>{selectedMovie.overview}</p>
                                {selectedMovie.poster_path && (
                                    <img
                                        src={`https://image.tmdb.org/t/p/w200${selectedMovie.poster_path}`}
                                        alt={`${selectedMovie.title} poster`}
                                        style={{ width: "200px" }}
                                    />
                                )}
                                <p>
                                    <strong>Reason for recommendation:</strong>{" "}
                                    {selectedMovie.reason}
                                </p>

                                {/* Render OMDb details */}
                                {selectedMovie.omdb_data && (
                                    <>
                                        <p>
                                            <strong>Director:</strong>{" "}
                                            {selectedMovie.omdb_data.director}
                                        </p>
                                        <p>
                                            <strong>Starring:</strong>{" "}
                                            {selectedMovie.omdb_data.actors}
                                        </p>
                                        <p>
                                            <strong>Rated:</strong>{" "}
                                            {selectedMovie.omdb_data.rated}
                                        </p>
                                        <p>
                                            <strong>Runtime:</strong>{" "}
                                            {selectedMovie.omdb_data.runtime}
                                        </p>
                                        <p>
                                            <strong>Genre:</strong>{" "}
                                            {selectedMovie.omdb_data.genre}
                                        </p>
                                        <p>
                                            <strong>Metascore:</strong>{" "}
                                            {selectedMovie.omdb_data.metascore}
                                        </p>
                                        <p>
                                            <strong>IMDb Rating:</strong>{" "}
                                            {selectedMovie.omdb_data.imdbRating}
                                        </p>
                                    </>
                                )}

                                {/* Render Trailers */}
                                {selectedMovie.trailers.length > 0 && (
                                    <div>
                                        <h3>Trailer:</h3>
                                        <iframe
                                            width="560"
                                            height="315"
                                            src={`https://www.youtube.com/embed/${selectedMovie.trailers[0].key}`}
                                            title={
                                                selectedMovie.trailers[0].name
                                            }
                                            frameBorder="0"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                        ></iframe>
                                    </div>
                                )}

                                {/* Render Stills */}
                                {selectedMovie.stills &&
                                    selectedMovie.stills.map(
                                        (still: Still, index: number) => (
                                            <img
                                                key={index}
                                                src={`https://image.tmdb.org/t/p/w500${still.file_path}`}
                                                alt="Movie still"
                                            />
                                        )
                                    )}

                                {/* Render Watch Providers */}
                                {selectedMovie.watch_providers &&
                                    userCountry && (
                                        <>
                                            <p>Providers:</p>
                                            {selectedMovie.watch_providers[
                                                userCountry
                                            ] ? (
                                                selectedMovie.watch_providers[
                                                    userCountry
                                                ].flatrate &&
                                                selectedMovie.watch_providers[
                                                    userCountry
                                                ].flatrate.length > 0 ? (
                                                    selectedMovie.watch_providers[
                                                        userCountry
                                                    ].flatrate.map(
                                                        (
                                                            provider: WatchProvider
                                                        ) => (
                                                            <div
                                                                key={
                                                                    provider.provider_id
                                                                }
                                                                style={{
                                                                    display:
                                                                        "flex",
                                                                    alignItems:
                                                                        "center",
                                                                    marginBottom:
                                                                        "5px",
                                                                }}
                                                            >
                                                                {provider.logo_path ? (
                                                                    <img
                                                                        src={`https://image.tmdb.org/t/p/w500${provider.logo_path}`}
                                                                        alt={
                                                                            provider.provider_name
                                                                        }
                                                                        style={{
                                                                            width: "30px",
                                                                            height: "30px",
                                                                            marginRight:
                                                                                "10px",
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <div
                                                                        style={{
                                                                            width: "30px",
                                                                            height: "30px",
                                                                            marginRight:
                                                                                "10px",
                                                                            backgroundColor:
                                                                                "#ccc",
                                                                        }}
                                                                    />
                                                                )}
                                                                <p>
                                                                    {
                                                                        provider.provider_name
                                                                    }
                                                                </p>
                                                            </div>
                                                        )
                                                    )
                                                ) : (
                                                    <p>
                                                        Providers not available
                                                        in your region.
                                                    </p>
                                                )
                                            ) : (
                                                <p>
                                                    Providers not available in
                                                    your region.
                                                </p>
                                            )}
                                        </>
                                    )}
                            </>
                        ) : (
                            <p>Select a movie to see its details</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Home;
