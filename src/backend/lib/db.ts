import mongoose from "mongoose";

let isConnected = false;

export async function connectDB(): Promise<boolean> {
  const uri = process.env["MONGODB_URI"] || "mongodb://localhost:27017/portpredict";
  
  if (isConnected) {
    return true;
  }

  try {
    mongoose.set("strictQuery", true);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 3000, // 3s timeout for quick fallback if local mongo is down
    });

    isConnected = true;
    console.log(`[MongoDB] Connected successfully to ${uri}`);

    mongoose.connection.on("error", (err) => {
      console.error("[MongoDB] Connection error:", err);
      isConnected = false;
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("[MongoDB] Disconnected from database");
      isConnected = false;
    });

    return true;
  } catch (error) {
    console.warn("[MongoDB] Failed to connect to MongoDB. Operating with fallback in-memory handling.");
    console.warn(`[MongoDB] Error detail: ${(error as Error).message}`);
    isConnected = false;
    return false;
  }
}

export function isDBConnected(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}
