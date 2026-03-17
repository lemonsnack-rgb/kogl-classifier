const { execSync } = require("child_process")
const fs = require("fs")
const path = require("path")

const authRoute = path.join(__dirname, "..", "src", "app", "auth", "callback", "route.ts")
const middlewareFile = path.join(__dirname, "..", "src", "middleware.ts")

let authContent = ""
let middlewareContent = ""

console.log("📦 정적 HTML 내보내기 시작...")

// 1. 서버 전용 파일 내용 백업 후 제거
if (fs.existsSync(authRoute)) {
  authContent = fs.readFileSync(authRoute, "utf-8")
  fs.unlinkSync(authRoute)
  console.log("  - auth callback route 임시 제거")
}
if (fs.existsSync(middlewareFile)) {
  middlewareContent = fs.readFileSync(middlewareFile, "utf-8")
  fs.unlinkSync(middlewareFile)
  console.log("  - middleware 임시 제거")
}

try {
  // 2. 정적 빌드
  execSync("npx next build", {
    stdio: "inherit",
    env: { ...process.env, STATIC_EXPORT: "true" },
    cwd: path.join(__dirname, ".."),
  })
  console.log("\n✅ 정적 HTML이 out/ 폴더에 생성되었습니다.")
} catch (e) {
  console.error("\n❌ 빌드 실패")
} finally {
  // 3. 원복
  if (authContent) {
    fs.mkdirSync(path.dirname(authRoute), { recursive: true })
    fs.writeFileSync(authRoute, authContent, "utf-8")
  }
  if (middlewareContent) {
    fs.writeFileSync(middlewareFile, middlewareContent, "utf-8")
  }
  console.log("  - 서버 파일 원복 완료")
}
