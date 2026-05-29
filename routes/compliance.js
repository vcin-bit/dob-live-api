const router = require('express').Router();
const supabase = require('../lib/supabase');
const { authenticate, requireRole } = require('../middleware/auth');

// GET /api/compliance/dashboard — Main compliance overview
router.get('/dashboard', authenticate, async (req, res, next) => {
  try {
    // Get company's overall ACS progress
    const { data: assessments, error } = await supabase
      .from('company_acs_assessment')
      .select(`
        indicator_id,
        your_level,
        compliance_status,
        acs_indicators!inner(
          criterion_id,
          indicator_code,
          acs_criteria!inner(criterion_number, criterion_name)
        )
      `)
      .eq('company_id', req.user.company_id);

    if (error) throw error;

    // Calculate scores by criterion
    const criterionScores = {};

    // Initialize with all 7 criteria
    for (let i = 1; i <= 7; i++) {
      criterionScores[i] = { completed: 0, total: 0, score: 0 };
    }

    // Get total indicators per criterion from the ACS framework
    const criterionTotals = {
      1: 11, 2: 13, 3: 9, 4: 7, 5: 7, 6: 24, 7: 7
    };

    // Process assessments
    assessments.forEach(assessment => {
      const criterionNum = assessment.acs_indicators.acs_criteria.criterion_number;
      const level = assessment.your_level || 0;

      criterionScores[criterionNum].total++;
      criterionScores[criterionNum].score += level;

      if (assessment.compliance_status === 'completed' || level >= 2) {
        criterionScores[criterionNum].completed++;
      }
    });

    // Calculate completion percentages and ring colors
    const dashboard = {
      overall: {
        indicatorsCompleted: Object.values(criterionScores).reduce((sum, c) => sum + c.completed, 0),
        totalIndicators: 78,
        totalScore: Object.values(criterionScores).reduce((sum, c) => sum + c.score, 0),
        maxScore: 145,
        completionPercentage: Math.round((Object.values(criterionScores).reduce((sum, c) => sum + c.completed, 0) / 78) * 100)
      },
      criteria: {}
    };

    // Build criterion summaries with ring colors
    Object.keys(criterionScores).forEach(num => {
      const criterion = criterionScores[num];
      const total = criterionTotals[num] || criterion.total;
      const percentage = total > 0 ? Math.round((criterion.completed / total) * 100) : 0;

      let ringColor = 'red';
      if (percentage >= 90) ringColor = 'green';
      else if (percentage >= 60) ringColor = 'amber';

      dashboard.criteria[num] = {
        name: criterionTotals[num] ? ['Strategy', 'Service delivery', 'Commercial relationship management', 'Financial management', 'Resource management', 'People', 'Leadership'][num-1] : `Criterion ${num}`,
        completed: criterion.completed,
        total: total,
        score: criterion.score,
        percentage: percentage,
        ringColor: ringColor
      };
    });

    res.json({ dashboard });
  } catch (err) { next(err); }
});

// PUT /api/compliance/indicators/:id — Update indicator assessment
router.put('/indicators/:indicatorId', authenticate, requireRole('COMPANY', 'SUPER_ADMIN', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const { indicatorId } = req.params;
    const {
      your_level,
      evidence_notes,
      compliance_status,
      target_completion_date
    } = req.body;

    const { data, error } = await supabase
      .from('company_acs_assessment')
      .upsert({
        company_id: req.user.company_id,
        indicator_id: parseInt(indicatorId),
        your_level: your_level || 0,
        evidence_notes: evidence_notes || '',
        compliance_status: compliance_status || 'in_progress',
        target_completion_date: target_completion_date || null,
        updated_by: req.user.id,
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'company_id,indicator_id'
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ data });
  } catch (err) { next(err); }
});

