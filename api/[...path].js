import app from "../index.js";

export default function handler(req, res) {
  req.url = req.url.replace(/^\/api/, "") || "/";
  return app(req, res);
}
