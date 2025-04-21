import React, { useState, useRef } from 'react';
import { format } from 'date-fns';
import { Plus, Save, Edit2, X, FileUp, Calculator, Upload, AlertCircle, Check } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { useAuthStore } from '../store/authStore';
import { RuleBuilder } from './scheme/RuleBuilder';
import { AdjustmentRuleBuilder } from './scheme/AdjustmentRuleBuilder';
import { PayoutTierBuilder } from './scheme/PayoutTierBuilder';
import { CreditSplitTable } from './scheme/CreditSplitTable';
import type { CompensationScheme, KpiConfig } from '../types';

type Mode = 'initial' | 'new' | 'view' | 'edit';

const DEFAULT_CONFIG: CompensationScheme = {
  name: '',
  description: '',
  effectiveFrom: '',
  effectiveTo: '',
  quotaAmount: 0,
  revenueBase: '',
  baseMapping: {
    sourceFile: '',
    agentField: '',
    amountField: '',
    transactionDateField: '',
    txnID: ''
  },
  qualificationRules: [],
  adjustmentRules: [],
  exclusionRules: [],
  creditRules: [],
  creditSplits: [],
  creditHierarchyFile: '',
  payoutTiers: [],
  customRules: [],
  status: 'DRAFT',
  versionNumber: 1
};

