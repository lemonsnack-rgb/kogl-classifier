-- =============================================
-- 권리추정 기록 테이블 (독립 기능, 기존 스키마 무변경)
-- =============================================

-- updated_at 자동 갱신 함수 (001에 있으나, 없는 환경에서도 안전하도록 idempotent 재정의)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE rights_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_name TEXT,
  file_url TEXT,
  ocr_text TEXT,
  contract_metadata JSONB,
  summary JSONB,
  rights_results JSONB,
  evidence JSONB,
  model_info JSONB,
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN (
    'uploaded', 'ocr_processing', 'predicting', 'completed', 'failed'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rights_checks_user_id ON rights_checks(user_id);
CREATE INDEX idx_rights_checks_created_at ON rights_checks(created_at DESC);

ALTER TABLE rights_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rights_checks"
  ON rights_checks FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins can view all rights_checks"
  ON rights_checks FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Users can insert own rights_checks"
  ON rights_checks FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own rights_checks"
  ON rights_checks FOR UPDATE USING (user_id = auth.uid());

CREATE TRIGGER rights_checks_updated_at
  BEFORE UPDATE ON rights_checks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
