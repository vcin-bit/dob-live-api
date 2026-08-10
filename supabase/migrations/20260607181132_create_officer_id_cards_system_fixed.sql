
-- Create ID Card management system for officers
-- Tracks card issuance, status, and replacement history

CREATE TYPE card_status AS ENUM ('active', 'lost', 'returned', 'revoked', 'expired');

-- Main ID cards table
CREATE TABLE officer_id_cards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Card identification
    card_number VARCHAR(20) NOT NULL UNIQUE, -- RSC-0001, RSC-0002, etc.
    status card_status DEFAULT 'active',
    
    -- Card lifecycle
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiry_date DATE NOT NULL, -- Usually matches SIA expiry or 1-2 years
    
    -- Photos and documents
    headshot_path TEXT, -- Path to officer headshot in hr-documents bucket
    
    -- Workflow tracking
    issued_by UUID REFERENCES users(id), -- Manager who issued the card
    revoked_by UUID REFERENCES users(id), -- Manager who revoked the card
    revoked_at TIMESTAMPTZ,
    revocation_reason TEXT,
    
    -- Replacement chain
    replacement_for UUID REFERENCES officer_id_cards(id), -- Previous card this replaces
    
    -- Notes and audit
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Card number allocation table (separate from employee numbers)
CREATE TABLE company_card_counters (
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    last_number INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (company_id)
);

-- Initialize card counters for existing companies
INSERT INTO company_card_counters (company_id, last_number) 
SELECT id, 0 FROM companies 
ON CONFLICT (company_id) DO NOTHING;

-- Function to allocate card numbers
CREATE OR REPLACE FUNCTION allocate_card_number(p_company_id UUID)
RETURNS TEXT AS $$
DECLARE
    next_num INTEGER;
    prefix TEXT;
    card_number TEXT;
BEGIN
    -- Get the company's card number prefix (employee prefix + 'C')
    SELECT COALESCE(employee_number_prefix, 'RS') || 'C' 
    INTO prefix 
    FROM companies 
    WHERE id = p_company_id;
    
    -- Atomically increment the card counter
    UPDATE company_card_counters 
    SET last_number = last_number + 1, updated_at = NOW()
    WHERE company_id = p_company_id
    RETURNING last_number INTO next_num;
    
    -- If no counter exists, create it
    IF next_num IS NULL THEN
        INSERT INTO company_card_counters (company_id, last_number)
        VALUES (p_company_id, 1);
        next_num := 1;
    END IF;
    
    -- Format the card number (RSC-0001, RSC-0002, etc.)
    card_number := prefix || '-' || LPAD(next_num::TEXT, 4, '0');
    
    RETURN card_number;
END;
$$ LANGUAGE plpgsql;

-- View for active cards with officer details
CREATE OR REPLACE VIEW active_id_cards AS
SELECT 
    c.id,
    c.card_number,
    c.status,
    c.issue_date,
    c.expiry_date,
    c.headshot_path,
    c.notes,
    
    -- Officer details
    u.first_name,
    u.last_name,
    u.employee_number,
    u.role,
    u.sia_licence_number,
    u.sia_licence_type,
    u.sia_expiry_date,
    
    -- Company details
    comp.name as company_name,
    comp.logo_url as company_logo,
    
    -- Issuer details
    issuer.first_name || ' ' || issuer.last_name as issued_by_name,
    
    -- Status indicators
    CASE 
        WHEN c.expiry_date < CURRENT_DATE THEN 'expired'
        WHEN c.expiry_date < CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
        ELSE 'current'
    END as expiry_status,
    
    c.expiry_date - CURRENT_DATE as days_until_expiry

FROM officer_id_cards c
JOIN users u ON u.id = c.user_id
JOIN companies comp ON comp.id = c.company_id
LEFT JOIN users issuer ON issuer.id = c.issued_by
WHERE c.status = 'active';

-- Indexes for performance
CREATE INDEX idx_officer_id_cards_user_id ON officer_id_cards(user_id);
CREATE INDEX idx_officer_id_cards_company_id ON officer_id_cards(company_id);
CREATE INDEX idx_officer_id_cards_status ON officer_id_cards(status);
CREATE INDEX idx_officer_id_cards_expiry_date ON officer_id_cards(expiry_date);
CREATE INDEX idx_officer_id_cards_card_number ON officer_id_cards(card_number);

-- RLS Policies
ALTER TABLE officer_id_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_card_counters ENABLE ROW LEVEL SECURITY;

-- Company-based access control
CREATE POLICY "officer_id_cards_company_access" ON officer_id_cards
    FOR ALL USING (company_id = current_user_company_id());

CREATE POLICY "company_card_counters_company_access" ON company_card_counters
    FOR ALL USING (company_id = current_user_company_id());

-- Service role access
CREATE POLICY "service_role_officer_id_cards" ON officer_id_cards FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_company_card_counters" ON company_card_counters FOR ALL TO service_role USING (true);

-- Update timestamp trigger
CREATE TRIGGER update_officer_id_cards_updated_at
    BEFORE UPDATE ON officer_id_cards
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to issue a new ID card
CREATE OR REPLACE FUNCTION issue_id_card(
    p_company_id UUID,
    p_user_id UUID,
    p_issued_by UUID,
    p_expiry_date DATE DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    card_id UUID;
    card_num TEXT;
    default_expiry DATE;
BEGIN
    -- Generate card number
    card_num := allocate_card_number(p_company_id);
    
    -- Default expiry: 2 years from issue or SIA expiry date (whichever is sooner)
    IF p_expiry_date IS NULL THEN
        SELECT LEAST(
            CURRENT_DATE + INTERVAL '2 years',
            COALESCE(u.sia_expiry_date, CURRENT_DATE + INTERVAL '2 years')
        )
        INTO default_expiry
        FROM users u 
        WHERE u.id = p_user_id;
    ELSE
        default_expiry := p_expiry_date;
    END IF;
    
    -- Create the card record
    INSERT INTO officer_id_cards (
        company_id,
        user_id,
        card_number,
        issue_date,
        expiry_date,
        issued_by,
        notes
    ) VALUES (
        p_company_id,
        p_user_id,
        card_num,
        CURRENT_DATE,
        default_expiry,
        p_issued_by,
        p_notes
    ) RETURNING id INTO card_id;
    
    RETURN card_id;
END;
$$ LANGUAGE plpgsql;