function SchemeDesigner() {
  const user = useAuthStore((state) => state.user);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const kpiConfigInputRef = useRef<HTMLInputElement>(null);
  const additionalKpiConfigInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>('initial');
  const [schemeName, setSchemeName] = useState('');
  const [schemeNameError, setSchemeNameError] = useState('');
  const [config, setConfig] = useState<CompensationScheme>(DEFAULT_CONFIG);
  const [hasChanges, setHasChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState('');
  const [activeSection, setActiveSection] = useState('base');
  const [loadedKpiConfig, setLoadedKpiConfig] = useState<KpiConfig | null>(null);

  const validateSchemeName = (value: string): boolean => {
    if (!value) {
      setSchemeNameError('Scheme name is required');
      return false;
    }
    if (!/^[a-zA-Z0-9]{1,10}$/.test(value)) {
      setSchemeNameError('Only alphanumeric characters allowed (max 10 chars)');
      return false;
    }
    setSchemeNameError('');
    return true;
  };

  const handleFileLoad = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const loadedConfig = JSON.parse(e.target?.result as string);
          setConfig(loadedConfig);
          setMode('view');
          setValidationErrors({});
          setSuccessMessage('Scheme loaded successfully');
          setTimeout(() => setSuccessMessage(''), 3000);
        } catch (error) {
          console.error('Error parsing scheme:', error);
          setValidationErrors({
            parse: 'Failed to parse scheme file'
          });
        }
      };
      reader.readAsText(file);
    }
  };

  const handleKpiConfigUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const kpiConfig = JSON.parse(e.target?.result as string);
          
          if (!kpiConfig.qualificationFields?.length) {
            setValidationErrors(prev => ({
              ...prev,
              kpiConfig: 'Invalid KPI configuration: Must contain at least one qualification field'
            }));
            return;
          }

          if (!kpiConfig.calculationBase) {
            setValidationErrors(prev => ({
              ...prev,
              kpiConfig: 'Invalid KPI configuration: Missing calculation base'
            }));
            return;
          }

          setLoadedKpiConfig(kpiConfig);
          setConfig(prev => ({
            ...prev,
            revenueBase: kpiConfig.calculationBase,
            kpiConfig
          }));
          setValidationErrors({});
          setSuccessMessage('KPI Configuration loaded successfully');
          setTimeout(() => setSuccessMessage(''), 3000);
        } catch (error) {
          setValidationErrors(prev => ({
            ...prev,
            kpiConfig: 'Failed to parse KPI configuration file'
          }));
        }
      };
      reader.readAsText(file);
    }
  };

  const handleAdditionalKpiConfigUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && config.kpiConfig) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const newKpiConfig = JSON.parse(e.target?.result as string);
          
          const mergedConfig: KpiConfig = {
            ...config.kpiConfig,
            baseData: [...(config.kpiConfig.baseData || []), ...(newKpiConfig.baseData || [])],
            qualificationFields: [...(config.kpiConfig.qualificationFields || []), ...(newKpiConfig.qualificationFields || [])],
            adjustmentFields: [...(config.kpiConfig.adjustmentFields || []), ...(newKpiConfig.adjustmentFields || [])],
            exclusionFields: [...(config.kpiConfig.exclusionFields || []), ...(newKpiConfig.exclusionFields || [])],
            creditFields: [...(config.kpiConfig.creditFields || []), ...(newKpiConfig.creditFields || [])]
          };

          setLoadedKpiConfig(mergedConfig);
          setConfig(prev => ({
            ...prev,
            kpiConfig: mergedConfig
          }));

          setSuccessMessage('Additional KPI fields merged successfully');
          setTimeout(() => setSuccessMessage(''), 3000);
        } catch (error) {
          setValidationErrors(prev => ({
            ...prev,
            kpiConfig: 'Failed to parse additional KPI configuration file'
          }));
        }
      };
      reader.readAsText(file);
    }
  };

  const handleSave = () => {
    if (mode === 'new' && !validateSchemeName(schemeName)) {
      return;
    }

    const timestamp = format(new Date(), 'ddMMyy_HHmm');
    let schemeToSave: CompensationScheme;

    if (mode === 'new') {
      const newSchemeId = `S_${schemeName.toUpperCase()}_${timestamp}`;
      schemeToSave = {
        ...config,
        SchemeID: newSchemeId,
        versionNumber: 1,
        status: 'DRAFT'
      };
    } else {
      const baseSchemeId = config.SchemeID?.split('_').slice(0, 2).join('_');
      schemeToSave = {
        ...config,
        SchemeID: `${baseSchemeId}_${timestamp}`,
        versionNumber: (config.versionNumber || 1) + 1,
        status: 'DRAFT'
      };
    }

    const filename = `${schemeToSave.SchemeID}.json`;
    const dataStr = JSON.stringify(schemeToSave, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setSuccessMessage('Scheme saved successfully');
    setTimeout(() => {
      setSuccessMessage('');
      setMode('initial');
      setConfig(DEFAULT_CONFIG);
      setSchemeName('');
      setHasChanges(false);
    }, 3000);
  };

  if (mode === 'initial') {
    return (
      <div className="max-w-5xl mx-auto py-12 px-4">
        <Card className="bg-gray-50 rounded-xl p-12 shadow-sm border border-gray-200">
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-black">
              <Calculator className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-semibold text-slate-800">Scheme Designer</h1>
            <p className="text-slate-600">Create or manage incentive schemes</p>
            
            <div className="max-w-sm mx-auto space-y-4 pt-6">
              <Button
                onClick={() => setMode('new')}
                className="w-full rounded-full bg-black text-white hover:opacity-90 transition py-6"
              >
                <Plus className="h-5 w-5 mr-2" />
                Create New Scheme
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full rounded-full border-2 hover:bg-gray-100 transition py-6"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileUp className="h-5 w-5 mr-2" />
                View Existing Scheme
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileLoad}
                className="hidden"
              />
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-12 px-4 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-semibold text-slate-800">
          {mode === 'new' ? 'Create New Scheme' : 'View Scheme'}
        </h1>
        <div className="flex space-x-3">
          {mode === 'view' && (
            <Button 
              onClick={() => setMode('edit')} 
              variant="outline"
              className="rounded-full hover:bg-gray-100 transition"
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Edit Scheme
            </Button>
          )}
          {(mode === 'edit' || mode === 'new') && hasChanges && (
            <Button 
              onClick={handleSave}
              className="rounded-full bg-black text-white hover:opacity-90 transition"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Scheme
            </Button>
          )}
        </div>
      </div>

      {successMessage && (
        <Card className="bg-green-50 border-green-200 p-4">
          <div className="flex items-center text-green-700">
            <Check className="h-5 w-5 mr-2" />
            {successMessage}
          </div>
        </Card>
      )}

      <Card className="bg-gray-50 rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {mode === 'new' ? (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Scheme Name (10 chars max)
              </label>
              <input
                type="text"
                value={schemeName}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^a-zA-Z0-9]/g, '');
                  setSchemeName(value.slice(0, 10));
                  validateSchemeName(value);
                }}
                className={`w-full rounded-md border ${
                  schemeNameError ? 'border-red-300' : 'border-gray-300'
                } shadow-inner px-3 py-2 focus:ring focus:outline-none`}
                placeholder="Enter scheme name"
              />
              {schemeNameError && (
                <p className="mt-1 text-sm text-red-600">{schemeNameError}</p>
              )}
            </div>
          ) : config.SchemeID && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Scheme ID
                </label>
                <div className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-gray-700">
                  {config.SchemeID}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Version / Status
                </label>
                <div className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-gray-700">
                  Version {config.versionNumber} • {config.status}
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">KPI Configuration</label>
            <div className="mt-1 space-y-2">
              {config.kpiConfig ? (
                <div className="p-4 bg-gray-100 rounded-lg">
                  <p className="text-sm text-slate-600">
                    Using KPI Configuration: {config.kpiConfig.name || 'Unnamed Configuration'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {config.kpiConfig.qualificationFields.length} qualification fields,{' '}
                    {config.kpiConfig.adjustmentFields.length} adjustment fields,{' '}
                    {config.kpiConfig.exclusionFields.length} exclusion fields,{' '}
                    {config.kpiConfig.creditFields?.length || 0} credit fields
                  </p>
                  {mode !== 'view' && (
                    <Button
                      onClick={() => additionalKpiConfigInputRef.current?.click()}
                      variant="outline"
                      size="sm"
                      className="mt-2 rounded-full hover:bg-gray-100 transition"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Additional KPI Fields
                    </Button>
                  )}
                </div>
              ) : (
                <Button
                  onClick={() => kpiConfigInputRef.current?.click()}
                  disabled={mode === 'view'}
                  variant="outline"
                  className={`w-full rounded-full hover:bg-gray-100 transition ${
                    validationErrors.kpiConfig ? 'border-red-300' : ''
                  }`}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload KPI Configuration
                </Button>
              )}
              <input
                ref={kpiConfigInputRef}
                type="file"
                accept=".json"
                onChange={handleKpiConfigUpload}
                className="hidden"
              />
              <input
                ref={additionalKpiConfigInputRef}
                type="file"
                accept=".json"
                onChange={handleAdditionalKpiConfigUpload}
                className="hidden"
              />
              {validationErrors.kpiConfig && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.kpiConfig}</p>
              )}
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              value={config.description}
              onChange={(e) => {
                setConfig({ ...config, description: e.target.value });
                setHasChanges(true);
              }}
              disabled={mode === 'view'}
              className="w-full rounded-md border border-gray-300 shadow-inner px-3 py-2 focus:ring focus:outline-none disabled:bg-gray-50"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Effective From</label>
            <input
              type="date"
              value={config.effectiveFrom}
              onChange={(e) => {
                setConfig({ ...config, effectiveFrom: e.target.value });
                setHasChanges(true);
              }}
              disabled={mode === 'view'}
              className="w-full rounded-md border border-gray-300 shadow-inner px-3 py-2 focus:ring focus:outline-none disabled:bg-gray-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Effective To</label>
            <input
              type="date"
              value={config.effectiveTo}
              onChange={(e) => {
                setConfig({ ...config, effectiveTo: e.target.value });
                setHasChanges(true);
              }}
              disabled={mode === 'view'}
              className="w-full rounded-md border border-gray-300 shadow-inner px-3 py-2 focus:ring focus:outline-none disabled:bg-gray-50"
            />
          </div>
        </div>
      </Card>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1">
        <Tabs 
          value={activeSection} 
          onValueChange={setActiveSection}
          className="w-full"
        >
          <TabsList className="w-full justify-start bg-gray-50 p-1 rounded-lg">
            <TabsTrigger value="base" className="rounded-md">Base Data</TabsTrigger>
            <TabsTrigger value="qualification" className="rounded-md">Qualification Criteria</TabsTrigger>
            <TabsTrigger value="adjustment" className="rounded-md">Adjustment Fields</TabsTrigger>
            <TabsTrigger value="exclusion" className="rounded-md">Exclusion Fields</TabsTrigger>
            <TabsTrigger value="payout" className="rounded-md">Payout Tiers</TabsTrigger>
            <TabsTrigger value="credit" className="rounded-md">Credit Rules</TabsTrigger>
          </TabsList>

          <div className="p-6">
            <TabsContent value="base">
              <Card className="bg-gray-50 rounded-xl p-6 shadow-sm border border-gray-200">
                <h3 className="text-xl font-semibold text-slate-800 mb-6">Base Data Configuration</h3>
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Source File Name</label>
                    <input
                      type="text"
                      value={config.baseMapping.sourceFile}
                      onChange={(e) => {
                        setConfig({
                          ...config,
                          baseMapping: { ...config.baseMapping, sourceFile: e.target.value }
                        });
                        setHasChanges(true);
                      }}
                      disabled={mode === 'view'}
                      placeholder="e.g., Input_Sales.csv"
                      className="w-full rounded-md border border-gray-300 shadow-inner px-3 py-2 focus:ring focus:outline-none disabled:bg-gray-50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Agent Field</label>
                    <input
                      type="text"
                      value={config.baseMapping.agentField}
                      onChange={(e) => {
                        setConfig({
                          ...config,
                          baseMapping: { ...config.baseMapping, agentField: e.target.value }
                        });
                        setHasChanges(true);
                      }}
                      disabled={mode === 'view'}
                      placeholder="e.g., Sales Employee"
                      className="w-full rounded-md border border-gray-300 shadow-inner px-3 py-2 focus:ring focus:outline-none disabled:bg-gray-50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Transaction ID Field</label>
                    <input
                      type="text"
                      value={config.baseMapping.txnID}
                      onChange={(e) => {
                        setConfig({
                          ...config,
                          baseMapping: { ...config.baseMapping, txnID: e.target.value }
                        });
                        setHasChanges(true);
                      }}
                      disabled={mode === 'view'}
                      placeholder="e.g., Sales Order Number"
                      className="w-full rounded-md border border-gray-300 shadow-inner px-3 py-2 focus:ring focus:outline-none disabled:bg-gray-50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Base Amount Field</label>
                    <input
                      type="text"
                      value={config.baseMapping.amountField}
                      onChange={(e) => {
                        setConfig({
                          ...config,
                          baseMapping: { ...config.baseMapping, amountField: e.target.value }
                        });
                        setHasChanges(true);
                      }}
                      disabled={mode === 'view'}
                      placeholder="e.g., Net Value"
                      className="w-full rounded-md border border-gray-300 shadow-inner px-3 py-2 focus:ring focus:outline-none disabled:bg-gray-50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Date Field</label>
                    <input
                      type="text"
                      value={config.baseMapping.transactionDateField}
                      onChange={(e) => {
                        setConfig({
                          ...config,
                          baseMapping: { ...config.baseMapping, transactionDateField: e.target.value }
                        });
                        setHasChanges(true);
                      }}
                      disabled={mode === 'view'}
                      placeholder="e.g., Transaction Date"
                      className="w-full rounded-md border border-gray-300 shadow-inner px-3 py-2 focus:ring focus:outline-none disabled:bg-gray-50"
                    />
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="qualification">
              <RuleBuilder
                rules={config.qualificationRules}
                onChange={(rules) => {
                  setConfig({ ...config, qualificationRules: rules });
                  setHasChanges(true);
                }}
                disabled={mode === 'view'}
                kpiFields={config.kpiConfig?.qualificationFields || []}
                sectionName="Qualification Rules"
              />
            </TabsContent>

            <TabsContent value="adjustment">
              <AdjustmentRuleBuilder
                rules={config.adjustmentRules}
                onChange={(rules) => {
                  setConfig({ ...config, adjustmentRules: rules });
                  setHasChanges(true);
                }}
                disabled={mode === 'view'}
                kpiFields={config.kpiConfig?.adjustmentFields || []}
                sectionName="Adjustment Rules"
              />
            </TabsContent>

            <TabsContent value="exclusion">
              <RuleBuilder
                rules={config.exclusionRules}
                onChange={(rules) => {
                  setConfig({ ...config, exclusionRules: rules });
                  setHasChanges(true);
                }}
                disabled={mode === 'view'}
                kpiFields={config.kpiConfig?.exclusionFields || []}
                sectionName="Exclusion Rules"
              />
            </TabsContent>

            <TabsContent value="payout">
              <PayoutTierBuilder
                tiers={config.payoutTiers}
                onChange={(tiers) => {
                  setConfig({ ...config, payoutTiers: tiers });
                  setHasChanges(true);
                }}
                disabled={mode === 'view'}
              />
            </TabsContent>

            <TabsContent value="credit">
              <CreditSplitTable
                splits={config.creditSplits}
                hierarchyFile={config.creditHierarchyFile}
                onSplitsChange={(splits) => {
                  setConfig({ ...config, creditSplits: splits });
                  setHasChanges(true);
                }}
                onHierarchyFileChange={(file) => {
                  setConfig({ ...config, creditHierarchyFile: file });
                  setHasChanges(true);
                }}
                disabled={mode === 'view'}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

export default SchemeDesigner;

export { SchemeDesigner }