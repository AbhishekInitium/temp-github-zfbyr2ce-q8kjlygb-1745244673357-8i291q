// Required library for precise decimal arithmetic
// Ensure you have installed it: npm install decimal.js
const Decimal = require('decimal.js');

// --- Helper Functions ---

/**
 * Parses a CSV string into an array of objects.
 * Assumes the first row is the header.
 * Handles simple cases, might need enhancement for complex CSVs (quotes, commas in fields).
 * @param {string} csvString The CSV content as a string.
 * @returns {object[]} Array of objects representing rows.
 */
function parseCSV(csvString) {
  if (!csvString) return [];
  const lines = csvString.trim().split('\n');
  if (lines.length < 2) return []; // Need header + at least one data row

  const headers = lines[0].split(',').map((h) => h.trim());
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    // Basic check for mismatched columns, although split might handle trailing commas differently
    if (values.length < headers.length) {
      console.warn(
        `Skipping row ${i + 1} due to mismatched columns: expected ${
          headers.length
        }, got ${values.length}`
      );
      continue;
    }
    const rowObject = {};
    headers.forEach((header, index) => {
      rowObject[header] = values[index] !== undefined ? values[index] : ''; // Handle potentially missing trailing values
    });
    data.push(rowObject);
  }
  return data;
}

/**
 * Parses a date string into a Date object. Supports YYYY-MM-DD.
 * @param {string} dateString The date string.
 * @returns {Date | null} The Date object or null if invalid.
 */
function parseDate(dateString) {
  if (!dateString) return null;
  // Basic check for YYYY-MM-DD format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    console.warn(
      `Invalid date format encountered: ${dateString}. Expected YYYY-MM-DD.`
    );
    // Attempt parsing anyway, Date constructor is lenient
  }
  const date = new Date(dateString);
  // Check if the resulting date is valid
  if (isNaN(date.getTime())) {
    console.warn(`Could not parse date string: ${dateString}`);
    return null;
  }
  // Set time to UTC midnight for consistent comparisons
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

/**
 * Evaluates if a record field matches a rule condition.
 * @param {*} recordValue The value from the record.
 * @param {string} operator The comparison operator (e.g., '=', '>=', 'CONTAINS').
 * @param {string | number} ruleValue The value from the rule definition.
 * @param {string} dataType Data type hint ('String', 'Number', 'Date').
 * @returns {boolean} True if the rule matches, false otherwise.
 */
function evaluateRule(recordValue, operator, ruleValue, dataType = 'String') {
  let rv = recordValue;
  let v = ruleValue;

  if (dataType === 'Number') {
    // Use Decimal for number comparisons to handle potential precision issues
    try {
      rv = new Decimal(recordValue);
      v = new Decimal(ruleValue);
    } catch (e) {
      console.warn(
        `Could not parse value as Decimal for comparison: record='${recordValue}', rule='${ruleValue}'`
      );
      return false; // Cannot compare if parsing fails
    }
  } else if (dataType === 'Date') {
    // Dates should already be parsed Date objects
    if (!(rv instanceof Date) || !(v instanceof Date)) {
      console.warn(
        `Date comparison expects Date objects, got: record='${typeof rv}', rule='${typeof v}'`
      );
      return false;
    }
  } else {
    // String or other types
    rv = String(recordValue); // Ensure string comparison
    v = String(ruleValue);
  }

  switch (operator) {
    case '=':
      return dataType === 'Number' ? rv.equals(v) : rv === v;
    case '>=':
      return dataType === 'Number' ? rv.gte(v) : rv >= v;
    case '<=':
      return dataType === 'Number' ? rv.lte(v) : rv <= v;
    case '>':
      return dataType === 'Number' ? rv.gt(v) : rv > v;
    case '<':
      return dataType === 'Number' ? rv.lt(v) : rv < v;
    case 'CONTAINS':
      return String(rv).includes(String(v)); // Always string contains
    case '!=':
      return dataType === 'Number' ? !rv.equals(v) : rv !== v;
    // Add other operators as needed
    default:
      console.warn(`Unsupported operator: ${operator}`);
      return false;
  }
}

