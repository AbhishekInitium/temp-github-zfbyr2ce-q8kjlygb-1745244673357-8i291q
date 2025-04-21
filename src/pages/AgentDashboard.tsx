import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Card } from '../components/ui/card';
import { ProfileCard } from '../components/agentDashboard/ProfileCard';
import { PayoutCard } from '../components/agentDashboard/PayoutCard';
import { AttainmentRing } from '../components/agentDashboard/AttainmentRing';
import { RuleLogTable } from '../components/agentDashboard/RuleLogTable';
import { CreditTable } from '../components/agentDashboard/CreditTable';
import { RawDataTable } from '../components/agentDashboard/RawDataTable';
import { useAuthStore } from '../store/authStore';

// Import dummy data
import schemeResult1 from '../data/schemeResult1.json';
import schemeResult2 from '../data/schemeResult2.json';

const SCHEMES = [
  { id: 'scheme1', name: 'Q1 2025 Sales Incentive', data: schemeResult1 },
  { id: 'scheme2', name: 'Q2 2025 Sales Incentive', data: schemeResult2 },
];

const widgetConfig = {
  profile: true,
  payout: true,
  kpi: true,
  ruleLog: true,
  credit: true,
  rawData: true,
};

export function AgentDashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [selectedScheme, setSelectedScheme] = useState(SCHEMES[0]);

  useEffect(() => {
    // Redirect if not logged in or not an agent
    if (!user) {
      navigate('/login');
      return;
    }

    if (user.role !== 'agent') {
      navigate('/');
      return;
    }
  }, [user, navigate]);

  // Show nothing while checking authentication
  if (!user) {
    return null;
  }

  // Show access denied message if not an agent
  if (user.role !== 'agent') {
    return (
      <Card className="max-w-2xl mx-auto mt-8 p-6">
        <div className="flex items-center space-x-3 text-red-600">
          <AlertCircle className="h-6 w-6" />
          <h3 className="text-lg font-medium">Access Denied</h3>
        </div>
        <p className="mt-2 text-gray-600">
          This dashboard is only accessible to users with the Agent role.
        </p>
      </Card>
    );
  }

  const getCurrentData = () => {
    const data = selectedScheme.data;
    return {
      payout: data.agentPayouts[user.id] || '0.00',
      logs: data.ruleHitLogs[user.id] || [],
      credits: Object.values(data.creditDistributions).flat(),
      rawRecords: data.rawRecordLevelData.filter(record => record.agentId === user.id),
    };
  };

  const currentData = getCurrentData();

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Agent Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Welcome back, {user.username} ({user.id})
          </p>
        </div>
        <select
          value={selectedScheme.id}
          onChange={(e) => setSelectedScheme(SCHEMES.find(s => s.id === e.target.value) || SCHEMES[0])}
          className="block w-64 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        >
          {SCHEMES.map((scheme) => (
            <option key={scheme.id} value={scheme.id}>
              {scheme.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {widgetConfig.profile && (
          <ProfileCard
            agentId={user.id}
            period={selectedScheme.name}
          />
        )}
        {widgetConfig.payout && (
          <PayoutCard amount={currentData.payout} />
        )}
        {widgetConfig.kpi && (
          <AttainmentRing
            percentage={85}
            label="Target Attainment"
          />
        )}
      </div>

      {widgetConfig.ruleLog && currentData.logs.length > 0 && (
        <RuleLogTable logs={currentData.logs} />
      )}

      {widgetConfig.credit && currentData.credits.length > 0 && (
        <CreditTable distributions={currentData.credits} />
      )}

      {widgetConfig.rawData && currentData.rawRecords.length > 0 && (
        <RawDataTable records={currentData.rawRecords} />
      )}
    </div>
  );
}