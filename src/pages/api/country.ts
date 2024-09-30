// pages/api/country.ts
import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method === "GET") {
        try {
            const response = await fetch("https://api.country.is/");
            const data = await response.json();
            res.status(200).json({ country: data.country });
        } catch (error) {
            console.error("Error fetching country:", error);
            res.status(500).json({ error: "Failed to fetch country" });
        }
    } else {
        res.status(405).json({ error: "Method not allowed" });
    }
}