/**
 * Finds the manager for a given agent ID from the hierarchy data, valid on a specific date.
 * @param {object[]} hierarchyData Parsed MH_DEC24.csv data.
 * @param {string} agentId The ID of the agent whose manager is needed.
 * @param {Date} transactionDate The date for which the hierarchy must be valid.
 * @returns {{ managerId: string, validFrom: string, validTo: string } | null} Manager details or null if not found/valid.
 */
function findManager(hierarchyData, agentId, transactionDate) {
  if (!hierarchyData || !agentId || !(transactionDate instanceof Date)) {
    return null;
  }
  // Normalize transactionDate to UTC midnight for comparison
  const targetDate = new Date(
    Date.UTC(
      transactionDate.getUTCFullYear(),
      transactionDate.getUTCMonth(),
      transactionDate.getUTCDate()
    )
  );

  for (const record of hierarchyData) {
    if (record['Sales Employee'] === agentId) {
      const fromDate = parseDate(record['Reports From']);
      const toDate = parseDate(record['Reports To']); // Handle potentially missing 'Reports To'

      // Check date validity: fromDate <= transactionDate <= toDate
      // If toDate is null/invalid, assume it's valid indefinitely from fromDate.
      const isAfterFrom = fromDate
        ? fromDate.getTime() <= targetDate.getTime()
        : false;
      const isBeforeTo = toDate
        ? targetDate.getTime() <= toDate.getTime()
        : true; // If no 'to' date, assume it's valid

      if (isAfterFrom && isBeforeTo) {
        return {
          managerId: record['Reports To Person'], // Assuming this field holds the manager's ID
          validFrom: record['Reports From'],
          validTo: record['Reports To'] || 'Indefinite',
        };
      }
    }
  }
  return null; // No valid manager found for this agent and date
}

/**
 * Calculates the payout based on marginal tiers.
 * @param {Decimal} amount The total amount to apply tiers to.
 * @param {object[]} tiers The payoutTiers array from the scheme.
 * @returns {Decimal} The calculated tiered payout.
 */
function calculateTieredPayout(amount, tiers) {
  let totalPayout = new Decimal(0);
  let remainingAmount = amount;
  // Sort tiers by 'from' value just in case they aren't ordered
  const sortedTiers = [...tiers].sort((a, b) => a.from - b.from);

  for (const tier of sortedTiers) {
    const tierFrom = new Decimal(tier.from);
    // Tier 'to' can be null/undefined for the last tier, treat as infinity
    const tierTo = tier.to != null ? new Decimal(tier.to) : Decimal.Infinity;
    const tierRate = new Decimal(tier.rate);
    const isPercentage = tier.isPercentage;

    // Calculate the upper bound of this tier relative to the amount processed so far
    // The amount applicable in this tier is between tier.from and tier.to
    const tierRangeStart = tierFrom;
    const tierRangeEnd = tierTo;

    // Calculate the base amount that falls *within* this tier's range [from, to]
    // Amount already covered by previous tiers = tierFrom
    const amountInTier = Decimal.max(
      0,
      Decimal.min(amount, tierRangeEnd).minus(tierRangeStart)
    );

    if (amountInTier.isZero() && amount.gt(tierRangeEnd)) {
      // If the total amount exceeds this tier entirely, continue to next tier
      continue;
    }
    if (amountInTier.isZero() && amount.lte(tierRangeStart)) {
      // If the total amount hasn't reached this tier yet, break (assuming sorted tiers)
      break;
    }

    let payoutForTier;
    if (isPercentage) {
      // Payout is rate% of the amount *within* this tier's slice
      payoutForTier = amountInTier.times(tierRate).div(100);
    } else {
      // Payout is a fixed rate for the amount in this tier (less common for marginal)
      // Assuming fixed rate applies *per unit* in the tier, requires unit definition.
      // More likely: fixed amount *if* attainment falls in this tier (non-marginal).
      // Sticking to marginal: If rate is fixed, it usually means per unit of *something*.
      // Let's assume if isPercentage is false, it's a fixed amount *added* if this tier is reached.
      // This interpretation is ambiguous. *Assuming percentage is the standard case.*
      // If fixed rate is needed with marginal tiers, clarify logic (e.g., per $1000 in tier?).
      // Safest: treat fixed rate as % for now if isPercentage logic is primary.
      // Re-interpreting based on structure: Rate is likely always a multiplier.
      console.warn(
        `Tier ${tier.id}: Fixed rate marginal tiers need clearer definition. Assuming rate is applied like percentage.`
      );
      payoutForTier = amountInTier.times(tierRate); // Or potentially just `tierRate` if it's a flat bonus for reaching the tier
    }

    totalPayout = totalPayout.add(payoutForTier);

    // If the total amount is within this tier, we are done.
    if (amount.lte(tierRangeEnd)) {
      break;
    }
  }

  return totalPayout;
}

