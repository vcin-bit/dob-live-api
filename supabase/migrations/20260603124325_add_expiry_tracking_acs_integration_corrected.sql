
-- Add comprehensive expiry tracking and ACS dashboard integration
-- All risk management documents need expiry dates for SIA ACS compliance

-- Add expiry tracking to existing risk assessments
ALTER TABLE risk_assessments 
ADD COLUMN IF NOT EXISTS next_review_due DATE,
ADD COLUMN IF NOT EXISTS review_status VARCHAR(20) DEFAULT 'current' CHECK (review_status IN ('current', 'due_soon', 'overdue', 'expired'));

-- Add expiry tracking to assignment instructions
ALTER TABLE assignment_instructions 
ADD COLUMN IF NOT EXISTS expiry_date DATE,
ADD COLUMN IF NOT EXISTS next_review_due DATE,
ADD COLUMN IF NOT EXISTS review_status VARCHAR(20) DEFAULT 'current' CHECK (review_status IN ('current', 'due_soon', 'overdue', 'expired'));

-- Add expiry tracking to training programs
ALTER TABLE site_training_programs 
ADD COLUMN IF NOT EXISTS expiry_date DATE,
ADD COLUMN IF NOT EXISTS next_review_due DATE,
ADD COLUMN IF NOT EXISTS review_status VARCHAR(20) DEFAULT 'current' CHECK (review_status IN ('current', 'due_soon', 'overdue', 'expired'));

-- Document renewal tracking table for ACS compliance
CREATE TABLE document_renewals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Document identification
    document_type VARCHAR(50) NOT NULL, -- 'risk_assessment', 'assignment_instruction', 'training_program', 'training_record'
    document_id UUID NOT NULL, -- References the specific document
    document_title VARCHAR(255) NOT NULL,
    site_id UUID REFERENCES sites(id),
    
    -- Renewal tracking
    current_version VARCHAR(20) DEFAULT '1.0',
    issue_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    next_review_date DATE,
    
    -- ACS compliance integration
    acs_requirement TEXT, -- Which ACS requirement this document supports
    compliance_evidence_type VARCHAR(100), -- Type of evidence this provides
    mandatory_for_acs BOOLEAN DEFAULT true,
    
    -- Renewal workflow
    renewal_status VARCHAR(20) DEFAULT 'current' CHECK (renewal_status IN ('current', 'due_soon', 'overdue', 'expired', 'renewed', 'superseded')),
    renewal_priority INTEGER DEFAULT 3, -- 1=critical, 2=high, 3=normal, 4=low
    renewal_owner_id UUID REFERENCES users(id), -- Who is responsible for renewal
    
    -- Notifications
    first_reminder_days INTEGER DEFAULT 30, -- Days before expiry to send first reminder
    second_reminder_days INTEGER DEFAULT 14, -- Days before expiry to send second reminder
    final_reminder_days INTEGER DEFAULT 7, -- Days before expiry to send final reminder
    
    -- Renewal history
    last_renewal_date DATE,
    renewal_frequency_months INTEGER, -- How often this document needs renewal
    
    -- Audit trail
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- ACS evidence tracking - links documents to specific ACS indicators
CREATE TABLE acs_evidence_documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    acs_indicator_id INTEGER NOT NULL REFERENCES acs_indicators(id),
    
    -- Document reference
    document_type VARCHAR(50) NOT NULL, -- 'risk_assessment', 'assignment_instruction', 'training_program', etc.
    document_id UUID NOT NULL, -- References the specific document
    document_title VARCHAR(255) NOT NULL,
    document_url TEXT, -- PDF URL for evidence
    
    -- Evidence classification
    evidence_type VARCHAR(100), -- 'primary_evidence', 'supporting_evidence', 'compliance_documentation'
    evidence_description TEXT, -- How this document supports the ACS indicator
    evidence_weight DECIMAL(3,2) DEFAULT 1.0, -- How much this contributes to compliance (0.0-1.0)
    
    -- Quality assessment
    evidence_quality VARCHAR(20) DEFAULT 'good' CHECK (evidence_quality IN ('excellent', 'good', 'adequate', 'poor')),
    completeness_score INTEGER CHECK (completeness_score BETWEEN 0 AND 100),
    
    -- Validity tracking
    valid_from DATE NOT NULL,
    valid_until DATE, -- When this evidence expires
    auto_expires BOOLEAN DEFAULT true, -- Does this expire with the source document?
    
    -- Review tracking
    last_reviewed_date DATE,
    reviewed_by UUID REFERENCES users(id),
    review_notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- Automated compliance status view for ACS dashboard (using correct column names)
