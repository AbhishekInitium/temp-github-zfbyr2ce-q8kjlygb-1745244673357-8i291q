import React from 'react';
import { Wallet } from 'lucide-react';
import { Card } from '../ui/card';

interface PayoutCardProps {
  amount: string;
}

export function PayoutCard({ amount }: PayoutCardProps) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">Current Period Payment</p>
          <h3 className="mt-1 text-3xl font-semibold text-gray-900">
            ₹{parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </h3>
        </div>
        <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
          <Wallet className="h-6 w-6 text-green-600" />
        </div>
      </div>
    </Card>
  );
}