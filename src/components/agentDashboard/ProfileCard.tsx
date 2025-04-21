import React from 'react';
import { User } from 'lucide-react';
import { Card } from '../ui/card';

interface ProfileCardProps {
  agentId: string;
  period: string;
}

export function ProfileCard({ agentId, period }: ProfileCardProps) {
  return (
    <Card className="p-6">
      <div className="flex items-center space-x-4">
        <div className="h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center">
          <User className="h-6 w-6 text-indigo-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {agentId}
          </h3>
          <p className="text-sm text-gray-500">
            Period: {period}
          </p>
        </div>
      </div>
    </Card>
  );
}