// --- Main Scheme Execution Function ---

/**
 * Executes the incentive scheme calculation.
 * @param {object} scheme The scheme JSON object.
 * @param {object} uploadedFiles An object mapping filenames (e.g., "SCH1.csv") to their string content.
 * @param {string} runAsOfDateString The date (YYYY-MM-DD) up to which transactions are considered.
 * @returns {object} Results including payouts, logs, and credit distributions.
 */
function runScheme(scheme, uploadedFiles, runAsOfDateString) {
  // --- Initialization ---
  const runAsOfDate = parseDate(runAsOfDateString);
  if (!runAsOfDate) {
    throw new Error(`Invalid runAsOfDate: ${runAsOfDateString}`);
  }
  const effectiveFromDate = parseDate(scheme.effectiveFrom);
  // Use UTC midnight for date comparisons
  runAsOfDate.setUTCHours(0, 0, 0, 0);
  if (effectiveFromDate) effectiveFromDate.setUTCHours(0, 0, 0, 0);

  const agentPayouts = {};
  const ruleHitLogs = {}; // Agent-specific qualification/final payout logs
  const creditDistributions = {}; // Agent-specific credit split logs
  const rawRecordLevelData = []; // All record-level processing logs (exclusions, adjustments)

  // Central logging function
  const logEvent = (logArray, eventData) => {
    logArray.push({
      timestamp: new Date().toISOString(),
      ...eventData,
    });
  };

  // Load and parse data files
  const baseDataFile = scheme.baseMapping?.sourceFile;
  const hierarchyFile = scheme.creditHierarchyFile;

  if (!baseDataFile || !uploadedFiles[baseDataFile]) {
    throw new Error(
      `Base data file "${baseDataFile}" not found in uploadedFiles.`
    );
  }
  if (hierarchyFile && !uploadedFiles[hierarchyFile]) {
    console.warn(
      `Credit hierarchy file "${hierarchyFile}" specified but not found in uploadedFiles. Credit splits may fail.`
    );
  }

  let baseData = [];
  try {
    baseData = parseCSV(uploadedFiles[baseDataFile]);
  } catch (e) {
    throw new Error(
      `Failed to parse base data file "${baseDataFile}": ${e.message}`
    );
  }

  let hierarchyData = [];
  if (hierarchyFile && uploadedFiles[hierarchyFile]) {
    try {
      hierarchyData = parseCSV(uploadedFiles[hierarchyFile]);
    } catch (e) {
      console.warn(
        `Failed to parse hierarchy file "${hierarchyFile}": ${e.message}. Proceeding without hierarchy.`
      );
      hierarchyData = []; // Continue without hierarchy if parsing fails
    }
  }

  // --- 1. Base Data Selection ---
  const filteredRecords = baseData.filter((record) => {
    const txDateStr = record[scheme.baseMapping.transactionDateField];
    const txDate = parseDate(txDateStr);
    if (!txDate) {
      logEvent(rawRecordLevelData, {
        level: 'Warning',
        recordId: record.id || JSON.stringify(record).substring(0, 50), // Need a unique ID if available
        message: `Skipping record due to unparseable date: ${txDateStr}`,
        agentId: record[scheme.baseMapping.agentField] || 'Unknown',
      });
      return false;
    }
    txDate.setUTCHours(0, 0, 0, 0); // Compare dates only

    const isAfterFrom = effectiveFromDate
      ? txDate.getTime() >= effectiveFromDate.getTime()
      : true;
    const isBeforeRunDate = txDate.getTime() <= runAsOfDate.getTime();

    return isAfterFrom && isBeforeRunDate;
  });

  // --- 2. Group by Agent ---
  const agentData = {}; // { agentId: { records: [], logs: [], totalBaseAmount: Decimal, totalAdjustedAmount: Decimal, qualified: boolean, payout: Decimal } }

  for (const record of filteredRecords) {
    const agentId = record[scheme.baseMapping.agentField];
    if (!agentId) {
      logEvent(rawRecordLevelData, {
        level: 'Warning',
        recordId: record.id || 'N/A',
        message: `Record missing agent ID in field "${scheme.baseMapping.agentField}"`,
      });
      continue;
    }
    if (!agentData[agentId]) {
      agentData[agentId] = {
        records: [],
        logs: [], // Agent-level logs
        totalBaseAmount: new Decimal(0),
        totalAdjustedAmount: new Decimal(0),
        qualified: true, // Assume qualified initially
        payout: new Decimal(0),
      };
    }
    // Add unique ID to record for logging if not present
    if (!record.recordInternalId) {
      record.recordInternalId = `rec_${Math.random()
        .toString(36)
        .substring(2, 15)}`;
    }
    agentData[agentId].records.push({ ...record }); // Store a copy
  }

  // --- 3. Record-Level Rule Application (Per Agent) ---
  // And --- 4. Agent-Level Qualification --- (Done together per agent)
  // And --- 5. Payout Tier Calculation --- (Done after qualification)
  // And --- 6. Credit Split --- (Done after payout calculation)

  for (const agentId in agentData) {
    const agentInfo = agentData[agentId];
    let processedRecords = []; // Records passing exclusions for this agent

    // 3.A/B/C: Process each record for exclusions and adjustments
    for (const record of agentInfo.records) {
      let isExcluded = false;
      let currentAmount = new Decimal(0);
      let rateMultiplier = new Decimal(1); // For rate adjustments

      // Validate and get initial amount
      const baseAmountField = scheme.baseMapping.amountField;
      const baseAmountValue = record[baseAmountField];
      try {
        currentAmount = new Decimal(baseAmountValue || 0);
      } catch (e) {
        logEvent(rawRecordLevelData, {
          ruleType: 'DataError',
          recordId: record.recordInternalId,
          agentId: agentId,
          matched: true,
          reason: `Invalid amount value: ${baseAmountValue}`,
        });
        isExcluded = true; // Exclude records with invalid amounts
      }
      if (!isExcluded) {
        agentInfo.totalBaseAmount =
          agentInfo.totalBaseAmount.add(currentAmount);
      }

      // 3.A Exclusion Rules
      if (!isExcluded) {
        // Don't check exclusions if already excluded by data error
        for (const rule of scheme.exclusionRules) {
          const fieldDef = scheme.kpiConfig.exclusionFields.find(
            (f) => f.name === rule.field
          );
          if (!fieldDef) {
            console.warn(
              `Exclusion rule ${rule.id} references unknown field: ${rule.field}`
            );
            continue;
          }
          const recordValue = record[fieldDef.sourceField];
          if (
            evaluateRule(
              recordValue,
              rule.operator,
              rule.value,
              fieldDef.dataType
            )
          ) {
            logEvent(rawRecordLevelData, {
              ruleType: 'Exclusion',
              ruleId: rule.id,
              recordId: record.recordInternalId,
              agentId: agentId,
              matched: true,
              reason: `${rule.field} (${recordValue}) ${rule.operator} ${rule.value}`,
            });
            isExcluded = true;
            break; // Stop checking exclusion rules for this record
          }
        }
      }

      if (isExcluded) {
        continue; // Skip adjustments and processing for excluded records
      }

      // 3.B Adjustment Rules
      for (const rule of scheme.adjustmentRules) {
        const fieldDef = scheme.kpiConfig.adjustmentFields.find(
          (f) => f.name === rule.condition.field
        );
        if (!fieldDef) {
          console.warn(
            `Adjustment rule ${rule.id} references unknown condition field: ${rule.condition.field}`
          );
          continue;
        }
        const recordValue = record[fieldDef.sourceField];

        if (
          evaluateRule(
            recordValue,
            rule.condition.operator,
            rule.condition.value,
            fieldDef.dataType
          )
        ) {
          const adj = rule.adjustment;
          let adjustmentEffectDescription = '';

          if (adj.target === 'Amount') {
            // Direct amount adjustment
            const adjValue = new Decimal(adj.value);
            if (adj.type === 'percentage') {
              const change = currentAmount.times(adjValue).div(100);
              currentAmount = currentAmount.add(change); // Assuming percentage adds/subtracts from base
              adjustmentEffectDescription = `Amount adjusted by ${adjValue}% to ${currentAmount.toFixed(
                2
              )}`;
            } else if (adj.type === 'fixed') {
              currentAmount = currentAmount.add(adjValue); // Assuming fixed value adds/subtracts
              adjustmentEffectDescription = `Amount adjusted by fixed ${adjValue} to ${currentAmount.toFixed(
                2
              )}`;
            }
          } else if (adj.target === 'Rate') {
            // Adjusts a multiplier
            const adjValue = new Decimal(adj.value);
            if (adj.type === 'percentage') {
              // A 200% rate adjustment likely means rate *becomes* 200%, i.e., multiplier = 2.00
              rateMultiplier = rateMultiplier.times(adjValue.div(100));
              adjustmentEffectDescription = `Rate multiplier adjusted by ${adjValue}% resulting in new multiplier ${rateMultiplier.toFixed(
                2
              )}`;
            } else if (adj.type === 'fixed') {
              // Ambiguous: Add fixed value to rate? Or set rate to fixed value? Assume multiplication factor.
              rateMultiplier = rateMultiplier.times(adjValue); // Treat fixed value as a direct multiplier factor
              adjustmentEffectDescription = `Rate multiplier adjusted by factor ${adjValue} resulting in new multiplier ${rateMultiplier.toFixed(
                2
              )}`;
            }
          } else {
            console.warn(
              `Adjustment rule ${rule.id} has unknown target: ${adj.target}`
            );
          }

          logEvent(rawRecordLevelData, {
            ruleType: 'Adjustment',
            ruleId: rule.id,
            recordId: record.recordInternalId,
            agentId: agentId,
            matched: true,
            condition: `${rule.condition.field} (${recordValue}) ${rule.condition.operator} ${rule.condition.value}`,
            effect: adjustmentEffectDescription,
          });
        }
      }

      // 3.C Custom Rules Hook (Placeholder)
      if (scheme.customRules && scheme.customRules.length > 0) {
        // applyCustomRules(record, scheme.customRules); // Call custom logic if defined
        logEvent(rawRecordLevelData, {
          ruleType: 'Custom',
          recordId: record.recordInternalId,
          agentId: agentId,
          message: 'Custom rule hook executed (implement logic if needed).',
        });
      }

      // Calculate final adjusted amount for this record
      const finalRecordAmount = currentAmount.times(rateMultiplier);
      record.adjustedAmount = finalRecordAmount; // Store it on the record object temporarily

      // Add to agent's total adjusted amount and add record to processed list
      agentInfo.totalAdjustedAmount =
        agentInfo.totalAdjustedAmount.add(finalRecordAmount);
      processedRecords.push(record);
    } // End of record loop for agent

    // Update agent's records to only include processed ones
    agentInfo.records = processedRecords;

    // --- 4. Agent-Level Qualification ---
    for (const rule of scheme.qualificationRules) {
      const fieldDef = scheme.kpiConfig.qualificationFields.find(
        (f) => f.name === rule.field
      );
      if (!fieldDef) {
        console.warn(
          `Qualification rule ${rule.id} references unknown field: ${rule.field}`
        );
        continue;
      }

      let valueToEvaluate;
      let evaluationDescription = '';

      if (fieldDef.evaluationLevel === 'Agent') {
        // Requires aggregation across the agent's *processed* records
        if (fieldDef.aggregation === 'Sum') {
          valueToEvaluate = agentInfo.records.reduce((sum, rec) => {
            try {
              // Use the adjusted amount if the base field is the amount field, else use original value
              const val =
                fieldDef.sourceField === scheme.baseMapping.amountField &&
                rec.adjustedAmount !== undefined
                  ? rec.adjustedAmount
                  : new Decimal(rec[fieldDef.sourceField] || 0);
              return sum.add(val);
            } catch (e) {
              logEvent(agentInfo.logs, {
                level: 'Warning',
                ruleId: rule.id,
                message: `Could not sum value ${
                  rec[fieldDef.sourceField]
                } for record ${rec.recordInternalId}`,
              });
              return sum;
            }
          }, new Decimal(0));
          evaluationDescription = `Sum of ${
            fieldDef.sourceField
          } = ${valueToEvaluate.toFixed(2)}`;
        } else if (fieldDef.aggregation === 'Count') {
          valueToEvaluate = new Decimal(agentInfo.records.length);
          evaluationDescription = `Count of records = ${valueToEvaluate}`;
        }
        // Add other aggregations (Avg, Min, Max) if needed
        else {
          console.warn(
            `Unsupported agent-level aggregation: ${fieldDef.aggregation}`
          );
          logEvent(agentInfo.logs, {
            level: 'Error',
            ruleId: rule.id,
            message: `Unsupported aggregation ${fieldDef.aggregation}`,
          });
          continue; // Skip rule if aggregation not supported
        }
      } else {
        // Per Record - Does *any* record satisfy the condition? Or *all*? Assume ANY for now.
        console.warn(
          `Qualification rule ${rule.id} has evaluationLevel 'Per Record'. This usually applies per transaction, not at agent level. Check scheme logic.`
        );
        // For now, let's evaluate against the total (doesn't make sense but avoids error)
        // A per-record qualification rule at agent level usually means the agent must have at least one record matching.
        // Let's implement the "at least one record" logic:
        let foundMatch = false;
        for (const rec of agentInfo.records) {
          if (
            evaluateRule(
              rec[fieldDef.sourceField],
              rule.operator,
              rule.value,
              fieldDef.dataType
            )
          ) {
            foundMatch = true;
            break;
          }
        }
        valueToEvaluate = foundMatch; // Boolean result for per-record check
        rule.value = true; // We are checking if the result is true
        rule.operator = '='; // Comparison is now fixed
        fieldDef.dataType = 'Boolean'; // Treat as boolean comparison
        evaluationDescription = `At least one record matched ${rule.field} ${rule.operator} ${rule.value}`;
      }

      // Evaluate the rule
      const ruleMet = evaluateRule(
        valueToEvaluate,
        rule.operator,
        rule.value,
        fieldDef.dataType
      );

      logEvent(agentInfo.logs, {
        ruleType: 'Qualification',
        ruleId: rule.id,
        agentId: agentId,
        matched: ruleMet,
        condition: `${rule.field} ${rule.operator} ${rule.value}`,
        evaluation: evaluationDescription,
        evaluatedValue: valueToEvaluate.toString(), // Log the value used for evaluation
      });

      if (!ruleMet) {
        agentInfo.qualified = false;
        logEvent(agentInfo.logs, {
          ruleType: 'Qualification',
          agentId: agentId,
          matched: false,
          reason: `Agent disqualified by rule ${rule.id}.`,
        });
        break; // Stop checking qualification rules if one fails
      }
    } // End of qualification rules loop

    // --- 5. Payout Tier Calculation ---
    if (agentInfo.qualified) {
      // Check against quota if applicable (Interpretation: Quota might be a gate)
      const quota = scheme.quotaAmount
        ? new Decimal(scheme.quotaAmount)
        : new Decimal(0);
      let amountForTierCalc = agentInfo.totalAdjustedAmount;
      let meetsQuota = true;

      if (quota.gt(0)) {
        // Option 1: Quota is a gate. Must meet quota to get any payout.
        if (agentInfo.totalAdjustedAmount.lt(quota)) {
          meetsQuota = false;
          logEvent(agentInfo.logs, {
            ruleType: 'Quota',
            agentId: agentId,
            matched: false,
            reason: `Total adjusted amount ${amountForTierCalc.toFixed(
              2
            )} is less than quota ${quota.toFixed(2)}. No payout.`,
          });
          agentInfo.payout = new Decimal(0);
        } else {
          logEvent(agentInfo.logs, {
            ruleType: 'Quota',
            agentId: agentId,
            matched: true,
            reason: `Total adjusted amount ${amountForTierCalc.toFixed(
              2
            )} meets quota ${quota.toFixed(2)}.`,
          });
          // Option 2: Payout calculated only on amount *above* quota.
          // amountForTierCalc = agentInfo.totalAdjustedAmount.minus(quota);
          // If Option 2, uncomment the line above. Sticking with Option 1 (gate) or payout on full amount if quota met.
          // Based on typical schemes, payout often applies to the full amount once quota is met. Let's use that.
        }
      }

      if (meetsQuota) {
        agentInfo.payout = calculateTieredPayout(
          amountForTierCalc,
          scheme.payoutTiers
        );
        logEvent(agentInfo.logs, {
          ruleType: 'PayoutCalculation',
          agentId: agentId,
          baseAmount: amountForTierCalc.toFixed(2),
          payoutAmount: agentInfo.payout.toFixed(2),
          tiersUsed: scheme.payoutTiers
            .map(
              (t) =>
                `[${t.from}-${t.to || 'inf'}]@${t.rate}${
                  t.isPercentage ? '%' : ''
                }`
            )
            .join(', '),
        });
      }
    } else {
      agentInfo.payout = new Decimal(0); // Ensure payout is zero if not qualified
    }

    // Store final payout amount as string
    agentPayouts[agentId] = agentInfo.payout.toFixed(2); // Use toFixed for consistent formatting

    // --- 6. Recursive Credit Split via Mother Hierarchy ---
    if (
      agentInfo.qualified &&
      agentInfo.payout.gt(0) &&
      hierarchyData.length > 0 &&
      scheme.creditSplits.length > 0
    ) {
      if (!creditDistributions[agentId]) creditDistributions[agentId] = [];

      const basePayoutForSplit = agentInfo.payout;

      // Sort splits potentially by level (L1, L2, ...) if needed, assuming order in JSON is fine.
      let currentAgentForLookup = agentId;
      let level = 1; // Start hierarchy lookup from Level 1 (direct manager = L2 split typically)

      for (const splitRule of scheme.creditSplits) {
        const role = splitRule.role; // e.g., "L1", "L2"
        const percentage = new Decimal(splitRule.percentage);
        let targetAgentId = null;
        let managerDetails = null;
        let resolvedUsing = 'Direct Assignment'; // Default for L1 or if no hierarchy needed/found

        if (role === 'L1') {
          // L1 is usually the transaction owner
          targetAgentId = agentId;
        } else {
          // For L2, L3, etc., we need to traverse the hierarchy
          // Find the manager for the *current* agent in the chain
          // We need to determine which level (L2, L3) corresponds to the Nth manager lookup
          const targetLevel = parseInt(role.substring(1)); // Get level number from role "L2" -> 2
          if (!isNaN(targetLevel) && targetLevel > level) {
            // We need to find managers iteratively up to the target level
            for (let i = level; i < targetLevel; i++) {
              managerDetails = findManager(
                hierarchyData,
                currentAgentForLookup,
                runAsOfDate
              ); // Use run date for validity
              if (managerDetails) {
                currentAgentForLookup = managerDetails.managerId; // Move up the chain
                level++; // Track which level we've reached
              } else {
                // Cannot find manager at this step, stop traversing for this role
                logEvent(creditDistributions[agentId], {
                  level: 'Warning',
                  fromAgent: agentId,
                  targetRole: role,
                  lookupAgent: currentAgentForLookup,
                  message: `Could not find manager in hierarchy for level ${level} lookup. Skipping role ${role}.`,
                  resolvedUsing: scheme.creditHierarchyFile,
                });
                currentAgentForLookup = null; // Mark as failed
                break;
              }
            }
            // If we successfully traversed to the target level
            if (currentAgentForLookup && level === targetLevel) {
              targetAgentId = currentAgentForLookup;
              resolvedUsing = scheme.creditHierarchyFile;
            }
          } else if (!isNaN(targetLevel) && targetLevel === level) {
            // This case should not happen if L1 is handled and we increment level correctly
            // It implies trying to find the manager for L1 which is the agent themselves.
            console.warn(
              `Credit split logic warning: Role ${role} corresponds to current level ${level}. Assigning to current lookup agent ${currentAgentForLookup}.`
            );
            targetAgentId = currentAgentForLookup;
          }
          // If role isn't L1 and isn't Lx or parsing failed, skip.
          else if (isNaN(targetLevel)) {
            console.warn(`Cannot parse level from credit split role: ${role}`);
          }
        }

        // If we found a target agent for this role
        if (targetAgentId) {
          const creditAmount = basePayoutForSplit.times(percentage).div(100);
          if (creditAmount.gt(0)) {
            // Log only if there's an amount
            logEvent(creditDistributions[agentId], {
              fromAgent: agentId, // The original agent who earned the commission
              toAgent: targetAgentId,
              level: role, // Use the role name as level identifier
              percentage: splitRule.percentage,
              amount: creditAmount.toFixed(2),
              resolvedUsing: resolvedUsing,
              validDuring: managerDetails
                ? `${managerDetails.validFrom} to ${managerDetails.validTo}`
                : 'N/A', // Include validity period if hierarchy was used
            });
          }
        } else {
          // Log skip if targetAgentId remained null for roles other than L1 (where failure is expected if hierarchy missing)
          if (role !== 'L1') {
            logEvent(creditDistributions[agentId], {
              level: 'Info',
              fromAgent: agentId,
              targetRole: role,
              message: `Skipping credit split for role ${role} as target agent could not be determined via hierarchy.`,
              resolvedUsing: scheme.creditHierarchyFile,
            });
          }
        }

        // IMPORTANT: Reset lookup for the *next* role defined in creditSplits.
        // Each role (L2, L3) starts its lookup from the original agent (or manager found for L2, etc.)
        // The current implementation implicitly resets because `currentAgentForLookup` is scoped within the loop run for L2+.
        // If L2 finds ManagerA, and L3 needs ManagerA's manager, the loop structure handles it.
      } // End of credit splits loop
    } // End of credit split condition

    // Move agent-specific logs to the final structure
    if (agentInfo.logs.length > 0) {
      ruleHitLogs[agentId] = agentInfo.logs;
    }
  } // End of agent loop

  // --- Return Results ---
  return {
    agentPayouts,
    ruleHitLogs,
    creditDistributions,
    rawRecordLevelData,
  };
}

// --- Example Usage (for testing purposes) ---
/*
// Assume scheme JSON is loaded into a variable `schemeData`
// Assume file contents are loaded into `files` object:
// const files = {
//   "SCH1.csv": "Sales Employee,Net Value,Document Date,Sales Organization,Delivery Status,Payer\n50000001,15000,2024-12-05,1810,Fully Delivered,17100001\n...",
//   "MH_DEC24.csv": "Sales Employee,Reports To Person,Reports From,Reports To\n50000001,50000012,2024-01-01,2024-12-31\n..."
// };
// const runDate = "2024-12-31";

try {
    // const results = runScheme(schemeData, files, runDate);
    // console.log("Scheme Execution Results:");
    // console.log("Agent Payouts:", results.agentPayouts);
    // console.log("Rule Hit Logs:", JSON.stringify(results.ruleHitLogs, null, 2));
    // console.log("Credit Distributions:", JSON.stringify(results.creditDistributions, null, 2));
    // console.log("Record Level Logs:", JSON.stringify(results.rawRecordLevelData, null, 2));
} catch (error) {
    console.error("Error running scheme:", error);
}
*/

// Export the function if using in a Node.js module environment
// module.exports = { runScheme };
