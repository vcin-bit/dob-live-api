
-- Risk Assessment System for DOB Live
-- Supports both HSE and Security risk assessments with ACS compliance integration

CREATE TYPE risk_assessment_type AS ENUM ('hse', 'security', 'combined');
CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high', 'very_high');
CREATE TYPE assessment_status AS ENUM ('draft', 'under_review', 'approved', 'expired', 'superseded');

-- Main risk assessments table
CREATE TABLE risk_assessments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    
    -- Assessment metadata
    assessment_type risk_assessment_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    reference_number VARCHAR(50) UNIQUE NOT NULL,
    
    -- Assessment details
    description TEXT,
    scope TEXT NOT NULL, -- What areas/activities this covers
    methodology TEXT, -- How the assessment was conducted
    
    -- Risk ratings
    overall_risk_level risk_level,
    residual_risk_level risk_level, -- After controls applied
    
    -- Workflow
    status assessment_status DEFAULT 'draft',
    assessor_id UUID REFERENCES users(id), -- Who conducted the assessment
    approver_id UUID REFERENCES users(id), -- Who approved it
    
    -- Dates
    assessment_date DATE NOT NULL,
    approved_date DATE,
    review_date DATE NOT NULL, -- When it needs reviewing
    expiry_date DATE,
    
    -- Document storage
    pdf_url TEXT, -- Generated professional PDF
    
    -- ACS compliance
    acs_criterion_id INTEGER REFERENCES acs_criteria(id), -- Links to ACS requirements
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

-- Risk categories (HSE: workplace hazards, Security: threat types)
CREATE TABLE risk_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    name VARCHAR(100) NOT NULL,
    description TEXT,
    assessment_type risk_assessment_type NOT NULL,
    sort_order INTEGER DEFAULT 0,
    
    -- Standard categories (fire, theft, violence, manual handling, etc.)
    is_standard BOOLEAN DEFAULT false, -- System-provided vs custom
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual risks identified in assessments
CREATE TABLE risks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    risk_assessment_id UUID NOT NULL REFERENCES risk_assessments(id) ON DELETE CASCADE,
    risk_category_id UUID REFERENCES risk_categories(id),
    
    -- Risk details
    hazard_description TEXT NOT NULL, -- What could cause harm
    who_at_risk TEXT NOT NULL, -- Who could be harmed
    potential_consequences TEXT NOT NULL, -- What harm could occur
    existing_controls TEXT, -- Current control measures
    
    -- Risk scoring
    likelihood_score INTEGER CHECK (likelihood_score BETWEEN 1 AND 5),
    severity_score INTEGER CHECK (severity_score BETWEEN 1 AND 5),
    risk_score INTEGER GENERATED ALWAYS AS (likelihood_score * severity_score) STORED,
    risk_level risk_level,
    
    -- Additional controls needed
    additional_controls TEXT,
    
    -- Post-control scoring
    residual_likelihood INTEGER CHECK (residual_likelihood BETWEEN 1 AND 5),
    residual_severity INTEGER CHECK (residual_severity BETWEEN 1 AND 5),
    residual_score INTEGER GENERATED ALWAYS AS (residual_likelihood * residual_severity) STORED,
    residual_level risk_level,
    
    -- Action tracking
    action_required BOOLEAN DEFAULT false,
    action_description TEXT,
    action_owner_id UUID REFERENCES users(id),
    target_completion_date DATE,
    completion_date DATE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Standard control measures library
CREATE TABLE control_measures (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(100), -- PPE, Training, Procedures, Physical, etc.
    assessment_type risk_assessment_type NOT NULL,
    
    -- Cost/effort indicators
    implementation_cost VARCHAR(20), -- low/medium/high
    maintenance_effort VARCHAR(20), -- low/medium/high
    
    is_standard BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Many-to-many: risks can have multiple control measures
CREATE TABLE risk_control_measures (
    risk_id UUID REFERENCES risks(id) ON DELETE CASCADE,
    control_measure_id UUID REFERENCES control_measures(id) ON DELETE CASCADE,
    is_existing BOOLEAN DEFAULT true, -- Existing vs recommended control
    effectiveness_rating INTEGER CHECK (effectiveness_rating BETWEEN 1 AND 5),
    implementation_date DATE,
    notes TEXT,
    
    PRIMARY KEY (risk_id, control_measure_id)
);

-- Risk assessment templates for common site types
CREATE TABLE risk_assessment_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    name VARCHAR(200) NOT NULL,
    description TEXT,
    assessment_type risk_assessment_type NOT NULL,
    site_type VARCHAR(100), -- office, warehouse, construction, retail, etc.
    
    -- Template data (JSON structure for risks and controls)
    template_data JSONB,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX idx_risk_assessments_site_id ON risk_assessments(site_id);
CREATE INDEX idx_risk_assessments_company_id ON risk_assessments(company_id);
CREATE INDEX idx_risk_assessments_status ON risk_assessments(status);
CREATE INDEX idx_risk_assessments_review_date ON risk_assessments(review_date);
CREATE INDEX idx_risks_assessment_id ON risks(risk_assessment_id);
CREATE INDEX idx_risks_risk_level ON risks(risk_level);

-- RLS Policies
ALTER TABLE risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE control_measures ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_control_measures ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_assessment_templates ENABLE ROW LEVEL SECURITY;

-- Company-based access control using the correct function
CREATE POLICY "risk_assessments_company_access" ON risk_assessments
    FOR ALL USING (company_id = current_user_company_id());

CREATE POLICY "risk_categories_company_access" ON risk_categories
    FOR ALL USING (company_id = current_user_company_id());

CREATE POLICY "risks_company_access" ON risks
    FOR ALL USING (
        EXISTS(SELECT 1 FROM risk_assessments ra WHERE ra.id = risks.risk_assessment_id AND ra.company_id = current_user_company_id())
    );

CREATE POLICY "control_measures_company_access" ON control_measures
    FOR ALL USING (company_id = current_user_company_id());

CREATE POLICY "risk_control_measures_company_access" ON risk_control_measures
    FOR ALL USING (
        EXISTS(SELECT 1 FROM risks r 
               JOIN risk_assessments ra ON ra.id = r.risk_assessment_id 
               WHERE r.id = risk_control_measures.risk_id AND ra.company_id = current_user_company_id())
    );

CREATE POLICY "risk_assessment_templates_company_access" ON risk_assessment_templates
    FOR ALL USING (company_id = current_user_company_id());

-- Service role access
CREATE POLICY "service_role_risk_assessments" ON risk_assessments FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_risk_categories" ON risk_categories FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_risks" ON risks FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_control_measures" ON control_measures FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_risk_control_measures" ON risk_control_measures FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_risk_assessment_templates" ON risk_assessment_templates FOR ALL TO service_role USING (true);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_risk_assessments_updated_at
    BEFORE UPDATE ON risk_assessments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_risks_updated_at
    BEFORE UPDATE ON risks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

