import React from 'react';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { Card } from '../ui/card';

interface AttainmentRingProps {
  percentage: number;
  label: string;
}

export function AttainmentRing({ percentage, label }: AttainmentRingProps) {
  return (
    <Card className="p-6">
      <div className="text-center">
        <div className="w-32 h-32 mx-auto">
          <CircularProgressbar
            value={percentage}
            text={`${percentage}%`}
            styles={buildStyles({
              textSize: '16px',
              pathColor: percentage >= 100 ? '#059669' : '#6366F1',
              textColor: '#111827',
              trailColor: '#E5E7EB',
            })}
          />
        </div>
        <h3 className="mt-4 text-lg font-medium text-gray-900">{label}</h3>
      </div>
    </Card>
  );
}