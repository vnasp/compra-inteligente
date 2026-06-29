import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.vteximg.com.br" },
      { protocol: "https", hostname: "*.vtexassets.com" },
      { protocol: "https", hostname: "assets-jumbo.ecomm.cencosud.com" },
    ],
  },
};

export default nextConfig;
