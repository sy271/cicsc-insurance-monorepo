import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // When multiple lockfiles exist (e.g. under the user profile), pin Turbopack to this app folder
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
