import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "공공저작물 권리유형 자동분류 서비스",
  description:
    "계약서와 저작물을 업로드하면 OCR 처리를 거쳐 공공누리 유형을 자동 분류하고 메타데이터를 추출합니다.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
