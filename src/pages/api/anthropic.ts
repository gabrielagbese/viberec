// pages/api/anthropic.ts
import { NextApiRequest, NextApiResponse } from "next";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY as string, // Load the API key from env
});

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method === "POST") {
        const { userInput } = req.body;

        if (!userInput || typeof userInput !== "string") {
            return res.status(400).json({ error: "Invalid input" });
        }

        try {
            // Call the Anthropic API using the `messages.create` method
            const response = await anthropic.messages.create({
                model: "claude-3-5-sonnet-20240620", // Set the model name from your docs
                max_tokens: 1024, // Adjust token limit as needed
                messages: [
                    { role: "user", content: userInput }, // Send user input in the message
                ],
            });

            // Check the structure of the response content
            let completionText = "No response content";

            if (response.content && response.content.length > 0) {
                // Loop through the content blocks to find the text
                for (const block of response.content) {
                    if (block.type === "text" && block.text) {
                        completionText = block.text;
                        break; // Stop after finding the first text block
                    }
                }
            }

            // Parse the JSON string if needed
            const recommendations = JSON.parse(completionText).recommendations;

            // Return the recommendations as JSON
            res.status(200).json({ recommendations });
        } catch (error) {
            console.error("Error with Anthropic API:", error);
            res.status(500).json({
                error: "Failed to fetch from Anthropic API",
            });
        }
    } else {
        res.status(405).json({ error: "Method Not Allowed" });
    }
}
