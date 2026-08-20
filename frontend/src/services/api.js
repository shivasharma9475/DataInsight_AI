import axios from "axios";

const API_BASE =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("dia_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("dia_token");
      localStorage.removeItem("dia_user");
      window.location.href = "/login";
    }

    return Promise.reject(err);
  }
);

export const authApi = {
  signup: (data) =>
    api.post("/api/auth/signup", data),

  login: (data) =>
    api.post("/api/auth/login", data),

  google: (id_token) =>
    api.post("/api/auth/google", { id_token }),

  forgotPassword: (email) =>
    api.post("/api/auth/forgot-password", { email }),

  resetPassword: (token, newPassword) =>
    api.post("/api/auth/reset-password", {
      token,
      new_password: newPassword,
    }),
    
  me: () =>
    api.get("/api/auth/me"),
};

export const datasetApi = {
  upload: (file, onProgress) => {
    const form = new FormData();
    form.append("file", file);

    return api.post("/api/datasets/upload", form, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: onProgress,
    });
  },
  search: (query) =>
    api.get(`/api/datasets/search?q=${encodeURIComponent(query)}`),

  history: () =>
    api.get("/api/datasets/history"),

  notifications: () =>
  api.get("/api/datasets/notifications"),

  profile: (id) =>
    api.get(`/api/datasets/${id}/profile`),

  cleaningSuggestions: (id) =>
    api.get(`/api/datasets/${id}/cleaning-suggestions`),

  clean: (payload) =>
    api.post("/api/datasets/clean", payload),

  delete: (id) =>
    api.delete(`/api/datasets/${id}`),

  eda: (id) =>
    api.get(`/api/datasets/${id}/eda`),

  outliers: (id) =>
    api.get(`/api/datasets/${id}/outliers`),

  charts: (id) =>
    api.get(`/api/datasets/${id}/charts`),

  preview: (id, limit = 50) =>
    api.get(`/api/datasets/${id}/preview?limit=${limit}`),
};

export const mlApi = {
  recommend: (id) =>
    api.get(`/api/ml/${id}/recommend`),

  run: (payload) =>
    api.post("/api/ml/run", payload),
};

export const aiApi = {
  insights: (id) =>
    api.get(`/api/ai/${id}/insights`),

  recommendations: (payload) =>
    api.post(
      "/api/ai/recommendations",
      payload
    ),
};

// Root Cause Analysis
export const rcaApi = {
  analyze: (payload) => api.post("/api/ai/root-cause", payload),
};

export const chatApi = {
  ask: (payload) =>
    api.post("/api/chat/ask", payload),

  history: (id) =>
    api.get(`/api/chat/${id}/history`),
};

async function downloadBlob(path, filename) {
  const res = await api.get(path, {
    responseType: "blob",
  });

  const url = window.URL.createObjectURL(
    new Blob([res.data])
  );

  const link = document.createElement("a");

  link.href = url;
  link.setAttribute("download", filename);

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.URL.revokeObjectURL(url);
}

export const reportApi = {
  downloadExcel: (id, filename = "report.xlsx") =>
    downloadBlob(
      `/api/reports/${id}/excel`,
      filename
    ),

  downloadPdf: (id, filename = "report.pdf") =>
    downloadBlob(
      `/api/reports/${id}/pdf`,
      filename
    ),
};

export const copilotApi = {
  query: (payload) =>
    api.post(
      "/api/ai/copilot",
      payload
    ),
};

export const whatIfApi = {
  simulate: (payload) =>
    api.post("/api/what-if", payload),
};

export const connectorApi = {
  test: (payload) =>
    api.post("/api/connectors/test", payload),

  import: (payload) =>
    api.post("/api/connectors/import", payload),
};

export default api;