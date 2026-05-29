import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { ArrowLeftIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const LEVEL_LABELS = ['Not Started', 'Awareness', 'Developing', 'Established'];
const LEVEL_COLORS = ['bg-gray-100 text-gray-600', 'bg-yellow-100 text-yellow-800', 'bg-blue-100 text-blue-800', 'bg-green-100 text-green-800'];
const STATUS_LABELS = { not_started: 'Not Started', in_progress: 'In Progress', completed: 'Completed', needs_review: 'Needs Review' };

const ComplianceCriterionDetail = ({ user }) => {
  const { criterionId } = useParams();
  const [criterion, setCriterion] = useState(null);
  const [indicators, setIndicators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCriterion();
  }, [criterionId]);

  const loadCriterion = async () => {
    try {
      setLoading(true);
      const res = await api.compliance.getCriteria(criterionId);
      setCriterion(res.criterion);
      setIndicators(res.indicators || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="spinner" style={{ borderTopColor: '#1a52a8' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  if (!criterion) return null;

  const scored = indicators.filter(i => i.assessment && i.assessment.your_level > 0).length;
  const completed = indicators.filter(i => i.assessment && (i.assessment.compliance_status === 'completed' || i.assessment.your_level >= 2)).length;

  return (
    <div className="space-y-6 p-6">
      {/* Back link + header */}
      <div>
        <Link to="/compliance" className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 mb-4">
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to Dashboard
        </Link>
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-blue-200">Criterion {criterion.criterion_number}</div>
              <h1 className="text-2xl font-bold mt-1">{criterion.criterion_name}</h1>
              <p className="text-blue-100 mt-1">{criterion.description}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{completed}/{indicators.length}</div>
              <div className="text-sm text-blue-100">indicators complete</div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Progress</span>
          <span className="text-sm text-gray-500">{scored} scored, {completed} complete, {indicators.length - scored} remaining</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="h-3 rounded-full transition-all duration-500"
            style={{
              width: `${indicators.length > 0 ? Math.round((completed / indicators.length) * 100) : 0}%`,
              backgroundColor: completed / indicators.length >= 0.9 ? '#10b981' : completed / indicators.length >= 0.6 ? '#f59e0b' : '#ef4444'
            }}
          />
        </div>
      </div>

      {/* Indicators list */}
      <div className="space-y-3">
        {indicators.map(ind => {
          const a = ind.assessment;
          const level = a ? a.your_level : 0;
          const status = a ? a.compliance_status : 'not_started';

          return (
            <div key={ind.id} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-blue-600 whitespace-nowrap">{ind.indicator_code}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${LEVEL_COLORS[level]}`}>
                      L{level} — {LEVEL_LABELS[level]}
                    </span>
                  </div>
                  <p className="text-sm text-gray-900 leading-relaxed">{ind.indicator_text}</p>

                  {/* Evidence requirements */}
                  {ind.evidence_requirements && ind.evidence_requirements.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Evidence Required</div>
                      <div className="flex flex-wrap gap-1.5">
                        {ind.evidence_requirements.map((req, i) => (
                          <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                            {req}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Auto-collected notes */}
                  {a && a.evidence_notes && (
                    <div className="mt-3 bg-blue-50 border border-blue-100 rounded p-2">
                      <div className="text-xs font-medium text-blue-700 mb-0.5">Auto-Collected Evidence</div>
                      <p className="text-xs text-blue-600">{a.evidence_notes}</p>
                    </div>
                  )}
                </div>

                {/* Status icon */}
                <div className="flex-shrink-0">
                  {level >= 2 ? (
                    <CheckCircleIcon className="h-6 w-6 text-green-500" />
                  ) : level === 1 ? (
                    <ExclamationTriangleIcon className="h-6 w-6 text-yellow-500" />
                  ) : (
                    <div className="h-6 w-6 rounded-full border-2 border-gray-300" />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ComplianceCriterionDetail;
