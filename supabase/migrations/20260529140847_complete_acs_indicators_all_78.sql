-- Criterion 1: Strategy (add remaining 8, already has 1.1.1-1.1.3)
INSERT INTO acs_indicators (criterion_id, indicator_code, indicator_text, evidence_requirements) VALUES
(1, '1.2.1', 'Critical success factors have been clearly identified and internal measures are in place to monitor progress towards achievement', '{"KPI framework","Performance dashboards","Progress monitoring reports"}'),
(1, '1.2.2', 'Goals, objectives and targets are clearly visible for all levels of the organisation', '{"Business objectives document","Target communication","Performance visibility system"}'),
(1, '1.2.3', 'Procedures have been defined to ensure conformance to working standards or codes of practice', '{"Standard operating procedures","Quality frameworks","Compliance procedures"}'),
(1, '1.3.1', 'The management of internal and external communications is handled effectively', '{"Communication strategy","Internal communications system","External stakeholder management"}'),
(1, '1.4.1', 'There is a policy relating to corporate social responsibility and the environment which is communicated', '{"CSR policy","Environmental policy","Communication records"}'),
(1, '1.4.2', 'The organisation plans activities to promote and improve the reputation of the private security industry with the police, the local community and customers', '{"Industry engagement plan","Community relations","Police liaison activities"}'),
(1, '1.4.3', 'The organisation is involved in activities to promote and improve the awareness of counter-terrorist activities', '{"Counter-terrorism training","CT awareness programs","Industry CT participation"}'),
(1, '1.5.1', 'The organisation regularly reviews performance against success factors and performance indicators', '{"Performance review meetings","KPI monitoring reports","Improvement action plans"}');

-- Criterion 2: Service delivery (13 indicators)
INSERT INTO acs_indicators (criterion_id, indicator_code, indicator_text, evidence_requirements) VALUES
(2, '2.1.1', 'Key service delivery processes have been identified and are understood by all', '{"Service delivery procedures","Process documentation","Staff understanding evidence"}'),
(2, '2.2.1', 'There is a current and effective plan to ensure continuity of service delivery', '{"Business continuity plan","Contingency procedures","Service continuity testing"}'),
(2, '2.3.1', 'The organisation meets its customers requirements', '{"Customer requirements documentation","Service delivery records","Customer satisfaction evidence"}'),
(2, '2.3.2', 'There is an awareness of the impact of service delivery on consumers at all levels of the organisation', '{"Consumer impact assessment","Staff awareness training","Consumer feedback systems"}'),
(2, '2.3.3', 'The management of contractual arrangements with the customer has been defined', '{"Contract management procedures","Customer relationship management","Contractual compliance evidence"}'),
(2, '2.4.1', 'Use of subcontractors is agreed with customers and subject to defined quality assurance procedures', '{"Subcontractor agreements","Quality assurance procedures","Customer approval records"}'),
(2, '2.4.2', 'Effective customer and consumer performance indicators and service level agreements have been established', '{"Service level agreements","Performance indicators","Customer KPIs"}'),
(2, '2.4.3', 'Incident procedures are defined', '{"Incident response procedures","Emergency procedures","Incident reporting system"}'),
(2, '2.4.4', 'All procedures are regularly reviewed', '{"Procedure review schedule","Review documentation","Update records"}'),
(2, '2.4.5', 'Effective procedures exist to ensure the attendance of staff on customer sites', '{"Attendance procedures","Staff deployment systems","Site coverage assurance"}'),
(2, '2.5.1', 'Plans for improvement to site-based activity exist, based on the review of actual performance', '{"Performance improvement plans","Site performance analysis","Improvement tracking"}'),
(2, '2.5.2', 'Procedures for the implementation of changes are in place and used', '{"Change management procedures","Implementation processes","Change control records"}'),
(2, '2.6.1', 'The organisation regularly reviews performance against service level agreements and/or key customer performance indicators', '{"SLA performance reviews","Customer KPI monitoring","Performance improvement actions"}');