// GET /api/compliance/criteria/:id — Detailed view of specific criterion
router.get('/criteria/:criterionId', authenticate, async (req, res, next) => {
  try {
    const { criterionId } = req.params;

    // Get all indicators for this criterion with assessments
    const { data: indicators, error } = await supabase
      .from('acs_indicators')
      .select(`
        *,
        company_assessments:company_acs_assessment!left(
          your_level,
          assessor_level,
          compliance_status,
          evidence_notes,
          target_completion_date,
          last_updated
        )
      `)
      .eq('criterion_id', criterionId)
      .eq('company_assessments.company_id', req.user.company_id);

    if (error) throw error;

    // Get criterion info
    const { data: criterion } = await supabase
      .from('acs_criteria')
      .select('*')
      .eq('id', criterionId)
      .single();

    res.json({
      criterion,
      indicators: indicators.map(ind => ({
        ...ind,
        assessment: ind.company_assessments[0] || null
      }))
    });
  } catch (err) { next(err); }
});

// POST /api/compliance/auto-collect — Auto-score indicators from DOB Live data
router.post('/auto-collect', authenticate, requireRole('COMPANY', 'SUPER_ADMIN', 'OPS_MANAGER', 'FD'), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    const results = [];

    // Get all indicators
    const { data: indicators, error: indErr } = await supabase
      .from('acs_indicators')
      .select('id, indicator_code, criterion_id');
    if (indErr) throw indErr;

    // Collect data counts for evidence scoring
    const counts = {};

    const queries = [
      ['active_users',  supabase.from('users').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('active', true)],
      ['users_with_sia', supabase.from('users').select('id', { count: 'exact', head: true }).eq('company_id', companyId).not('sia_licence_number', 'is', null)],
      ['total_logs',    supabase.from('occurrence_logs').select('id', { count: 'exact', head: true }).eq('company_id', companyId)],
      ['total_shifts',  supabase.from('shifts').select('id', { count: 'exact', head: true }).eq('company_id', companyId)],
      ['total_sites',   supabase.from('sites').select('id', { count: 'exact', head: true }).eq('company_id', companyId)],
      ['total_patrols', supabase.from('patrol_sessions').select('id', { count: 'exact', head: true }).eq('company_id', companyId)],
      ['shift_patterns', supabase.from('shift_patterns').select('id', { count: 'exact', head: true }).eq('company_id', companyId)],
      ['hr_records',    supabase.from('officer_hr').select('id', { count: 'exact', head: true }).eq('company_id', companyId)],
    ];

    for (const [key, query] of queries) {
      const { count } = await query;
      counts[key] = count || 0;
    }

    // Score each indicator based on available evidence
    for (const indicator of indicators) {
      let level = 0;
      let notes = [];
      let status = 'not_started';
      const code = indicator.indicator_code;

      // Criterion 1: Strategy
      if (indicator.criterion_id === 1) {
        if (code === '1.1.1') {
          if (counts.active_users > 0) { level = 1; notes.push(`${counts.active_users} active users on platform`); }
          if (counts.total_sites > 3 && counts.total_shifts > 100) { level = 2; notes.push(`${counts.total_sites} sites, ${counts.total_shifts} shifts — established operations`); }
        } else if (code === '1.1.2') {
          if (counts.total_sites > 0) { level = 1; notes.push(`${counts.total_sites} client sites configured`); }
          if (counts.total_logs > 500) { level = 2; notes.push(`${counts.total_logs} occurrence logs — active client reporting`); }
        } else if (code === '1.1.3') {
          if (counts.shift_patterns > 0) { level = 1; notes.push(`${counts.shift_patterns} shift patterns defined`); }
          if (counts.shift_patterns > 5 && counts.total_patrols > 100) { level = 2; notes.push('Structured scheduling and patrol operations'); }
        } else if (code === '1.2.1') {
          if (counts.total_shifts > 50) { level = 1; notes.push('Shift tracking active — operational KPIs measurable'); }
          if (counts.total_logs > 1000 && counts.total_patrols > 200) { level = 2; notes.push('Comprehensive operational data for performance monitoring'); }
        } else if (code === '1.2.2') {
          if (counts.active_users > 3) { level = 1; notes.push(`${counts.active_users} users with platform access — objectives visible`); }
        } else if (code === '1.2.3') {
          if (counts.shift_patterns > 0 && counts.total_patrols > 0) { level = 1; notes.push('SOPs evidenced through shift patterns and patrol routes'); }
          if (counts.total_patrols > 200) { level = 2; notes.push(`${counts.total_patrols} patrols — procedures actively followed`); }
        } else if (code === '1.3.1') {
          if (counts.total_logs > 100) { level = 1; notes.push('Occurrence logs demonstrate communication flow'); }
          if (counts.total_logs > 1000) { level = 2; notes.push(`${counts.total_logs} logs — effective communication management`); }
        } else if (code === '1.5.1') {
          if (counts.total_shifts > 50 && counts.total_logs > 100) { level = 1; notes.push('Operational data available for performance review'); }
          if (counts.total_patrols > 200 && counts.total_logs > 1000) { level = 2; notes.push('Rich performance data for regular review'); }
        }
      }

      // Criterion 2: Service delivery
      if (indicator.criterion_id === 2) {
        if (code === '2.1.1') {
          if (counts.shift_patterns > 0) { level = 1; notes.push(`${counts.shift_patterns} shift patterns — service processes defined`); }
          if (counts.shift_patterns > 5 && counts.total_patrols > 100) { level = 2; notes.push('Mature service delivery processes'); }
        } else if (code === '2.2.1') {
          if (counts.active_users > 3 && counts.total_sites > 1) { level = 1; notes.push('Multiple officers and sites — continuity capability'); }
        } else if (code === '2.3.1') {
          if (counts.total_shifts > 100) { level = 1; notes.push(`${counts.total_shifts} shifts delivered`); }
          if (counts.total_shifts > 100 && counts.total_logs > 1000) { level = 2; notes.push('Sustained service delivery with reporting'); }
        } else if (code === '2.3.3') {
          if (counts.total_sites > 0) { level = 1; notes.push(`${counts.total_sites} client sites under contract`); }
        } else if (code === '2.4.2') {
          if (counts.total_logs > 500) { level = 1; notes.push('Incident logging demonstrates SLA tracking'); }
          if (counts.total_logs > 1000) { level = 2; notes.push(`${counts.total_logs} logs — comprehensive performance tracking`); }
        } else if (code === '2.4.3') {
          if (counts.total_logs > 100) { level = 1; notes.push('Incident procedures in use via occurrence logging'); }
          if (counts.total_logs > 1000) { level = 2; notes.push(`${counts.total_logs} incidents recorded — procedures embedded`); }
        } else if (code === '2.4.5') {
          if (counts.total_shifts > 50) { level = 1; notes.push('Shift system tracks attendance'); }
          if (counts.total_shifts > 100) { level = 2; notes.push(`${counts.total_shifts} shifts — attendance management evidenced`); }
        } else if (code === '2.5.1') {
          if (counts.total_patrols > 100) { level = 1; notes.push(`${counts.total_patrols} patrols — site activity tracked`); }
          if (counts.total_patrols > 300) { level = 2; notes.push('Patrol data enables performance improvement'); }
        } else if (code === '2.6.1') {
          if (counts.total_logs > 500 && counts.total_shifts > 100) { level = 1; notes.push('Data available for SLA review'); }
          if (counts.total_logs > 1000) { level = 2; notes.push('Comprehensive data for performance reviews'); }
        }
      }

      // Criterion 3: Commercial relationship management
      if (indicator.criterion_id === 3) {
        if (code === '3.2.1') {
          if (counts.total_sites > 3) { level = 1; notes.push(`${counts.total_sites} client relationships active`); }
        } else if (code === '3.3.1') {
          if (counts.total_sites > 0) { level = 1; notes.push('Site management demonstrates client engagement'); }
        } else if (code === '3.3.2') {
          if (counts.total_logs > 100) { level = 1; notes.push('Occurrence log system can capture complaints'); }
        }
      }

      // Criterion 4: Financial management
      if (indicator.criterion_id === 4) {
        if (code === '4.2.1') {
          if (counts.hr_records > 0) { level = 1; notes.push(`${counts.hr_records} HR/payroll records on file`); }
          if (counts.hr_records > 3) { level = 2; notes.push('Payroll records evidenced for workforce'); }
        } else if (code === '4.2.3') {
          if (counts.active_users > 3) { level = 1; notes.push('Defined user roles in platform demonstrate authority levels'); }
        }
      }

      // Criterion 5: Resource management
      if (indicator.criterion_id === 5) {
        if (code === '5.1.1') {
          if (counts.total_sites > 0) { level = 1; notes.push('DOB Live delivers documents to point of use'); }
          if (counts.total_sites > 3) { level = 2; notes.push(`Documents available across ${counts.total_sites} sites via platform`); }
        } else if (code === '5.1.2') {
          if (counts.active_users > 0) { level = 1; notes.push('Platform manages data with role-based access'); }
        } else if (code === '5.2.4') {
          if (counts.total_patrols > 0 && counts.total_logs > 0) { level = 1; notes.push('DOB Live platform investment in technology'); }
          if (counts.total_patrols > 200 && counts.total_logs > 1000) { level = 2; notes.push('Technology driving service delivery and safety'); }
        }
      }

      // Criterion 6: People
      if (indicator.criterion_id === 6) {
        if (code === '6.1.3') {
          if (counts.users_with_sia > 0) { level = 1; notes.push(`${counts.users_with_sia} officers with SIA licences recorded`); }
          if (counts.users_with_sia > 3) { level = 2; notes.push('SIA licensing tracked across workforce'); }
        } else if (code === '6.1.4') {
          if (counts.hr_records > 0) { level = 1; notes.push(`${counts.hr_records} BS 7858 vetting records on file`); }
          if (counts.hr_records > 3) { level = 2; notes.push('Vetting records maintained for workforce'); }
        } else if (code === '6.1.5') {
          if (counts.hr_records > 0) { level = 1; notes.push('HR records include right to work checks'); }
          if (counts.hr_records > 3) { level = 2; notes.push('Right to work verified across workforce'); }
        } else if (code === '6.2.3') {
          if (counts.total_shifts > 50) { level = 1; notes.push('Shift assignments match officers to sites'); }
          if (counts.total_shifts > 100) { level = 2; notes.push(`${counts.total_shifts} assignments — deployment management evidenced`); }
        } else if (code === '6.2.5') {
          if (counts.users_with_sia > 0) { level = 1; notes.push('SIA licences serve as staff identification'); }
        } else if (code === '6.2.6') {
          if (counts.total_patrols > 0) { level = 1; notes.push('Patrol system demonstrates H&S awareness in practice'); }
        } else if (code === '6.5.2') {
          if (counts.total_logs > 500) { level = 1; notes.push('Communication through occurrence log system'); }
          if (counts.total_logs > 1000) { level = 2; notes.push(`${counts.total_logs} logs — workforce kept informed`); }
        }
      }

      // Criterion 7: Leadership
      if (indicator.criterion_id === 7) {
        if (code === '7.1.1') {
          if (counts.total_sites > 3 && counts.active_users > 5) { level = 1; notes.push('Operational scale demonstrates leadership capability'); }
        } else if (code === '7.3.1') {
          if (counts.total_patrols > 200 && counts.total_logs > 1000) { level = 1; notes.push('Operational data enables continuous improvement culture'); }
        }
      }

      if (level > 0) {
        status = level >= 2 ? 'completed' : 'in_progress';

        const { data, error } = await supabase
          .from('company_acs_assessment')
          .upsert({
            company_id: companyId,
            indicator_id: indicator.id,
            your_level: level,
            evidence_notes: `Auto-collected ${new Date().toISOString().slice(0,10)}: ${notes.join('. ')}`,
            compliance_status: status,
            updated_by: req.user.id,
            last_updated: new Date().toISOString()
          }, { onConflict: 'company_id,indicator_id' })
          .select()
          .single();

        if (error) throw error;
        results.push({ indicator_code: indicator.indicator_code, level, status, notes });
      }
    }

    res.json({
      collected: results.length,
      evidence_summary: counts,
      results
    });
  } catch (err) { next(err); }
});

module.exports = router;
