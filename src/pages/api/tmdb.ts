// pages/api/tmdb.ts
import { NextApiRequest, NextApiResponse } from "next";

const TMDB_API_KEY = process.env.TMDB_API_KEY as string;
const OMDB_API_KEY = process.env.OMDB_API_KEY as string;

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method === "POST") {
        const { titles } = req.body;

        if (!titles || !Array.isArray(titles) || titles.length === 0) {
            return res.status(400).json({ error: "No movie titles provided" });
        }

        try {
            const moviePromises = titles.map(async (title: string) => {
                const searchResponse = await fetch(
                    `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(
                        title
                    )}`
                );
                const searchData = await searchResponse.json();

                if (searchData.results && searchData.results.length > 0) {
                    const movie = searchData.results[0];

                    // Fetch detailed information including IMDb ID
                    const detailsResponse = await fetch(
                        `https://api.themoviedb.org/3/movie/${movie.id}?api_key=${TMDB_API_KEY}`
                    );
                    const detailsData = await detailsResponse.json();

                    // Fetch additional details from OMDb API using IMDb ID
                    const omdbResponse = await fetch(
                        `http://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${detailsData.imdb_id}`
                    );
                    const omdbData = await omdbResponse.json();

                    // Extract relevant OMDb details
                    const omdbDetails = {
                        title: omdbData.Title,
                        director: omdbData.Director,
                        actors: omdbData.Actors,
                        rated: omdbData.Rated,
                        runtime: omdbData.Runtime,
                        genre: omdbData.Genre,
                        metascore: omdbData.Metascore,
                        imdbRating: omdbData.imdbRating,
                    };

                    // Log all expected returned values
                    console.log({
                        title: movie.title,
                        release_date: movie.release_date,
                        overview: movie.overview,
                        poster_path: movie.poster_path,
                        imdb_id: detailsData.imdb_id, // IMDb ID
                        omdb_data: omdbDetails, // Log extracted OMDb data
                    });

                    // Fetch stills and videos (trailers) for the movie
                    const [stillsResponse, videosResponse] = await Promise.all([
                        fetch(
                            `https://api.themoviedb.org/3/movie/${movie.id}/images?api_key=${TMDB_API_KEY}`
                        ),
                        fetch(
                            `https://api.themoviedb.org/3/movie/${movie.id}/videos?api_key=${TMDB_API_KEY}`
                        ),
                    ]);

                    const [stillsData, videosData] = await Promise.all([
                        stillsResponse.json(),
                        videosResponse.json(),
                    ]);

                    const stills = stillsData.backdrops
                        ? stillsData.backdrops.slice(0, 10)
                        : [];
                    const trailers = videosData.results.filter(
                        (video) =>
                            video.site === "YouTube" && video.type === "Trailer"
                    );

                    // Return all relevant data
                    return {
                        title: movie.title,
                        release_date: movie.release_date,
                        overview: movie.overview,
                        poster_path: movie.poster_path,
                        imdb_id: detailsData.imdb_id, // Include IMDb ID
                        omdb_data: omdbDetails, // Include extracted OMDb data
                        stills: stills,
                        trailers: trailers,
                    };
                }
                return null;
            });

            const movies = await Promise.all(moviePromises);
            res.status(200).json(movies.filter((movie) => movie !== null));
        } catch (error) {
            console.error("Error fetching from TMDB or OMDb:", error);
            res.status(500).json({ error: "Failed to fetch movie details" });
        }
    } else {
        res.status(405).json({ error: "Method not allowed" });
    }
}
