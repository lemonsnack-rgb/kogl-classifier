-- =============================================
-- 공공저작물 권리유형 자동분류 서비스 - DB 스키마
-- =============================================

-- 1. profiles (Supabase Auth 확장)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  organization TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auth 사용자 생성 시 자동으로 profile 생성
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. contracts (계약서 = 처리 단위)
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contract_file_url TEXT,
  contract_filename TEXT,
  is_institution_made BOOLEAN NOT NULL DEFAULT false,
  gongnuri_type TEXT CHECK (gongnuri_type IN ('KOGL-1', 'KOGL-2', 'KOGL-3', 'KOGL-4')),
  gongnuri_confidence REAL,
  gongnuri_top_k JSONB,
  classification_basis TEXT CHECK (classification_basis IN ('CONTRACT', 'AI', 'MANUAL')),
  policy_constraints JSONB,
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN (
    'uploaded', 'ocr_processing', 'classifying', 'review_required', 'completed', 'failed'
  )),
  exception_type TEXT CHECK (exception_type IN (
    'NO_CONTRACT', 'LOW_OCR_QUALITY', 'NO_CLAUSE_MATCH', 'FORMAT_UNSUPPORTED', 'LEGACY_VENDOR'
  )),
  is_edited BOOLEAN NOT NULL DEFAULT false,
  edited_by UUID REFERENCES profiles(id),
  edited_at TIMESTAMPTZ,
  edit_reason TEXT,
  ocr_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. contract_clauses (계약서 조항 = 판단 근거)
CREATE TABLE contract_clauses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  clause_type TEXT NOT NULL CHECK (clause_type IN (
    'OWNERSHIP', 'LICENSE', 'DERIVATIVE', 'SCOPE', 'TERM', 'ATTRIBUTION'
  )),
  clause_text TEXT NOT NULL,
  match_score REAL,
  page_number INTEGER,
  char_start INTEGER,
  char_end INTEGER,
  template_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. works (저작물)
CREATE TABLE works (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  work_file_url TEXT,
  work_filename TEXT NOT NULL,
  ocr_text TEXT,
  ocr_status TEXT NOT NULL DEFAULT 'pending' CHECK (ocr_status IN ('pending', 'completed', 'failed')),
  -- 저작물 정보 메타데이터
  work_name TEXT,
  work_type TEXT CHECK (work_type IN ('image', 'text', 'audio', 'video')),
  digital_format TEXT,
  description TEXT,
  keywords TEXT[],
  language TEXT DEFAULT 'ko',
  created_date DATE,
  creator TEXT,
  -- 권리정보 메타데이터
  copyright_period TEXT,
  usage_scope TEXT,
  usage_territory TEXT,
  -- 계약서 추출 NER 메타데이터
  contract_metadata JSONB,
  is_metadata_edited BOOLEAN NOT NULL DEFAULT false,
  metadata_edited_by UUID REFERENCES profiles(id),
  metadata_edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. invitations (이메일 초대)
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES profiles(id),
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. edit_history (수정 이력)
CREATE TABLE edit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL CHECK (target_type IN ('contract', 'work')),
  target_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  edited_by UUID NOT NULL REFERENCES profiles(id),
  edited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT
);

-- =============================================
-- 인덱스
-- =============================================
CREATE INDEX idx_contracts_user_id ON contracts(user_id);
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_contracts_created_at ON contracts(created_at DESC);
CREATE INDEX idx_works_contract_id ON works(contract_id);
CREATE INDEX idx_clauses_contract_id ON contract_clauses(contract_id);
CREATE INDEX idx_edit_history_target ON edit_history(target_type, target_id);

-- =============================================
-- RLS (Row Level Security) 정책
-- =============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_clauses ENABLE ROW LEVEL SECURITY;
ALTER TABLE works ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE edit_history ENABLE ROW LEVEL SECURITY;

-- profiles: 자기 프로필 읽기/수정, 관리자는 전체
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- contracts: 본인 것 CRUD, 관리자는 전체
CREATE POLICY "Users can view own contracts"
  ON contracts FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins can view all contracts"
  ON contracts FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Users can insert own contracts"
  ON contracts FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own contracts"
  ON contracts FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Admins can update any contract"
  ON contracts FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- works: 계약서 소유자 접근
CREATE POLICY "Users can view works of own contracts"
  ON works FOR SELECT USING (
    EXISTS (SELECT 1 FROM contracts WHERE contracts.id = works.contract_id AND contracts.user_id = auth.uid())
  );
CREATE POLICY "Admins can view all works"
  ON works FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Users can insert works to own contracts"
  ON works FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM contracts WHERE contracts.id = works.contract_id AND contracts.user_id = auth.uid())
  );
CREATE POLICY "Users can update works of own contracts"
  ON works FOR UPDATE USING (
    EXISTS (SELECT 1 FROM contracts WHERE contracts.id = works.contract_id AND contracts.user_id = auth.uid())
  );

-- contract_clauses: 계약서 소유자 읽기
CREATE POLICY "Users can view clauses of own contracts"
  ON contract_clauses FOR SELECT USING (
    EXISTS (SELECT 1 FROM contracts WHERE contracts.id = contract_clauses.contract_id AND contracts.user_id = auth.uid())
  );
CREATE POLICY "Admins can view all clauses"
  ON contract_clauses FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- invitations: 관리자만 관리
CREATE POLICY "Admins can select invitations"
  ON invitations FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Admins can insert invitations"
  ON invitations FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Admins can update invitations"
  ON invitations FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Admins can delete invitations"
  ON invitations FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- edit_history: 본인 것 + 관리자
CREATE POLICY "Users can view own edit history"
  ON edit_history FOR SELECT USING (edited_by = auth.uid());
CREATE POLICY "Admins can view all edit history"
  ON edit_history FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Authenticated users can insert edit history"
  ON edit_history FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================
-- Storage 버킷
-- =============================================
-- Supabase Dashboard에서 생성:
-- 1. contracts 버킷 (계약서/동의서 PDF)
-- 2. works 버킷 (저작물 파일)

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contracts_updated_at
  BEFORE UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER works_updated_at
  BEFORE UPDATE ON works FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
