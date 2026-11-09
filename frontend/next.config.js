
/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],

  async rewrites() {
    // Use the local backend only during development.
    if (process.env.NODE_ENV === "development") {
      return [
        {
          source: "/api/:path*",
          destination: "http://127.0.0.1:8000/api/:path*",
        },
      ];
    }

    // Production API requests will use the deployed backend URL.
    return [];
  },
};

module.exports = nextConfig;
