import React, { useState, useRef, useMemo } from 'react';
import { Upload, Download, Filter, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { format } from 'date-fns';

interface ExecutionResult {
  success: boolean;
  message: string;
  data: {
    totalRecords: number;
    processedAt: string;
    summary: {
      totalAgents: number;
      qualified: number;
      totalPayout: number;
    };
    agents: Array<{
      agentId: string;
      name?: string;
      qualified: boolean;
      commission: number;
      qualifyingCriteria: Array<{
        ruleType: string;
        ruleId: string;
        ruleName?: string;
        recordId: string;
        transactionId?: string;
        agentId: string;
        message: string;
        timestamp: string;
      }>;
      adjustments: Array<{
        ruleType: string;
        ruleId: string;
        ruleName?: string;
        recordId: string;
        transactionId?: string;
        agentId: string;
        message: string;
        timestamp: string;
      }>;
      exclusions: Array<{
        ruleType: string;
        ruleId: string;
        ruleName?: string;
        recordId: string;
        transactionId?: string;
        agentId: string;
        message: string;
        timestamp: string;
      }>;
    }>;
  };
}

interface LogEntry {
  ruleType: string;
  ruleId: string;
  ruleName?: string;
  recordId: string;
  transactionId?: string;
  agentId: string;
  message: string;
  timestamp: string;
}

interface AgentGroup {
  agentId: string;
  name?: string;
  logs: LogEntry[];
  totalRules: number;
}

export function ExecutionLog() {
  const [executionLog, setExecutionLog] = useState<ExecutionResult | null>(null);
  const [filterAgent, setFilterAgent] = useState<string>('');
  const [filterRuleType, setFilterRuleType] = useState<string>('');
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const log = JSON.parse(e.target?.result as string);
          setExecutionLog(log);
          // Initially expand all agent groups
          const agents = new Set(log.data.agents.map((agent: any) => agent.agentId));
          setExpandedAgents(agents);
        } catch (error) {
          console.error('Failed to parse execution log:', error);
        }
      };
      reader.readAsText(file);
    }
  };

  const downloadLog = () => {
    if (!executionLog) return;
    
    const jsonStr = JSON.stringify(executionLog, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `execution_log_${format(new Date(), 'yyyyMMdd_HHmmss')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const toggleAgentExpansion = (agentId: string) => {
    setExpandedAgents(prev => {
      const next = new Set(prev);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
      }
      return next;
    });
  };

  const getGroupedAndSortedLogs = useMemo(() => {
    if (!executionLog?.data.agents) return [];

    const agentGroups: AgentGroup[] = [];
    
    executionLog.data.agents.forEach(agent => {
      if (filterAgent && !agent.agentId.toLowerCase().includes(filterAgent.toLowerCase())) {
        return;
      }

      const allLogs: LogEntry[] = [];
      const uniqueLogKeys = new Set<string>();
      
      const addLogs = (items: any[], type: string) => {
        if (filterRuleType && !type.toLowerCase().includes(filterRuleType.toLowerCase())) {
          return;
        }
        
        items.forEach(item => {
          // Create a unique key based on transaction, rule, and message
          const logKey = `${item.transactionId}-${item.ruleId}-${item.message}`;
          
          if (!uniqueLogKeys.has(logKey)) {
            uniqueLogKeys.add(logKey);
            allLogs.push({
              ...item,
              ruleType: type,
              ruleName: item.ruleName || item.ruleId // Fallback to ruleId if ruleName not present
            });
          }
        });
      };

      addLogs(agent.qualifyingCriteria, 'Qualification');
      addLogs(agent.adjustments, 'Adjustment');
      addLogs(agent.exclusions, 'Exclusion');

      // Sort logs: transactionId (asc) -> timestamp (desc)
      const sortedLogs = allLogs.sort((a, b) => {
        // Primary sort by transactionId
        if (a.transactionId && b.transactionId) {
          const transCompare = a.transactionId.localeCompare(b.transactionId);
          if (transCompare !== 0) return transCompare;
        }
        
        // Secondary sort by timestamp (descending)
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

      if (sortedLogs.length > 0) {
        agentGroups.push({
          agentId: agent.agentId,
          name: agent.name,
          logs: sortedLogs,
          totalRules: sortedLogs.length
        });
      }
    });

    // Sort groups by agentId (ascending)
    return agentGroups.sort((a, b) => a.agentId.localeCompare(b.agentId));
  }, [executionLog, filterAgent, filterRuleType]);

  const getRuleTypeBadgeClass = (type: string): string => {
    switch (type) {
      case 'Qualification':
        return 'bg-blue-100 text-blue-800';
      case 'Adjustment':
        return 'bg-green-100 text-green-800';
      case 'Exclusion':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Execution Log</h1>
        <div className="flex space-x-3">
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-full bg-black text-white hover:opacity-90"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Log
          </Button>
          {executionLog && (
            <Button
              onClick={downloadLog}
              variant="outline"
              className="rounded-full hover:bg-gray-100"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Log
            </Button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      {executionLog && (
        <>
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Execution Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="text-sm font-medium text-gray-500">Total Records</div>
                <div className="mt-1 text-2xl font-semibold">{executionLog.data.totalRecords}</div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="text-sm font-medium text-gray-500">Total Agents</div>
                <div className="mt-1 text-2xl font-semibold">{executionLog.data.summary.totalAgents}</div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="text-sm font-medium text-gray-500">Qualified Agents</div>
                <div className="mt-1 text-2xl font-semibold">{executionLog.data.summary.qualified}</div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="text-sm font-medium text-gray-500">Total Payout</div>
                <div className="mt-1 text-2xl font-semibold">
                  ₹{executionLog.data.summary.totalPayout.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Rule Processing Log</h2>
              <div className="flex space-x-3">
                <input
                  type="text"
                  placeholder="Filter by Agent ID"
                  value={filterAgent}
                  onChange={(e) => setFilterAgent(e.target.value)}
                  className="px-3 py-2 border rounded-md"
                />
                <input
                  type="text"
                  placeholder="Filter by Rule Type"
                  value={filterRuleType}
                  onChange={(e) => setFilterRuleType(e.target.value)}
                  className="px-3 py-2 border rounded-md"
                />
                <Button variant="outline" className="rounded-full">
                  <Filter className="h-4 w-4 mr-2" />
                  Filter
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {getGroupedAndSortedLogs.map((group) => (
                <div 
                  key={group.agentId} 
                  className="border rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow duration-200"
                >
                  <div 
                    className="bg-gradient-to-r from-gray-50 to-white p-4 flex justify-between items-center cursor-pointer border-l-4 border-indigo-500"
                    onClick={() => toggleAgentExpansion(group.agentId)}
                  >
                    <div className="flex items-center space-x-3">
                      {expandedAgents.has(group.agentId) ? (
                        <ChevronDown className="h-5 w-5 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-500" />
                      )}
                      <div>
                        <h3 className="font-medium text-gray-900">
                          Agent: {group.name || group.agentId}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {group.totalRules} rules triggered
                        </p>
                      </div>
                    </div>
                  </div>

                  {expandedAgents.has(group.agentId) && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Transaction
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Type
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Rule
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Message
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Timestamp
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {group.logs.map((log, index) => (
                            <tr key={`${log.recordId}-${index}`} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {log.transactionId || '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRuleTypeBadgeClass(log.ruleType)}`}>
                                  {log.ruleType}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {log.ruleName}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500">
                                {log.message}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                                {format(new Date(log.timestamp), 'PPpp')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {!executionLog && (
        <div className="text-center py-12">
          <p className="text-gray-500">Upload an execution log file to view details</p>
        </div>
      )}
    </div>
  );
}