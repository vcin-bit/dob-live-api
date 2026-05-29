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
router.put('/indicators/:indicatorId', authenticate, requireRole('COMPANY', 'SUPER_ADMIN', 'OPS_MANAGER'), async (req, res, next) => {
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

module.exports = router;
