
-- Add defensibility workflow tables to link risk assessments → assignment instructions → training → evidence

-- Assignment instructions generated from risk assessments
CREATE TABLE assignment_instructions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    risk_assessment_id UUID REFERENCES risk_assessments(id), -- Source risk assessment
    
    -- Instruction details
    title VARCHAR(255) NOT NULL,
    reference_number VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    
    -- Risk mitigation procedures
    procedures TEXT NOT NULL, -- Step-by-step procedures to mitigate identified risks
    emergency_procedures TEXT, -- Emergency response procedures
    reporting_requirements TEXT, -- What and how to report incidents
    
    -- Equipment and training requirements
    required_equipment TEXT, -- PPE, tools, technology required
    training_requirements TEXT, -- What training officers need
    competency_requirements TEXT, -- Skills/certifications required
    
    -- Compliance
    regulatory_references TEXT, -- HSE regulations, standards referenced
    review_frequency VARCHAR(50), -- How often to review (monthly, quarterly, etc.)
    
    -- Document control
    version VARCHAR(20) DEFAULT '1.0',
    status VARCHAR(20) DEFAULT 'draft', -- draft, approved, superseded
    effective_date DATE,
    review_date DATE,
    
    -- Approval workflow
    created_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_date DATE,
    
    -- Document storage
    pdf_url TEXT, -- Professional PDF of assignment instructions
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Site-specific training programs derived from assignment instructions
CREATE TABLE site_training_programs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    assignment_instruction_id UUID REFERENCES assignment_instructions(id),
    
    -- Training program details
    program_name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Training content
    learning_objectives TEXT[], -- Array of learning objectives
    training_materials TEXT, -- Training content, presentations, videos
    practical_exercises TEXT, -- Hands-on training requirements
    assessment_criteria TEXT, -- How competency is assessed
    
    -- Requirements
    duration_hours DECIMAL(4,2), -- Training duration
    renewal_period_months INTEGER, -- How often renewal is required
    prerequisite_training TEXT, -- Required prior training
    
    -- Compliance tracking
    mandatory BOOLEAN DEFAULT true,
    regulatory_requirement TEXT, -- Which regulations require this training
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual officer training records with signatures and evidence
CREATE TABLE officer_training_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    officer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    training_program_id UUID REFERENCES site_training_programs(id),
    assignment_instruction_id UUID REFERENCES assignment_instructions(id),
    
    -- Training delivery
    training_date DATE NOT NULL,
    trainer_id UUID REFERENCES users(id), -- Who delivered the training
    training_location VARCHAR(255),
    training_method VARCHAR(100), -- classroom, online, practical, etc.
    
    -- Assessment and competency
    assessment_score DECIMAL(5,2), -- Score if applicable
    assessment_result VARCHAR(20), -- pass, fail, competent, not_competent
    competency_verified BOOLEAN DEFAULT false,
    competency_verified_by UUID REFERENCES users(id),
    competency_date DATE,
    
    -- Legal evidence (CRITICAL for defensibility)
    officer_signature TEXT, -- Digital signature or confirmation
    officer_signed_date TIMESTAMPTZ,
    officer_declaration TEXT, -- "I understand and agree to follow these procedures"
    trainer_signature TEXT,
    trainer_signed_date TIMESTAMPTZ,
    
    -- Renewal tracking
    expiry_date DATE, -- When this training expires
    renewal_required BOOLEAN DEFAULT false,
    
    -- Evidence storage
    certificate_url TEXT, -- Training certificate PDF
    training_materials_url TEXT, -- Copy of materials provided
    assessment_evidence_url TEXT, -- Assessment results, practical evidence
    
    -- Audit trail
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link specific risks to specific training requirements (for audit trail)
CREATE TABLE risk_training_requirements (
    risk_id UUID REFERENCES risks(id) ON DELETE CASCADE,
    training_program_id UUID REFERENCES site_training_programs(id) ON DELETE CASCADE,
    assignment_instruction_id UUID REFERENCES assignment_instructions(id),
    
    -- Mitigation details
    mitigation_description TEXT, -- How this training mitigates this specific risk
    compliance_requirement TEXT, -- Legal/regulatory basis
    evidence_required TEXT, -- What evidence is needed to prove mitigation
    
    PRIMARY KEY (risk_id, training_program_id)
);

