import { NextResponse, type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  return !!url && url !== "your-supabase-url"
}

export async function middleware(request: NextRequest) {
  // Mock 모드: Supabase가 설정되지 않은 경우 미들웨어를 패스
  if (!isSupabaseConfigured()) {
    return NextResponse.next()
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * 정적 파일과 이미지를 제외한 모든 경로에서 미들웨어 실행
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
