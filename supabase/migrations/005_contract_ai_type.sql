-- 계약서(레코드) 단위 공공누리 유형(제0~4) + AI유형 판정 + 최초 자동판정 보존
-- gongnuri_type은 CHECK(KOGL-1~4)로 제0유형을 못 담으므로 별도 resolved_type 컬럼 사용
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS resolved_type TEXT,
  ADD COLUMN IF NOT EXISTS ai_type_applied BOOLEAN,
  ADD COLUMN IF NOT EXISTS resolved_type_auto TEXT,
  ADD COLUMN IF NOT EXISTS ai_type_auto BOOLEAN;
