import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { ChartBarIcon, ClockIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const ComplianceDashboard = ({ user }) => {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const response = await api.compliance.dashboard();
      setDashboard(response.dashboard);
    } catch (err) {
      setError(err.message);
      console.error('Compliance dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const runAssessment = async () => {
    try {
      setLoading(true);
      setError('');
      await api.compliance.autoCollect();
      await loadDashboard();
    } catch (err) {
      setError(`Assessment failed: ${err.message}`);
      console.error('Auto-assessment error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRingColor = (color) => {
    switch (color) {
      case 'green': return '#10b981';
      case 'amber': return '#f59e0b';
      case 'red': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const RingProgress = ({ percentage, color, size = 120 }) => {
    const strokeWidth = 8;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percentage / 100) * circumference;

    return (
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={getRingColor(color)}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-500 ease-in-out"
          />
        </svg>
        {/* Percentage text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900">{percentage}%</div>
          </div>
        </div>
      </div>
    );
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
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mt-0.5" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading compliance data</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return <div>No compliance data available</div>;
  }

  const { overall, criteria } = dashboard;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">ACS Compliance Dashboard</h1>
            <p className="text-blue-100 mt-1">Risk Secured Ltd - Certification Progress</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{overall.completionPercentage}%</div>
            <div className="text-sm text-blue-100">
              {overall.indicatorsCompleted} of {overall.totalIndicators} indicators
            </div>
          </div>
        </div>
      </div>

      {/* Overall Progress */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Overall Progress</h2>
          <div className="text-sm text-gray-500">
            Target: September 2025
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{overall.indicatorsCompleted}</div>
            <div className="text-sm text-gray-500">Completed Indicators</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{overall.totalIndicators - overall.indicatorsCompleted}</div>
            <div className="text-sm text-gray-500">Remaining</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{overall.totalScore}</div>
            <div className="text-sm text-gray-500">Current Score</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{overall.maxScore}</div>
            <div className="text-sm text-gray-500">Maximum Score</div>
          </div>
        </div>
      </div>

      {/* Criteria Rings */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">ACS Criteria Progress</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {Object.entries(criteria).map(([criterionNum, criterion]) => (
            <Link
              key={criterionNum}
              to={`/compliance/criteria/${criterionNum}`}
              className="block text-center hover:bg-gray-50 rounded-lg p-4 transition-colors cursor-pointer"
            >
              <RingProgress
                percentage={criterion.percentage}
                color={criterion.ringColor}
                size={100}
              />
              <h3 className="font-medium text-gray-900 mt-3 text-sm leading-tight">
                {criterion.name}
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                {criterion.completed} of {criterion.total} complete
              </p>
              <div className="mt-2">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  criterion.ringColor === 'green' ? 'bg-green-100 text-green-800' :
                  criterion.ringColor === 'amber' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {criterion.ringColor === 'green' ? 'On Track' :
                   criterion.ringColor === 'amber' ? 'In Progress' : 'Needs Work'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={runAssessment}
            disabled={loading}
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <CheckCircleIcon className="h-8 w-8 text-green-500 mr-3" />
            <div className="text-left">
              <div className="font-medium text-gray-900">
                {loading ? 'Running Assessment...' : 'Run Assessment'}
              </div>
              <div className="text-sm text-gray-500">Auto-collect evidence from DOB Live</div>
            </div>
          </button>

          <button className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <ChartBarIcon className="h-8 w-8 text-blue-500 mr-3" />
            <div className="text-left">
              <div className="font-medium text-gray-900">View Standards</div>
              <div className="text-sm text-gray-500">Browse ACS requirements</div>
            </div>
          </button>

          <button className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <ClockIcon className="h-8 w-8 text-orange-500 mr-3" />
            <div className="text-left">
              <div className="font-medium text-gray-900">Renewal Monitor</div>
              <div className="text-sm text-gray-500">Track upcoming deadlines</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ComplianceDashboard;
