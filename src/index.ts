import { Client, GatewayIntentBits, Partials, Message } from "discord.js";
import { generateAIResponse } from "./ai";
import http from "http";
import {
    connectToMongoDB,
    getOrCreateSession,
    updateSession,
    logMessage,
} from "./database";

// Connect to MongoDB
connectToMongoDB();

const client = new Client({
    intents: [
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.Guilds,
    ],
    partials: [Partials.Channel],
});

client.on("ready", () => {
    console.log(`Logged in as ${client.user?.tag}!`);
});

// Message handler
client.on("messageCreate", async (message) => {
    if (message.author.bot || message.guild) return;

    try {
        await message.channel.sendTyping();

        // Get or create a session for this user
        const session = await getOrCreateSession(message.author.id);

        // Prepare conversation history for AI
        const conversationHistory = session.messages.map((msg: any) => ({
            role: msg.role,
            content: msg.content,
        }));

        // Generate AI response with context
        const response = await generateAIResponse(
            message.content,
            conversationHistory,
        );

        // Update session with new messages
        await updateSession(session, message.content, response);
        await logMessage(message, response, session._id);

        const chunks = chunkMessage(response);
        for (const chunk of chunks) {
            await message.channel.send(chunk);
        }
    } catch (error) {
        console.error("Error handling message:", error);
        await message.reply(
            "Oops! Something went wrong. Please try again later.",
        );
        await logMessage(message, null, "error");
    }
});

function chunkMessage(text: string, maxLength = 2000): string[] {
    const chunks = [];
    for (let i = 0; i < text.length; i += maxLength) {
        chunks.push(text.slice(i, i + maxLength));
    }
    return chunks;
}

// Start HTTP server
const port = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
    res.statusCode = 200;
    res.end();
});

server.listen(port, () => {
    console.log(`HTTP server listening on port ${port}`);
});

client.login(process.env.DISCORD_TOKEN);
