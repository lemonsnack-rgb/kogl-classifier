/** @type {import('next').NextConfig} */
const nextConfig = {
  // STATIC_EXPORT=true 일 때만 정적 HTML 내보내기
  ...(process.env.STATIC_EXPORT === 'true' ? { output: 'export' } : {}),
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
}

module.exports = nextConfig
