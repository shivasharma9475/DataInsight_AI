import axios from "axios";
import { config } from "../config/env.js";

const mlClient = axios.create({
  baseURL: config.mlServiceUrl,
  headers: { "x-internal-key": config.internalApiKey },
  timeout: 120000, // model training can take a while on larger datasets
});

export default mlClient;
