import { useState, FormEvent, useRef, useEffect } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { MovieDetails, Still, WatchProvider } from "./api/tmdb";
import * as Accordion from "@radix-ui/react-accordion";

gsap.registerPlugin(useGSAP);

interface RecommendedMovie {
    title: string;
    year: string;
    language: string;
    reason: string;
}

const Home = () => {
    const [movieInput, setMovieInput] = useState("");
    const [movies, setMovies] = useState<string[]>([]);
    const [value, setValue] = useState("one");
    const [movieDetails, setMovieDetails] = useState<MovieDetails[]>([]);
    //const [dominantColors, setDominantColors] = useState<string[]>([]);
    const [selectedMovie, setSelectedMovie] = useState<MovieDetails | null>(
        null
    );

    const [userCountry, setUserCountry] = useState<string | null>(null);
    const [recommendationStatus, setRecommendationStatus] = useState<
        "idle" | "loading" | "completed"
    >("idle");
    const [isSmallScreen, setIsSmallScreen] = useState(false);

    const recDetailsRef = useRef<HTMLDivElement>(null);
    const recDetailsContentRef = useRef<HTMLDivElement>(null);
    const endRef = useRef<HTMLDivElement>(null);
    const recommendationSectionRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (movieDetails.length > 0) {
            const fetchColors = async () => {
                const colors = await Promise.all(
                    movieDetails.map((movie) =>
                        getDominantColors(`/api/tmdb/w200${movie.poster_path}`)
                    )
                );

                // Set the CSS variable for each poster's dominant color
                colors.forEach((colorArray, index) => {
                    const dominantColor = colorArray[0];
                    document.documentElement.style.setProperty(
                        `--poster-color-${index}`,
                        dominantColor
                    );
                });
            };

            fetchColors();
        }
    }, [movieDetails]);

    useEffect(() => {
        if (movieDetails.length > 0) {
            // Fade in movie cards when movie details are updated
            gsap.fromTo(
                ".recommended-titles",
                { opacity: 0, y: 20 },
                {
                    opacity: 1,
                    y: 0,
                    duration: 0.5,
                    ease: "power3.out",
                }
            );
        }
    }, [movieDetails]);

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
        console.log(userCountry);
        return () => window.removeEventListener("resize", checkScreenSize);
    }, []);

    const addMovieToList = () => {
        if (movieInput.trim() === "") return;
        setMovies([...movies, movieInput]);
        setMovieInput("");
    };

    const removeMovieFromList = (index: number) => {
        const updatedMovies = movies.filter((_, i) => i !== index);
        setRecommendationStatus("idle");
        closeDetails();
        setMovies(updatedMovies);
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        if (movies.length < 2) {
            alert("Please add at least two movies");
            return;
        }

        setRecommendationStatus("loading");
        setMovieDetails([]);
        setSelectedMovie(null);

        if (isSmallScreen && endRef.current) {
            endRef.current.scrollIntoView({
                behavior: "smooth",
            });
        }

        const moviePrompt = movies.join(", ");
        const prompt = `Given the film "${moviePrompt}", provide four similar movie recommendations. For each recommendation, include:
1. original title (even if it is in foreign characters, including any special characters, properly escaped for JSON)
2. The release year (YYYY format)
3. The primary language of the film (English, Korean, French, etc.)
4. A detailed explanation of why it's similar, in summary and then in extensive bullet points, make the structure of the reason constant
5. Movies only, no series or limited series
6. Treat each new prompt as a fresh request, don't use context from previous queries

Format the response as valid JSON with the following structure:
{
  "recommendations": [
    {
      "title": "Movie Title Here",
      "year": "2000",
      "language": "English",
      "reason": "Detailed explanation here"
    }
  ]
}

IMPORTANT:
- Ensure all text is properly escaped for JSON
- Use double quotes for all strings
- Do not use line breaks within strings
- Provide exactly 4 recommendations
- Verify the response is valid JSON before completing

Give only the JSON response with no additional text.`;

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
                            year: movie.year,
                            language: movie.language,
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
                        recommendations: recommendedMovies,
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

    // const calculateBrightness = (r: number, g: number, b: number): number => {
    //     return (r * 299 + g * 587 + b * 114) / 1000;
    // };

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
                        return {
                            color: `rgb(${color})`,
                            isNearBlack: isNearBlack(r, g, b),
                            isNearWhite: isNearWhite(r, g, b),
                        };
                    });

                // Find the first non-near-black and non-near-white color, fallback to a neutral gray if all are too close to black or white
                let selectedColor = sortedColors.find(
                    ({ isNearBlack, isNearWhite }) =>
                        !isNearBlack && !isNearWhite
                )?.color;

                // If no suitable color found, use fallback gray
                if (!selectedColor) {
                    selectedColor = "rgb(128, 128, 128)";
                }

                // Resolve with the first non-near-black/white color and top 'colorCount' colors
                const selectedColors = sortedColors
                    .slice(0, colorCount)
                    .map(({ color, isNearBlack, isNearWhite }) =>
                        isNearBlack || isNearWhite
                            ? "rgb(128, 128, 128)"
                            : color
                    );

                // Set the first selected color to the chosen dominant one
                selectedColors[0] = selectedColor;

                resolve(selectedColors);
            };

            img.onerror = () => {
                console.error("Error loading image:", imageUrl);
                resolve(["rgb(200,200,200)"]);
            };
        });
    };

    // Utility function to check if a color is near black
    const isNearBlack = (r: number, g: number, b: number): boolean => {
        const threshold = 50; // Threshold for black detection
        return r < threshold && g < threshold && b < threshold;
    };

    // Utility function to check if a color is near white
    const isNearWhite = (r: number, g: number, b: number): boolean => {
        const threshold = 205; // Threshold for white detection
        return r > threshold && g > threshold && b > threshold;
    };

    const handleMovieClick = async (movie: MovieDetails) => {
        const posterUrl = `/api/tmdb/w200${movie.poster_path}`;

        // Directly use the movie object, which already includes OMDb data
        const movieWithDetails = movie; // This already has omdb_data included

        setSelectedMovie(movieWithDetails); // Update state to include TMDB and OMDb data

        function calculateBrightness(r: number, g: number, b: number): number {
            // Using the formula: (299*R + 587*G + 114*B) / 1000
            return (299 * r + 587 * g + 114 * b) / 1000;
        }

        // Your existing code with some improvements
        const dominantColors = await getDominantColors(posterUrl);
        if (recDetailsContentRef.current && dominantColors.length > 0) {
            const backgroundColor = dominantColors[0];

            // Extract RGB values
            const [r, g, b] = backgroundColor.match(/\d+/g)!.map(Number);

            // Calculate brightness
            const brightness = calculateBrightness(r, g, b);

            // Set background color
            // recDetailsContentRef.current.style.backgroundColor =
            //     backgroundColor;

            // Set text color based on brightness
            const textColor = brightness > 125 ? "black" : "white";
            recDetailsContentRef.current.style.color = textColor;

            // Set CSS variables for global use
            document.documentElement.style.setProperty(
                "--dominant-color",
                backgroundColor
            );
            document.documentElement.style.setProperty(
                "--contrast-text-color",
                textColor
            );
        }

        openDetails();
    };

    const openDetails = () => {
        gsap.to(recDetailsRef.current, { y: "-102%", duration: 1 });
    };
    const closeDetails = () => {
        gsap.to(recDetailsRef.current, { y: "102%", duration: 1.5 });
        // Optionally reset background color when closed
        if (recDetailsRef.current) {
            recDetailsRef.current.style.backgroundColor = "transparent"; // or a default color
        }
        setValue("item-1");
        console.log(value);
    };

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
        closeDetails();
    };

    //console.log(selectedMovie);

    return (
        <div className="main-container">
            <div className="title-input-section title-input-bg">
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
                <div className="recommendation-section-inner">
                    <div className="background-layer">
                        <div className="triangle xlt"></div>
                        <div className="triangle large"></div>
                        <div className="triangle medium"></div>
                        <div className="triangle small"></div>
                    </div>
                    <div className="recommended-titles-container">
                        <div className="recommended-list">
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
                                                    className="movie-card-image"
                                                />
                                                <div className="movie-card-text">
                                                    <h4>{movie.title}</h4>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div>
                                        {/*empty div to centralize recommended-titles*/}
                                    </div>
                                </>
                            )}
                        </div>
                        <div
                            className="recommended-details"
                            id="style-2"
                            ref={recDetailsRef}
                            //onClick={closeDetails}
                        >
                            <div
                                className="recommended-details-content"
                                ref={recDetailsContentRef}
                            >
                                {selectedMovie ? (
                                    <>
                                        <Accordion.Root
                                            type="single"
                                            defaultValue="item-1"
                                            className="accordion-root"
                                        >
                                            <Accordion.Item
                                                value="item-1"
                                                className="accordion-item"
                                            >
                                                <Accordion.Trigger className="accordion-trigger">
                                                    <span
                                                        style={{
                                                            display: "flex",
                                                            alignItems:
                                                                "center",
                                                        }}
                                                    >
                                                        <h2>
                                                            {
                                                                selectedMovie.title
                                                            }
                                                            <span>
                                                                {" "}
                                                                &nbsp;
                                                                {`(${
                                                                    selectedMovie.release_date.split(
                                                                        "-"
                                                                    )[0]
                                                                })`}
                                                            </span>
                                                        </h2>
                                                    </span>

                                                    <button
                                                        onClick={closeDetails}
                                                        className="close-button"
                                                    >
                                                        Close
                                                    </button>
                                                </Accordion.Trigger>
                                                <Accordion.Content className="accordion-content">
                                                    <div className="details-main">
                                                        {selectedMovie.stills &&
                                                            selectedMovie
                                                                .stills[1] && (
                                                                <img
                                                                    src={`https://image.tmdb.org/t/p/w500${selectedMovie.stills[1].file_path}`}
                                                                    alt="Movie still"
                                                                    className="details-main-poster"
                                                                />
                                                            )}
                                                        <div className="details-main-data">
                                                            <div className="scores-metadata">
                                                                {selectedMovie.omdb_data && (
                                                                    <>
                                                                        <div className="duration-rating">
                                                                            <strong>
                                                                                {
                                                                                    selectedMovie
                                                                                        .omdb_data
                                                                                        .rated
                                                                                }
                                                                            </strong>
                                                                            <div className="vertical-divider"></div>
                                                                            <strong>
                                                                                {
                                                                                    selectedMovie
                                                                                        .omdb_data
                                                                                        .runtime
                                                                                }
                                                                            </strong>
                                                                        </div>

                                                                        <div className="divider"></div>
                                                                        <p>
                                                                            <strong>
                                                                                Metascore:
                                                                            </strong>{" "}
                                                                            {
                                                                                selectedMovie
                                                                                    .omdb_data
                                                                                    .metascore
                                                                            }
                                                                        </p>
                                                                        <p>
                                                                            <strong>
                                                                                IMDb:
                                                                            </strong>{" "}
                                                                            {
                                                                                selectedMovie
                                                                                    .omdb_data
                                                                                    .imdbRating
                                                                            }
                                                                        </p>
                                                                        <p>
                                                                            <strong>
                                                                                Letterboxd:
                                                                            </strong>
                                                                            N/A
                                                                        </p>
                                                                    </>
                                                                )}
                                                            </div>
                                                            <div className="cast-crew">
                                                                {selectedMovie.omdb_data && (
                                                                    <>
                                                                        <p>
                                                                            <strong>
                                                                                Director:
                                                                            </strong>{" "}
                                                                            {
                                                                                selectedMovie
                                                                                    .omdb_data
                                                                                    .director
                                                                            }
                                                                        </p>
                                                                        <div className="divider-black"></div>
                                                                        <p>
                                                                            <strong>
                                                                                Starring:
                                                                            </strong>{" "}
                                                                            {
                                                                                selectedMovie
                                                                                    .omdb_data
                                                                                    .actors
                                                                            }
                                                                        </p>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="synopsis">
                                                            <p>
                                                                {
                                                                    selectedMovie.overview
                                                                }
                                                            </p>
                                                        </div>
                                                    </div>
                                                </Accordion.Content>
                                            </Accordion.Item>
                                            <Accordion.Item
                                                value="item-2"
                                                className="accordion-item"
                                            >
                                                <Accordion.Trigger className="accordion-trigger">
                                                    <h3>
                                                        Reason For
                                                        Recommendation
                                                    </h3>
                                                </Accordion.Trigger>
                                                <Accordion.Content className="accordion-content">
                                                    {selectedMovie.reason
                                                        .split("•")
                                                        .map((item, index) => {
                                                            const trimmedItem =
                                                                item.trim();
                                                            return (
                                                                <div
                                                                    key={index}
                                                                    className={
                                                                        index ===
                                                                        0
                                                                            ? "first-point"
                                                                            : "subsequent-point"
                                                                    }
                                                                >
                                                                    {trimmedItem.includes(
                                                                        "Detailed reasons:"
                                                                    )
                                                                        ? trimmedItem.replace(
                                                                              "Detailed reasons:",
                                                                              ""
                                                                          )
                                                                        : trimmedItem}
                                                                </div>
                                                            );
                                                        })}
                                                </Accordion.Content>
                                            </Accordion.Item>
                                            <Accordion.Item
                                                value="item-3"
                                                className="accordion-item"
                                            >
                                                <Accordion.Trigger className="accordion-trigger">
                                                    <h3>
                                                        Trailer | Stills | Promo
                                                        Material
                                                    </h3>
                                                </Accordion.Trigger>
                                                <Accordion.Content className="accordion-content">
                                                    <div className="promo-container">
                                                        <div className="trailer">
                                                            {selectedMovie
                                                                .trailers
                                                                .length > 0 && (
                                                                <>
                                                                    <h3>
                                                                        Trailer
                                                                    </h3>
                                                                    <div>
                                                                        <iframe
                                                                            width="560"
                                                                            height="315"
                                                                            src={`https://www.youtube.com/embed/${selectedMovie.trailers[0].key}`}
                                                                            title={
                                                                                selectedMovie
                                                                                    .trailers[0]
                                                                                    .name
                                                                            }
                                                                            frameBorder="0"
                                                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                                            allowFullScreen
                                                                        ></iframe>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                        <div className="stills-container">
                                                            <h3>Images</h3>
                                                            {/* Render Stills */}
                                                            {selectedMovie.stills &&
                                                                selectedMovie.stills.map(
                                                                    (
                                                                        still: Still,
                                                                        index: number
                                                                    ) => (
                                                                        <img
                                                                            key={
                                                                                index
                                                                            }
                                                                            src={`https://image.tmdb.org/t/p/w500${still.file_path}`}
                                                                            alt="Movie still"
                                                                        />
                                                                    )
                                                                )}
                                                        </div>
                                                    </div>
                                                </Accordion.Content>
                                            </Accordion.Item>
                                            <Accordion.Item
                                                value="item-4"
                                                className="accordion-item"
                                            >
                                                <Accordion.Trigger className="accordion-trigger">
                                                    <h3>Watch</h3>
                                                </Accordion.Trigger>
                                                <Accordion.Content className="accordion-content">
                                                    <div className="watch-container">
                                                        {/* Render Watch Providers */}
                                                        {selectedMovie.watch_providers &&
                                                            userCountry && (
                                                                <>
                                                                    <p>
                                                                        Providers:
                                                                    </p>
                                                                    {selectedMovie
                                                                        .watch_providers[
                                                                        userCountry
                                                                    ] ? (
                                                                        selectedMovie
                                                                            .watch_providers[
                                                                            userCountry
                                                                        ]
                                                                            .flatrate &&
                                                                        selectedMovie
                                                                            .watch_providers[
                                                                            userCountry
                                                                        ]
                                                                            .flatrate
                                                                            .length >
                                                                            0 ? (
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
                                                                                Providers
                                                                                not
                                                                                available
                                                                                in
                                                                                your
                                                                                region.
                                                                            </p>
                                                                        )
                                                                    ) : (
                                                                        <p>
                                                                            Providers
                                                                            not
                                                                            available
                                                                            in
                                                                            your
                                                                            region.
                                                                        </p>
                                                                    )}
                                                                </>
                                                            )}
                                                    </div>
                                                </Accordion.Content>
                                            </Accordion.Item>
                                        </Accordion.Root>
                                    </>
                                ) : (
                                    <p>Select a movie to see its details</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div ref={endRef} className="end-ref"></div>
        </div>
    );
};

export default Home;
