import { useState, FormEvent } from "react";

export default function Home() {
    const [input, setInput] = useState<string>("");
    const [response, setResponse] = useState<string>("");

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        const res = await fetch("/api/anthropic", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ userInput: input }), // Send input as JSON
        });

        const data = await res.json();
        if (data.error) {
            console.error("Error:", data.error);
        } else {
            setResponse(data.completion); // Update state with response
        }
    };

    return (
        <div>
            <h1>Anthropic API Demo</h1>
            <form onSubmit={handleSubmit}>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Enter your text"
                    required
                />
                <button type="submit">Submit</button>
            </form>

            {response && (
                <div>
                    <h2>Response:</h2>
                    <p>{response}</p>
                </div>
            )}
        </div>
    );
}