CREATE OR REPLACE VIEW acs_compliance_status AS
SELECT 
    ai.id,
    ai.criterion_id,
    ai.indicator_code,
    ai.indicator_text,
    ai.evidence_requirements,
    
    -- Count of supporting documents
    COALESCE(doc_count.document_count, 0) as supporting_documents,
    COALESCE(doc_count.expired_documents, 0) as expired_documents,
    COALESCE(doc_count.expiring_soon, 0) as expiring_soon,
    
    -- Overall compliance score
    CASE 
        WHEN COALESCE(doc_count.document_count, 0) = 0 THEN 0
        WHEN COALESCE(doc_count.expired_documents, 0) > 0 THEN 25 -- Critical - has expired docs
        WHEN COALESCE(doc_count.expiring_soon, 0) > 0 THEN 75 -- Warning - expiring soon
        ELSE 100 -- Good - all documents current
    END as compliance_percentage,
    
    -- Status classification
    CASE 
        WHEN COALESCE(doc_count.document_count, 0) = 0 THEN 'no_evidence'
        WHEN COALESCE(doc_count.expired_documents, 0) > 0 THEN 'non_compliant'
        WHEN COALESCE(doc_count.expiring_soon, 0) > 0 THEN 'at_risk'
        ELSE 'compliant'
    END as compliance_status,
    
    -- Next action required
    CASE 
        WHEN COALESCE(doc_count.document_count, 0) = 0 THEN 'Create required documentation'
        WHEN COALESCE(doc_count.expired_documents, 0) > 0 THEN 'Renew expired documents'
        WHEN COALESCE(doc_count.expiring_soon, 0) > 0 THEN 'Schedule document renewals'
        ELSE 'Monitor for upcoming renewals'
    END as next_action

FROM acs_indicators ai
LEFT JOIN (
    SELECT 
        aed.acs_indicator_id,
        COUNT(*) as document_count,
        SUM(CASE WHEN aed.valid_until < CURRENT_DATE THEN 1 ELSE 0 END) as expired_documents,
        SUM(CASE WHEN aed.valid_until BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days' THEN 1 ELSE 0 END) as expiring_soon
    FROM acs_evidence_documents aed
    WHERE aed.valid_until IS NOT NULL
    GROUP BY aed.acs_indicator_id
) doc_count ON doc_count.acs_indicator_id = ai.id;

-- Function to automatically create renewal records for new documents
CREATE OR REPLACE FUNCTION create_renewal_record()
RETURNS TRIGGER AS $$
BEGIN
    -- Create renewal tracking record for new documents with expiry dates
    IF NEW.expiry_date IS NOT NULL THEN
        INSERT INTO document_renewals (
            company_id,
            document_type,
            document_id,
            document_title,
            site_id,
            issue_date,
            expiry_date,
            next_review_date,
            renewal_frequency_months,
            renewal_owner_id,
            created_by
        ) VALUES (
            NEW.company_id,
            TG_TABLE_NAME,
            NEW.id,
            COALESCE(NEW.title, NEW.program_name, 'Untitled Document'),
            NEW.site_id,
            COALESCE(NEW.assessment_date, NEW.effective_date, CURRENT_DATE),
            NEW.expiry_date,
            NEW.review_date,
            12, -- Default 12 month renewal cycle
            NEW.created_by,
            NEW.created_by
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update review status based on expiry dates
CREATE OR REPLACE FUNCTION update_review_status()
RETURNS TRIGGER AS $$
DECLARE
    days_left INTEGER;
BEGIN
    -- Calculate days until expiry
    IF NEW.expiry_date IS NOT NULL THEN
        days_left := NEW.expiry_date - CURRENT_DATE;
        
        -- Update review status based on days until expiry
        NEW.review_status := CASE
            WHEN days_left < 0 THEN 'expired'
            WHEN days_left <= 7 THEN 'overdue'
            WHEN days_left <= 30 THEN 'due_soon'
            ELSE 'current'
        END;
    ELSE
        NEW.review_status := 'current';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Indexes for performance
CREATE INDEX idx_document_renewals_expiry_date ON document_renewals(expiry_date);
CREATE INDEX idx_document_renewals_renewal_status ON document_renewals(renewal_status);
CREATE INDEX idx_document_renewals_company_id ON document_renewals(company_id);
CREATE INDEX idx_acs_evidence_documents_indicator_id ON acs_evidence_documents(acs_indicator_id);
CREATE INDEX idx_acs_evidence_documents_valid_until ON acs_evidence_documents(valid_until);

-- RLS Policies
ALTER TABLE document_renewals ENABLE ROW LEVEL SECURITY;
ALTER TABLE acs_evidence_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_renewals_company_access" ON document_renewals
    FOR ALL USING (company_id = current_user_company_id());

CREATE POLICY "acs_evidence_documents_company_access" ON acs_evidence_documents
    FOR ALL USING (
        EXISTS(SELECT 1 FROM acs_indicators ai 
               JOIN acs_criteria ac ON ac.id = ai.criterion_id
               WHERE ai.id = acs_evidence_documents.acs_indicator_id)
    );

-- Service role access
CREATE POLICY "service_role_document_renewals" ON document_renewals FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_acs_evidence_documents" ON acs_evidence_documents FOR ALL TO service_role USING (true);