-- Criterion 3: Commercial relationship management (9 indicators)
INSERT INTO acs_indicators (criterion_id, indicator_code, indicator_text, evidence_requirements) VALUES
(3, '3.1.1', 'Effective purchasing procedures are implemented', '{"Purchasing policy","Procurement procedures","Supplier evaluation"}'),
(3, '3.1.2', 'The organisation works in partnership with its suppliers to improve performance', '{"Supplier partnership agreements","Performance improvement initiatives","Supplier development"}'),
(3, '3.2.1', 'Professional advice is offered to customers on the best approach to meet their needs', '{"Customer consultation records","Professional advice documentation","Needs assessment processes"}'),
(3, '3.2.2', 'The organisation implements an effective approach to responding to tenders/request for services', '{"Tender response procedures","Proposal processes","Bid management system"}'),
(3, '3.2.3', 'The organisation implements a process for obtaining new business', '{"Business development strategy","Lead generation processes","Sales procedures"}'),
(3, '3.3.1', 'The organisation implements a process for customer site visits', '{"Site visit procedures","Customer engagement processes","Visit documentation"}'),
(3, '3.3.2', 'The organisation implements a complaints procedure', '{"Complaints handling procedure","Customer feedback system","Resolution tracking"}'),
(3, '3.4.1', 'The organisation implements an approach to consumer contact', '{"Consumer communication strategy","Contact management procedures","Consumer engagement"}'),
(3, '3.5.1', 'The organisation regularly reviews performance against responses from customer opinion gathering', '{"Customer feedback analysis","Opinion survey results","Performance improvement based on feedback"}');

-- Criterion 4: Financial management (7 indicators)
INSERT INTO acs_indicators (criterion_id, indicator_code, indicator_text, evidence_requirements) VALUES
(4, '4.1.1', 'The organisation has the funding available to achieve its plan for the business', '{"Financial planning documents","Funding arrangements","Cash flow projections"}'),
(4, '4.2.1', 'Clear and effective management of the payroll can be evidenced', '{"Payroll procedures","Payment records","Payroll management systems"}'),
(4, '4.2.2', 'The organisation has effective financial management procedures, that is, there are sound fiscal controls in place', '{"Financial procedures","Internal controls","Financial management system"}'),
(4, '4.2.3', 'A clear fit and proper management structure with defined and understood authority levels is in place', '{"Organizational structure","Authority matrix","Management responsibilities"}'),
(4, '4.2.4', 'There is sufficient insurance to cover contractual requirements', '{"Insurance policies","Coverage documentation","Insurance certificates"}'),
(4, '4.3.1', 'The organisation conducts effective analysis of the market place in which it operates', '{"Market analysis","Competitive intelligence","Market research"}'),
(4, '4.4.1', 'The organisation regularly reviews performance against key financial indicators critical to the business', '{"Financial KPI monitoring","Performance reviews","Financial reporting"}');

-- Criterion 5: Resource management (7 indicators)
INSERT INTO acs_indicators (criterion_id, indicator_code, indicator_text, evidence_requirements) VALUES
(5, '5.1.1', 'Relevant versions of documents are available at the point of use', '{"Document control system","Version control procedures","Document availability"}'),
(5, '5.1.2', 'The organisation complies with legislation on the handling of and protection of data', '{"Data protection policy","GDPR compliance","Data handling procedures"}'),
(5, '5.2.1', 'Lease or ownership papers are appropriate to the business premises, providing administrative and any operational centres that are fit for purpose', '{"Premises documentation","Lease agreements","Facility adequacy assessment"}'),
(5, '5.2.2', 'Control rooms/response rooms are designed, fitted and equipped in a manner appropriate to purpose', '{"Control room specifications","Equipment lists","Facility design documentation"}'),
(5, '5.2.3', 'Equipment owned is recorded, adequately maintained and appropriate for its purpose', '{"Equipment register","Maintenance schedules","Equipment suitability assessment"}'),
(5, '5.2.4', 'Service delivery to customers and safety for staff are improved by investment in technology', '{"Technology investment plan","Safety improvements","Service enhancement through technology"}'),
(5, '5.3.1', 'The organisation regularly reviews the management of resources and data', '{"Resource management reviews","Data management assessment","Resource optimization"}');

