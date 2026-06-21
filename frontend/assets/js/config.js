(function () {
  const host = window.location.hostname;
  const isLocal = ["localhost", "127.0.0.1", ""].includes(host);

  const productionApiRoot =
  "https://medical-backend-su2o.onrender.com";
  const localApiRoot = "http://127.0.0.1:8000";

  window.APP_CONFIG = {
    ...(window.APP_CONFIG || {}),
    API_ROOT: "https://medical-backend-su2o.onrender.com",
    AI_SKIN_APP_URL: isLocal ? "http://localhost:3000" : "",
    AI_DERMATOLOGY_APP_URL: isLocal ? "http://localhost:5173" : "",
  };

  window.API_ROOT = window.APP_CONFIG.API_ROOT.replace(/\/+$/, "");
})();
