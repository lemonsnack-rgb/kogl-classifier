-- 공공누리 신유형(제0유형·AI유형) 저작물별 판정 결과
ALTER TABLE works
  ADD COLUMN IF NOT EXISTS resolved_type TEXT,
  ADD COLUMN IF NOT EXISTS ai_type_applied BOOLEAN,
  ADD COLUMN IF NOT EXISTS type_reason TEXT,
  ADD COLUMN IF NOT EXISTS type_low_confidence BOOLEAN;
