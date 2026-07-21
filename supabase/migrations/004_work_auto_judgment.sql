-- 신유형 판정 최초(자동) 값 보존 — 사람 수정과 구분해 라벨링 데이터로 활용
ALTER TABLE works
  ADD COLUMN IF NOT EXISTS resolved_type_auto TEXT,
  ADD COLUMN IF NOT EXISTS ai_type_auto BOOLEAN;
