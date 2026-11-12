/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  webpack: (config) => {
    // pdfjs-dist importa 'canvas' (so usado no Node). No navegador nao existe:
    // sem o alias o build falha quando o pacote opcional nao esta instalado (ex: CI).
    config.resolve.alias.canvas = false
    return config
  },
}

export default nextConfig