-- Criterion 6: People (24 indicators)
INSERT INTO acs_indicators (criterion_id, indicator_code, indicator_text, evidence_requirements) VALUES
(6, '6.1.1', 'The organisation has an effective recruitment process', '{"Recruitment policy","Hiring procedures","Recruitment records"}'),
(6, '6.1.2', 'All staff have a written contract/terms and conditions of employment', '{"Employment contracts","Terms and conditions","Contract templates"}'),
(6, '6.1.3', 'All staff are licensed where required to do so by the SIA', '{"SIA licence records","Licence verification procedures","Licence monitoring system"}'),
(6, '6.1.4', 'The organisation has a staff vetting policy in place which ensures that BS 7858 is followed for the screening of all staff', '{"BS 7858 vetting policy","Screening procedures","Vetting completion records"}'),
(6, '6.1.5', 'All staff are right to work checked', '{"Right to work policy","Verification records","Document retention"}'),
(6, '6.2.1', 'There is a defined and implemented training plan for the organisation', '{"Training plan","Training calendar","Training needs analysis"}'),
(6, '6.2.2', 'Induction training covers all the elements detailed in the ACS induction requirements', '{"Induction programme","Induction checklist","Completion records"}'),
(6, '6.2.3', 'All staff deployed on assignments meet the specific requirements of the customer', '{"Assignment briefing records","Customer requirement matching","Deployment criteria"}'),
(6, '6.2.4', 'There are arrangements in place that ensure the competence of staff is continually reviewed and developed', '{"Competence review system","Continuous development plans","Skills assessment records"}'),
(6, '6.2.5', 'All staff carry an appropriate form of identification', '{"ID policy","ID card issuance records","ID verification procedures"}'),
(6, '6.2.6', 'All staff are aware of their responsibilities under the Health and Safety at Work Act', '{"H&S training records","H&S policy communication","Staff awareness evidence"}'),
(6, '6.3.1', 'Where a staff uniform or dress code is required, it is issued and expected standards are documented', '{"Uniform policy","Uniform issuance records","Dress code documentation"}'),
(6, '6.3.2', 'Staff are made aware of the standards of behaviour and conduct expected by the organisation', '{"Code of conduct","Conduct policy","Staff acknowledgement records"}'),
(6, '6.3.3', 'There is a clear and effective disciplinary procedure', '{"Disciplinary procedure","Disciplinary records","Appeal process"}'),
(6, '6.3.4', 'There is a clear and effective grievance procedure', '{"Grievance procedure","Grievance records","Resolution process"}'),
(6, '6.3.5', 'There is a defined and effective absence management procedure', '{"Absence management policy","Absence tracking system","Return to work procedures"}'),
(6, '6.3.6', 'The organisation promotes equality, diversity and inclusion in the workplace', '{"ED&I policy","ED&I training records","Diversity monitoring"}'),
(6, '6.4.1', 'An effective management appraisal/performance development review process is in place', '{"Appraisal system","Performance review records","Development plans"}'),
(6, '6.4.2', 'There is a formal process to recognise individuals for high achievement', '{"Recognition scheme","Achievement records","Reward procedures"}'),
(6, '6.5.1', 'The views and opinions of the workforce are actively sought and acted upon', '{"Employee engagement surveys","Feedback mechanisms","Action plans from feedback"}'),
(6, '6.5.2', 'The workforce is kept informed of significant changes and important developments', '{"Internal communications","Staff briefings","Change communication records"}'),
(6, '6.5.3', 'There is a method of employee consultation', '{"Consultation procedures","Employee forums","Consultation records"}'),
(6, '6.6.1', 'The organisation implements an approach to staff retention', '{"Retention strategy","Turnover analysis","Retention initiatives"}'),
(6, '6.7.1', 'The organisation regularly reviews the key people performance indicators', '{"People KPI monitoring","Performance analysis","HR metrics reporting"}');

-- Criterion 7: Leadership (7 indicators)
INSERT INTO acs_indicators (criterion_id, indicator_code, indicator_text, evidence_requirements) VALUES
(7, '7.1.1', 'Leaders demonstrate the skills required to lead the organisation effectively', '{"Leadership competency framework","Leadership development records","Leadership effectiveness evidence"}'),
(7, '7.1.2', 'Leaders are able to identify and react to changes in the business environment in a timely manner', '{"Business environment monitoring","Strategic response records","Adaptability evidence"}'),
(7, '7.2.1', 'Leaders promote a culture of ethical behaviour throughout the organisation', '{"Ethics policy","Ethical leadership evidence","Compliance culture"}'),
(7, '7.2.2', 'Leaders are visible role models within the organisation', '{"Leadership visibility evidence","Staff engagement","Leadership presence records"}'),
(7, '7.3.1', 'Leaders promote a culture of continuous improvement', '{"Continuous improvement policy","Improvement initiatives","Innovation evidence"}'),
(7, '7.3.2', 'Leaders promote a culture of learning', '{"Learning culture evidence","CPD support","Knowledge sharing initiatives"}'),
(7, '7.4.1', 'The organisation regularly reviews leadership effectiveness', '{"Leadership review process","360 feedback","Leadership performance assessment"}');
