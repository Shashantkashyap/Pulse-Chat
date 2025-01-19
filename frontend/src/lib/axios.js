import axios from "axios";

export const axiosInstance = axios.create({
 // baseURL: import.meta.env.MODE === "development" ? "http://localhost:5001/api" : "https://pulse-chat-2.onrender.com",
 baseURL: import.meta.env.MODE === "development" ? "https://pulse-chat-2.onrender.com" : "api",
  withCredentials: true,
});
