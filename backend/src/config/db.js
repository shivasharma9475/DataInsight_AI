import mongoose from "mongoose";
import { config } from "./env.js";

export async function connectDB() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(config.mongoUri);
  console.log("[MongoDB] connected successfully");
}
