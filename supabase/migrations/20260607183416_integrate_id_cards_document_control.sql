
-- Integrate ID cards into existing document control and ACS compliance systems

-- Function to automatically create renewal records for ID cards
CREATE OR REPLACE FUNCTION create_id_card_renewal_record()
RETURNS TRIGGER AS $$
BEGIN
    -- Create renewal tracking record for new ID cards
    INSERT INTO document_renewals (
        company_id,
        document_type,
        document_id,
        document_title,
        site_id,
        issue_date,
        expiry_date,
        acs_requirement,
        compliance_evidence_type,
        mandatory_for_acs,
        renewal_priority,
        renewal_owner_id,
        renewal_frequency_months,
        created_by
    ) VALUES (
        NEW.company_id,
        'id_card',
        NEW.id,
        'ID Card: ' || (SELECT first_name || ' ' || last_name FROM users WHERE id = NEW.user_id) || ' (' || NEW.card_number || ')',
        NULL, -- ID cards are company-wide, not site-specific
        NEW.issue_date,
        NEW.expiry_date,
        'Officer identification and access control - ACS Personnel Management',
        'identity_verification',
        true,
        2, -- High priority (1=critical, 2=high, 3=normal)
        NEW.issued_by,
        24, -- 24 month renewal cycle (2 years)
        NEW.issued_by
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update renewal records when ID cards change
CREATE OR REPLACE FUNCTION update_id_card_renewal_record()
RETURNS TRIGGER AS $$
BEGIN
    -- Update renewal tracking when card status changes
    IF OLD.status != NEW.status OR OLD.expiry_date != NEW.expiry_date THEN
        UPDATE document_renewals 
        SET 
            expiry_date = NEW.expiry_date,
            renewal_status = CASE 
                WHEN NEW.status = 'active' THEN 'current'
                WHEN NEW.status IN ('lost', 'revoked', 'expired') THEN 'superseded'
                WHEN NEW.status = 'returned' THEN 'superseded'
                ELSE 'current'
            END,
            updated_at = NOW()
        WHERE document_type = 'id_card' AND document_id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic document control integration
CREATE TRIGGER id_card_renewal_trigger
    AFTER INSERT ON officer_id_cards
    FOR EACH ROW
    EXECUTE FUNCTION create_id_card_renewal_record();

CREATE TRIGGER id_card_renewal_update_trigger
    AFTER UPDATE ON officer_id_cards
    FOR EACH ROW
    EXECUTE FUNCTION update_id_card_renewal_record();

-- Add ID cards to ACS evidence system for Personnel Management indicators
INSERT INTO acs_evidence_documents (
    acs_indicator_id,
    document_type,
    document_id,
    document_title,
    evidence_type,
    evidence_description,
    evidence_weight,
    evidence_quality,
    completeness_score,
    valid_from,
    valid_until,
    created_by
)
SELECT 
    -- Find ACS indicators related to personnel management and identification
    (SELECT id FROM acs_indicators WHERE indicator_text ILIKE '%personnel%' OR indicator_text ILIKE '%staff%' OR indicator_text ILIKE '%identity%' LIMIT 1),
    'id_card',
    c.id,
    'ID Card: ' || u.first_name || ' ' || u.last_name || ' (' || c.card_number || ')',
    'primary_evidence',
    'Officer identification card demonstrating personnel management and access control compliance',
    1.0,
    'good',
    90,
    c.issue_date,
    c.expiry_date,
    c.issued_by
FROM officer_id_cards c
JOIN users u ON u.id = c.user_id
WHERE c.status = 'active'
AND NOT EXISTS (
    SELECT 1 FROM acs_evidence_documents 
    WHERE document_type = 'id_card' AND document_id = c.id
);

-- Create view for ID card compliance dashboard
CREATE OR REPLACE VIEW id_card_compliance_status AS
SELECT 
    c.company_id,
    COUNT(*) as total_cards,
    SUM(CASE WHEN c.status = 'active' THEN 1 ELSE 0 END) as active_cards,
    SUM(CASE WHEN c.expiry_date < CURRENT_DATE THEN 1 ELSE 0 END) as expired_cards,
    SUM(CASE WHEN c.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days' THEN 1 ELSE 0 END) as expiring_soon,
    SUM(CASE WHEN c.status = 'lost' THEN 1 ELSE 0 END) as lost_cards,
    SUM(CASE WHEN c.status = 'revoked' THEN 1 ELSE 0 END) as revoked_cards,
    
    -- Compliance percentage
    CASE 
        WHEN COUNT(*) = 0 THEN 0
        WHEN SUM(CASE WHEN c.expiry_date < CURRENT_DATE THEN 1 ELSE 0 END) > 0 THEN 25 -- Critical
        WHEN SUM(CASE WHEN c.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days' THEN 1 ELSE 0 END) > 0 THEN 75 -- Warning
        ELSE 100 -- Good
    END as compliance_percentage,
    
    -- Next action required
    CASE 
        WHEN SUM(CASE WHEN c.expiry_date < CURRENT_DATE THEN 1 ELSE 0 END) > 0 THEN 'Renew expired cards'
        WHEN SUM(CASE WHEN c.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days' THEN 1 ELSE 0 END) > 0 THEN 'Schedule renewals'
        WHEN SUM(CASE WHEN c.status = 'lost' THEN 1 ELSE 0 END) > 0 THEN 'Replace lost cards'
        ELSE 'Monitor compliance'
    END as next_action
    
FROM officer_id_cards c
GROUP BY c.company_id;

-- Update existing renewal records for already-issued cards
INSERT INTO document_renewals (
    company_id,
    document_type,
    document_id,
    document_title,
    issue_date,
    expiry_date,
    acs_requirement,
    compliance_evidence_type,
    mandatory_for_acs,
    renewal_priority,
    renewal_frequency_months,
    created_by
)
SELECT 
    c.company_id,
    'id_card',
    c.id,
    'ID Card: ' || u.first_name || ' ' || u.last_name || ' (' || c.card_number || ')',
    c.issue_date,
    c.expiry_date,
    'Officer identification and access control - ACS Personnel Management',
    'identity_verification',
    true,
    2, -- High priority
    24, -- 24 month renewal cycle
    c.issued_by
FROM officer_id_cards c
JOIN users u ON u.id = c.user_id
WHERE NOT EXISTS (
    SELECT 1 FROM document_renewals dr 
    WHERE dr.document_type = 'id_card' AND dr.document_id = c.id
);

-- Check the integration results
SELECT 'ID Cards in Renewal System' as metric, COUNT(*) as count
FROM document_renewals WHERE document_type = 'id_card'
UNION ALL
SELECT 'ID Cards in ACS Evidence', COUNT(*)
FROM acs_evidence_documents WHERE document_type = 'id_card'
UNION ALL  
SELECT 'Cards Expiring Soon', COUNT(*)
FROM officer_id_cards WHERE expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days';

