import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";

const mongoUri = process.env.MONGODB_URI as string;
const dbName = process.env.MONGO_DBNAME || "discord_bot";

const SALT_ROUNDS = 10;

const messageSchema = new Schema({
    userId: String,
    content: String,
    response: String,
    timestamp: Date,
    sessionId: String,
});

const sessionSchema = new Schema({
    userId: String,
    messages: [
        {
            role: String, // 'user' or 'assistant'
            content: String,
            timestamp: Date,
        },
    ],
    lastInteraction: Date,
});

export const MessageModel = mongoose.model("Message", messageSchema);
export const SessionModel = mongoose.model("Session", sessionSchema);

// Helper function to hash userId
async function hashUserId(userId: string): Promise<string> {
    try {
        return await bcrypt.hash(userId, SALT_ROUNDS);
    } catch (error) {
        console.error("Error hashing userId:", error);
        throw error;
    }
}

// Helper function to compare userId with hash
async function compareUserId(userId: string, hash: string): Promise<boolean> {
    try {
        return await bcrypt.compare(userId, hash);
    } catch (error) {
        console.error("Error comparing userId:", error);
        return false;
    }
}

// Logging function
export async function logMessage(
    message: any,
    response: string | null,
    sessionId: string,
) {
    try {
        if (message.author.bot || message.guild) return;

        const hashedUserId = await hashUserId(message.author.id);

        const messageLog = new MessageModel({
            userId: hashedUserId,
            content: message.content,
            response: response,
            timestamp: message.createdAt,
            sessionId: sessionId,
        });

        await messageLog.save();
        console.log("Message logged to MongoDB with Mongoose successfully.");
    } catch (error) {
        console.error("Error logging message to MongoDB with Mongoose:", error);
    }
}

// Modified session management functions
export async function getOrCreateSession(userId: string): Promise<any> {
    try {
        const hashedUserId = await hashUserId(userId);

        // Find all sessions
        const sessions = await SessionModel.find({});

        // Find the matching session by comparing hashed values
        let session = null;
        for (const s of sessions) {
            if (s.userId && (await compareUserId(userId, s.userId))) {
                if (
                    s.lastInteraction &&
                    s.lastInteraction >= new Date(Date.now() - 30 * 60 * 1000)
                ) {
                    session = s;
                    break;
                }
            }
        }

        if (!session) {
            session = new SessionModel({
                userId: hashedUserId,
                messages: [],
                lastInteraction: new Date(),
            });
        }

        return session;
    } catch (error) {
        console.error("Error managing session:", error);
        throw error;
    }
}

// Helper function to find user's message history
export async function findUserMessages(userId: string): Promise<any[]> {
    try {
        // Find all messages and filter by matching hashed values
        const messages = await MessageModel.find({});
        const userMessages = [];

        for (const message of messages) {
            if (
                message.userId &&
                (await compareUserId(userId, message.userId))
            ) {
                userMessages.push(message);
            }
        }

        return userMessages;
    } catch (error) {
        console.error("Error finding user messages:", error);
        return [];
    }
}

// Function to update user ID in existing records (if needed)
export async function updateExistingRecords() {
    try {
        const messages = await MessageModel.find({ userId: { $exists: true } });
        const sessions = await SessionModel.find({ userId: { $exists: true } });

        // Update messages
        for (const message of messages) {
            if (message.userId && !message.userId.startsWith("$2b$")) {
                // Check if not already hashed
                const hashedId = await hashUserId(message.userId);
                message.userId = hashedId;
                await message.save();
            }
        }

        // Update sessions
        for (const session of sessions) {
            if (session.userId && !session.userId.startsWith("$2b$")) {
                // Check if not already hashed
                const hashedId = await hashUserId(session.userId);
                session.userId = hashedId;
                await session.save();
            }
        }

        console.log("Existing records updated successfully");
    } catch (error) {
        console.error("Error updating existing records:", error);
    }
}

export async function updateSession(
    session: any,
    userMessage: string,
    aiResponse: string,
) {
    try {
        session.messages.push(
            {
                role: "user",
                content: userMessage,
                timestamp: new Date(),
            },
            {
                role: "assistant",
                content: aiResponse,
                timestamp: new Date(),
            },
        );

        // Keep only last 10 messages (5 exchanges)
        if (session.messages.length > 10) {
            session.messages = session.messages.slice(-10);
        }

        session.lastInteraction = new Date();
        await session.save();
    } catch (error) {
        console.error("Error updating session:", error);
        throw error;
    }
}

export async function connectToMongoDB() {
    try {
        await mongoose.connect(mongoUri, {
            dbName: dbName,
        });
        console.log("Connected to MongoDB with Mongoose!");
    } catch (error) {
        console.error("Error connecting to MongoDB with Mongoose:", error);
        process.exit(1);
    }
}
