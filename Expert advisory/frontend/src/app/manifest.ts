import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Expert Stocks Consultancy",
    short_name: "Expert Stocks",
    description: "Client portal and staff workspace",
    start_url: "/login",
    display: "standalone",
    background_color: "#f6f8fb",
    theme_color: "#1f56d6",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
