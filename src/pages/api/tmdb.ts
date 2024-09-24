// pages/api/tmdb.ts
import { NextApiRequest, NextApiResponse } from "next";

const TMDB_API_KEY = process.env.TMDB_API_KEY as string;

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
            // Query TMDB API for each movie title
            const moviePromises = titles.map(async (title: string) => {
                const response = await fetch(
                    `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(
                        title
                    )}`
                );
                const data = await response.json();

                if (data.results && data.results.length > 0) {
                    const movie = data.results[0]; // Assume the first result is the correct one
                    return {
                        title: movie.title,
                        release_date: movie.release_date,
                        overview: movie.overview,
                        poster_path: movie.poster_path,
                    };
                }
                return null; // If no results found
            });

            const movies = await Promise.all(moviePromises);
            res.status(200).json(movies.filter((movie) => movie !== null)); // Return movies excluding nulls
        } catch (error) {
            console.error("Error fetching from TMDB:", error);
            res.status(500).json({ error: "Failed to fetch movie details" });
        }
    } else {
        res.status(405).json({ error: "Method not allowed" });
    }
}
