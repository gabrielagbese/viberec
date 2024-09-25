import { useState, FormEvent, useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

const Home = () => {
    const [movieInput, setMovieInput] = useState("");
    const [movies, setMovies] = useState<string[]>([]);
    const [movieDetails, setMovieDetails] = useState<any[]>([]);
    const [selectedMovie, setSelectedMovie] = useState<any>(null); // To store the selected movie
    const [loading, setLoading] = useState(false);

    const recDetailsRef = useRef(null);

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

        setLoading(true);
        setMovieDetails([]);
        setSelectedMovie(null); // Reset selected movie on new submission

        const moviePrompt = movies.join(", ");
        const prompt = `Give me the names of four films that are similar to ${moviePrompt}. Give the response as the movie titles and why they were recommended in JSON format. Give just the answer, so I only receive JSON.`;

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
                        (movie: any) => ({
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
                        titles: recommendedMovies.map((movie) => movie.title),
                    }),
                });

                const tmdbData = await tmdbRes.json();

                const combinedData = tmdbData.map(
                    (tmdbMovie: any, index: number) => ({
                        ...tmdbMovie,
                        reason: recommendedMovies[index].reason, // Attach the reason to each movie
                    })
                );

                setMovieDetails(combinedData);
            }

            setLoading(false);
        } catch (error) {
            console.error("Error during submission:", error);
            setLoading(false);
        }
    };

    // Function to handle movie click and display details in the second div
    const handleMovieClick = (movie: any) => {
        setSelectedMovie(movie); // Set the clicked movie as selected
        openDetails();
    };

    const openDetails = () => {
        gsap.to(recDetailsRef.current, { y: "-100%" });
    };
    const closeDetails = () => {
        gsap.to(recDetailsRef.current, { y: "100%" });
    };

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
            <div className="recommendation-section">
                {loading && <p>Loading movie recommendations...</p>}

                <div>
                    {/* First Div: Display movie posters and titles */}
                    <div className="recommended-titles">
                        <h2>Recommended Movies</h2>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(2, 1fr)",
                                gap: "10px",
                            }}
                        >
                            {movieDetails.map((movie, index) => (
                                <div
                                    key={index}
                                    className="movie-card"
                                    onClick={() => handleMovieClick(movie)}
                                    style={{ cursor: "pointer" }}
                                >
                                    <img
                                        src={`https://image.tmdb.org/t/p/w200${movie.poster_path}`}
                                        alt={`${movie.title} poster`}
                                        style={{ width: "100%" }}
                                    />
                                    <p>{movie.title}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Second Div: Display movie details when a movie is clicked */}
                    <div className="recommended-details" ref={recDetailsRef}>
                        {selectedMovie ? (
                            <>
                                <h2>{selectedMovie.title}</h2>
                                <p>
                                    <strong>Release Date:</strong>{" "}
                                    {selectedMovie.release_date}
                                </p>
                                <button onClick={closeDetails}>close</button>
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