-- Incident investigation links back to risk assessments for defensibility
CREATE TABLE incident_risk_analysis (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Link to DOB Live occurrence logs
    occurrence_id UUID, -- Links to existing occurrence_logs if available
    
    -- Incident details
    incident_date DATE NOT NULL,
    site_id UUID NOT NULL REFERENCES sites(id),
    incident_type VARCHAR(100), -- safety, security, near miss, etc.
    description TEXT NOT NULL,
    
    -- Risk assessment review
    risk_assessment_id UUID REFERENCES risk_assessments(id),
    risk_id UUID REFERENCES risks(id), -- Specific risk that materialized
    
    -- Defensibility analysis
    controls_in_place TEXT, -- What controls existed at time of incident
    training_provided TEXT, -- What training had been given
    procedure_followed BOOLEAN, -- Were procedures followed?
    procedure_adequate BOOLEAN, -- Were procedures adequate?
    
    -- Actions and improvements
    immediate_actions TEXT,
    investigation_findings TEXT,
    risk_assessment_updates_required BOOLEAN DEFAULT false,
    training_updates_required BOOLEAN DEFAULT false,
    procedure_updates_required BOOLEAN DEFAULT false,
    
    -- Legal protection
    investigation_report_url TEXT, -- Formal investigation report
    legal_review_required BOOLEAN DEFAULT false,
    legal_review_date DATE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- Add indexes for performance and audit trails
CREATE INDEX idx_assignment_instructions_site_id ON assignment_instructions(site_id);
CREATE INDEX idx_assignment_instructions_risk_assessment_id ON assignment_instructions(risk_assessment_id);
CREATE INDEX idx_site_training_programs_site_id ON site_training_programs(site_id);
CREATE INDEX idx_officer_training_records_officer_id ON officer_training_records(officer_id);
CREATE INDEX idx_officer_training_records_site_id ON officer_training_records(site_id);
CREATE INDEX idx_officer_training_records_expiry_date ON officer_training_records(expiry_date);
CREATE INDEX idx_incident_risk_analysis_site_id ON incident_risk_analysis(site_id);
CREATE INDEX idx_incident_risk_analysis_incident_date ON incident_risk_analysis(incident_date);

-- RLS Policies for defensibility tables
ALTER TABLE assignment_instructions ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_training_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE officer_training_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_training_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_risk_analysis ENABLE ROW LEVEL SECURITY;

-- Company-based access control
CREATE POLICY "assignment_instructions_company_access" ON assignment_instructions
    FOR ALL USING (company_id = current_user_company_id());

CREATE POLICY "site_training_programs_company_access" ON site_training_programs
    FOR ALL USING (company_id = current_user_company_id());

CREATE POLICY "officer_training_records_company_access" ON officer_training_records
    FOR ALL USING (
        EXISTS(SELECT 1 FROM users u WHERE u.id = officer_training_records.officer_id AND u.company_id = current_user_company_id())
    );

CREATE POLICY "risk_training_requirements_company_access" ON risk_training_requirements
    FOR ALL USING (
        EXISTS(SELECT 1 FROM risks r 
               JOIN risk_assessments ra ON ra.id = r.risk_assessment_id 
               WHERE r.id = risk_training_requirements.risk_id AND ra.company_id = current_user_company_id())
    );

CREATE POLICY "incident_risk_analysis_company_access" ON incident_risk_analysis
    FOR ALL USING (
        EXISTS(SELECT 1 FROM sites s WHERE s.id = incident_risk_analysis.site_id AND s.company_id = current_user_company_id())
    );

-- Service role access
CREATE POLICY "service_role_assignment_instructions" ON assignment_instructions FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_site_training_programs" ON site_training_programs FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_officer_training_records" ON officer_training_records FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_risk_training_requirements" ON risk_training_requirements FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_incident_risk_analysis" ON incident_risk_analysis FOR ALL TO service_role USING (true);

-- Update triggers
CREATE TRIGGER update_assignment_instructions_updated_at
    BEFORE UPDATE ON assignment_instructions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_site_training_programs_updated_at
    BEFORE UPDATE ON site_training_programs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_officer_training_records_updated_at
    BEFORE UPDATE ON officer_training_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

