import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',            // génère client/out/ (HTML/JS/CSS statiques)
  trailingSlash: true,         // /page → /page/index.html, simple à servir par Nginx
  images: { unoptimized: true }, // next/image sans serveur d'optimisation
  reactStrictMode: true,
};

export default nextConfig;