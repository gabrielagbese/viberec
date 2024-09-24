import { useState, FormEvent } from "react";

export default function Home() {
    const [movies, setMovies] = useState<string[]>(["", ""]);
    const [movieDetails, setMovieDetails] = useState<any[]>([]); // Store movie details
    const [loading, setLoading] = useState(false);

    const addMovieField = () => {
        setMovies([...movies, ""]);
    };

    const handleMovieChange = (index: number, value: string) => {
        const updatedMovies = [...movies];
        updatedMovies[index] = value;
        setMovies(updatedMovies);
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        const validMovies = movies.filter((movie) => movie.trim() !== "");
        if (validMovies.length === 0) {
            alert("Please enter at least one movie title");
            return;
        }

        setLoading(true);
        setMovieDetails([]);

        // Generate the prompt for Anthropic API
        const moviePrompt = validMovies.join(", ");
        const prompt = `Give me the names of four films that are similar to ${moviePrompt}. Give the response as the movie titles and why they were recommended in JSON format. Give just the answer, so I only receive JSON.`;

        try {
            // Call the Anthropic API to get movie recommendations
            const res = await fetch("/api/anthropic", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ userInput: prompt }),
            });

            const data = await res.json();
            console.log("Anthropic API response:", data.completion); // Debugging

            let recommendedMovies = [];

            try {
                const parsedResponse = JSON.parse(data.completion);
                if (
                    parsedResponse &&
                    parsedResponse.recommendations &&
                    Array.isArray(parsedResponse.recommendations)
                ) {
                    // Capture both the title and the reason
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
                // Call the TMDB API route to get details for recommended movies
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

                // Combine TMDB data with the reasons
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

    return (
        <div>
            <h1>Movie Recommendation System</h1>
            <form onSubmit={handleSubmit}>
                {movies.map((movie, index) => (
                    <div key={index}>
                        <input
                            type="text"
                            value={movie}
                            onChange={(e) =>
                                handleMovieChange(index, e.target.value)
                            }
                            placeholder={`Enter movie ${index + 1}`}
                            required
                        />
                    </div>
                ))}

                <button type="button" onClick={addMovieField}>
                    Add another movie
                </button>

                <button type="submit">Submit</button>
            </form>

            {loading && <p>Loading movie recommendations...</p>}

            <div>
                {movieDetails.map((movie, index) => (
                    <div key={index} className="movie-card">
                        {/* Display TMDB movie data */}
                        <h3>{movie.title}</h3>
                        <p>
                            <strong>Release Date:</strong> {movie.release_date}
                        </p>
                        <p>{movie.overview}</p>
                        {movie.poster_path && (
                            <img
                                src={`https://image.tmdb.org/t/p/w200${movie.poster_path}`}
                                alt={`${movie.title} poster`}
                            />
                        )}

                        {/* Display the reason from Anthropic API */}
                        <p>
                            <strong>Reason for recommendation:</strong>{" "}
                            {movie.reason}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}
