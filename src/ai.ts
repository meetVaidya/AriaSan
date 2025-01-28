import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { botPrompt } from "./prompt";

const apiKey = process.env.OPENAI_API_KEY;

// Initialize OpenAI client
const openai = new OpenAI({
    baseURL: "https://api.groq.com/openai/v1",
    apiKey: apiKey,
});

// System message to set the AI's personality and behavior
const systemMessage: ChatCompletionMessageParam = {
    role: "system",
    content: botPrompt,
};

interface ConversationMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

export async function generateAIResponse(
    message: string,
    conversationHistory: ConversationMessage[] = [],
): Promise<string> {
    try {
        // Prepare messages array with system message, history, and current message
        const messages: ChatCompletionMessageParam[] = [
            systemMessage,
            ...conversationHistory,
            { role: "user", content: message },
        ];

        // Generate response from OpenAI
        const completion = await openai.chat.completions.create({
            model: "llama-3.3-70b-versatile", // or "gpt-4" if you have access
            messages: messages,
            max_tokens: 500, // Adjust based on your needs
            temperature: 0.7, // Adjust for creativity vs consistency
            top_p: 1,
            frequency_penalty: 0.2,
            presence_penalty: 0.2,
        });

        // Extract and return the response
        const response = completion.choices[0]?.message?.content;
        if (!response) {
            throw new Error("No response generated");
        }

        return response;
    } catch (error) {
        // Handle specific API errors
        if (error instanceof OpenAI.APIError) {
            console.error("OpenAI API Error:", {
                status: error.status,
                message: error.message,
                code: error.code,
            });

            // Handle rate limiting
            if (error.status === 429) {
                return "I'm a bit overwhelmed right now. Please try again in a moment! 😅";
            }

            // Handle token limit exceeded
            if (error.code === "context_length_exceeded") {
                return "I'm sorry, but this conversation has become too long for me to process. Let's start a fresh topic! 🔄";
            }
        }

        // Log other errors
        console.error("Error generating AI response:", error);

        // Return a user-friendly error message
        return "I apologize, but I'm having trouble processing that request. Could you try again or rephrase your message? 🙏";
    }
}
