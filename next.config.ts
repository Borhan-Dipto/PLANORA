import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Cache Components / PPR buys a static shell for pages that have one — but every route in
  // PLANORA is behind auth and personalized, so there's no static shell to gain here, and the
  // Supabase auth client's internal Date.now() calls were crashing the build-time prerender
  // attempt on nearly every route (logged as "unstable value Date.now() while prerendering" on
  // /dashboard, /planner, /settings, /subjects, /revision, /progress, ...). Each failed attempt
  // cost real latency on top of giving no benefit, which is the main slowness culprit. Turned off.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
