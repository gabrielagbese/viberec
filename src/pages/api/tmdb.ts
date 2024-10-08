// pages/api/tmdb.ts
import { NextApiRequest, NextApiResponse } from "next";

const TMDB_API_KEY = process.env.TMDB_API_KEY as string;
const OMDB_API_KEY = process.env.OMDB_API_KEY as string;

// Define interfaces for the expected data structures
// Define the structure of a single watch provider
export interface WatchProvider {
    provider_id: number;
    provider_name: string;
    logo_path: string | null;
    display_priority: number; // Optional, if you want to use this information
}

// Define the structure of watch providers for a specific country
export interface CountryWatchProviders {
    link: string; // The link to watch the movie in the specific region
    buy?: WatchProvider[]; // Array of providers available for buying
    flatrate?: WatchProvider[]; // Array of providers available for flat-rate streaming
    rent?: WatchProvider[]; // Array of providers available for renting
}

// Update the WatchProvidersResponse to accommodate the new structure
export interface WatchProvidersResponse {
    [region: string]: CountryWatchProviders; // Keys are country codes, values are CountryWatchProviders
}

interface Video {
    id: string;
    iso_639_1: string; // Language code
    iso_3166_1: string; // Country code
    key: string; // YouTube video key (used to construct video URL)
    name: string; // Name of the video
    site: string; // Hosting site, e.g., "YouTube"
    size: number; // Video resolution (e.g., 720, 1080)
    type: string; // Type of video (e.g., "Trailer", "Teaser")
    official: boolean; // Whether it's an official video
    published_at: string; // Date of publication
}
export interface Still {
    aspect_ratio: number;
    file_path: string; // The path to the image
    height: number;
    width: number;
    iso_639_1: string | null; // Language code if applicable, otherwise null
    vote_average: number;
    vote_count: number;
}

export interface MovieDetails {
    title: string;
    release_date: string;
    overview: string;
    poster_path: string;
    imdb_id: string;
    omdb_data: {
        title: string;
        director: string;
        actors: string;
        rated: string;
        runtime: string;
        genre: string;
        metascore: string;
        imdbRating: string;
    };
    stills: Array<Still>; // Update with the actual type if known
    trailers: Array<Video>; // Update with the actual type if known
    watch_providers: WatchProvidersResponse | null; // Use the defined interface
    reason?: string;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method === "POST") {
        const { recommendations } = req.body;
        console.log("Received recommendations:", recommendations);

        if (
            !recommendations ||
            !Array.isArray(recommendations) ||
            recommendations.length === 0
        ) {
            return res
                .status(400)
                .json({ error: "No movie recommendations provided" });
        }

        try {
            const moviePromises: Promise<MovieDetails | null>[] =
                recommendations.map(
                    async (rec: {
                        title: string;
                        year: string;
                        language: string;
                        reason: string;
                    }) => {
                        const searchResponse = await fetch(
                            `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(
                                rec.title
                            )}&primary_release_year=${rec.year}&language=en-US`
                        );
                        const searchData = await searchResponse.json();

                        if (
                            searchData.results &&
                            searchData.results.length > 0
                        ) {
                            const movie = searchData.results[0];

                            // Fetch detailed information including IMDb ID
                            const detailsResponse = await fetch(
                                `https://api.themoviedb.org/3/movie/${movie.id}?api_key=${TMDB_API_KEY}`
                            );
                            const detailsData = await detailsResponse.json();

                            // Fetch watch providers
                            const providersResponse = await fetch(
                                `https://api.themoviedb.org/3/movie/${movie.id}/watch/providers?api_key=${TMDB_API_KEY}`
                            );
                            const providersData =
                                await providersResponse.json();

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

                            // Fetch stills and videos (trailers) for the movie
                            const [stillsResponse, videosResponse] =
                                await Promise.all([
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
                                (video: Video) =>
                                    video.site === "YouTube" &&
                                    video.type === "Trailer"
                            );

                            // Extract watch provider information
                            const watchProviders = providersData.results
                                ? providersData.results // This contains the watch provider information
                                : null;
                            //console.log("wp:", watchProviders);
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
                                watch_providers: watchProviders, // Include watch provider data
                            } as MovieDetails; // Cast to MovieDetails type
                        }
                        return null;
                    }
                );

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
