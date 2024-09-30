import type { NextApiRequest, NextApiResponse } from "next";

const OMDB_API_KEY = process.env.OMDB_API_KEY; // Ensure this environment variable is set

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method === "POST") {
        const { imdbId } = req.body; // Ensure this is the correct key

        if (!imdbId) {
            return res.status(400).json({ error: "No IMDb ID provided" });
        }

        try {
            const response = await fetch(
                `http://www.omdbapi.com/?i=${imdbId}&apikey=${OMDB_API_KEY}`
            );
            const data = await response.json();

            if (data.Response === "True") {
                res.status(200).json(data);
            } else {
                res.status(404).json({ error: data.Error });
            }
        } catch (error) {
            console.error("Error fetching from OMDb:", error);
            res.status(500).json({ error: "Failed to fetch movie details" });
        }
    } else {
        res.status(405).json({ error: "Method not allowed" });
    }
}
