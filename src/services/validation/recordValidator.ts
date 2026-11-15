import type {
  DataOrigin,
  HealthRecord,
  HealthRecordInput,
  ValidationIssue,
  ValidationResult,
} from '@/types';
import { getAllowedUnits, getAmbiguousUnitNote } from './unitRegistry';

const VALID_DATA_ORIGINS: ReadonlySet<DataOrigin> = new Set([
  'SPACEFLIGHT',
  'GROUND_ANALOG',
  'SYNTHETIC',
]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidIsoTimestamp(value: unknown): value is string {
  if (!isNonEmptyString(value)) {
    return false;
  }
  // Require at least YYYY-MM-DD format so arbitrary words don't parse loosely.
  if (!/^\d{4}-\d{2}-\d{2}/.test(value.trim())) {
    return false;
  }
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed);
}

function isFiniteNumberOrNull(value: unknown): value is number | null {
  if (value === null) {
    return true;
  }
  return typeof value === 'number' && Number.isFinite(value);
}

function addIssue(
  list: ValidationIssue[],
  field: string,
  code: string,
  message: string,
): void {
  list.push({ field, code, message });
}

/**
 * Validates a health record input for technical correctness, data types,
 * provenance, unit compatibility, and category-specific structure.
 *
 * Does not perform clinical interpretation or apply medical reference ranges.
 */
export function validateHealthRecordInput(
  input: HealthRecordInput,
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (!isNonEmptyString(input.astronaut_id)) {
    addIssue(
      errors,
      'astronaut_id',
      'REQUIRED_FIELD',
      'astronaut_id must be a non-empty string.',
    );
  }

  if (!isValidIsoTimestamp(input.timestamp)) {
    addIssue(
      errors,
      'timestamp',
      'INVALID_TIMESTAMP',
      'timestamp must be a valid ISO 8601 date or date-time string.',
    );
  }

  if (!isNonEmptyString(input.indicator)) {
    addIssue(
      errors,
      'indicator',
      'REQUIRED_FIELD',
      'indicator must be a non-empty string.',
    );
  }

  if (input.value === undefined) {
    addIssue(
      errors,
      'value',
      'MISSING_VALUE_FIELD',
      'value must be a finite number or explicit null (never undefined).',
    );
  } else if (!isFiniteNumberOrNull(input.value)) {
    addIssue(
      errors,
      'value',
      'INVALID_NUMERIC_VALUE',
      'value must be a finite number or null.',
    );
  }

  if (!isNonEmptyString(input.unit)) {
    addIssue(
      errors,
      'unit',
      'REQUIRED_FIELD',
      'unit must be an explicit non-empty measurement unit.',
    );
  } else if (isNonEmptyString(input.indicator)) {
    const allowedUnits = getAllowedUnits(input.category, input.indicator);
    const ambiguousNote = getAmbiguousUnitNote(
      input.category,
      input.indicator,
      input.unit,
    );
    if (ambiguousNote) {
      addIssue(errors, 'unit', 'AMBIGUOUS_SOURCE_UNIT', ambiguousNote);
    } else if (allowedUnits && !allowedUnits.includes(input.unit.trim())) {
      addIssue(
        errors,
        'unit',
        'INCOMPATIBLE_UNIT',
        `Unit "${input.unit}" is not compatible with indicator "${input.indicator}" in category "${input.category}". Expected one of: ${allowedUnits.join(', ')}.`,
      );
    } else if (!allowedUnits) {
      addIssue(
        warnings,
        'indicator',
        'UNREGISTERED_INDICATOR',
        `Indicator "${input.indicator}" is not in the built-in unit registry; unit "${input.unit}" was accepted as provided.`,
      );
    }
  }

  if (!VALID_DATA_ORIGINS.has(input.data_origin)) {
    addIssue(
      errors,
      'data_origin',
      'INVALID_DATA_ORIGIN',
      'data_origin must be SPACEFLIGHT, GROUND_ANALOG, or SYNTHETIC.',
    );
  }

  if (input.source_dataset !== undefined && !isNonEmptyString(input.source_dataset)) {
    addIssue(
      errors,
      'source_dataset',
      'INVALID_SOURCE_DATASET',
      'source_dataset must be a non-empty string when provided.',
    );
  }

  if (input.value === null && input.quality_status === 'verified') {
    addIssue(
      warnings,
      'quality_status',
      'MISSING_VALUE_MARKED_VERIFIED',
      'Record has value=null while quality_status is "verified"; consider "missing_value" or "incomplete".',
    );
  }

  if (input.category === 'blood') {
    validateBloodFields(input, errors);
  } else if (input.category === 'sleep') {
    validateSleepFields(input, errors);
  } else if (input.category === 'cardiovascular') {
    validateCardiovascularFields(input, errors);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function validateBloodFields(
  input: Extract<HealthRecordInput, { category: 'blood' }>,
  errors: ValidationIssue[],
): void {
  if (input.sample_id !== undefined && !isNonEmptyString(input.sample_id)) {
    addIssue(errors, 'sample_id', 'INVALID_STRING', 'sample_id cannot be empty if provided.');
  }
  if (input.specimen_type !== undefined && !isNonEmptyString(input.specimen_type)) {
    addIssue(
      errors,
      'specimen_type',
      'INVALID_STRING',
      'specimen_type cannot be empty if provided.',
    );
  }
  if (input.assay !== undefined && !isNonEmptyString(input.assay)) {
    addIssue(errors, 'assay', 'INVALID_STRING', 'assay cannot be empty if provided.');
  }
}

function validateSleepFields(
  input: Extract<HealthRecordInput, { category: 'sleep' }>,
  errors: ValidationIssue[],
): void {
  if (
    input.sleep_start !== undefined &&
    input.sleep_start !== null &&
    !isValidIsoTimestamp(input.sleep_start)
  ) {
    addIssue(
      errors,
      'sleep_start',
      'INVALID_TIMESTAMP',
      'sleep_start must be a valid ISO 8601 timestamp or null.',
    );
  }

  if (
    input.sleep_end !== undefined &&
    input.sleep_end !== null &&
    !isValidIsoTimestamp(input.sleep_end)
  ) {
    addIssue(
      errors,
      'sleep_end',
      'INVALID_TIMESTAMP',
      'sleep_end must be a valid ISO 8601 timestamp or null.',
    );
  }

  if (
    input.sleep_start &&
    input.sleep_end &&
    isValidIsoTimestamp(input.sleep_start) &&
    isValidIsoTimestamp(input.sleep_end) &&
    Date.parse(input.sleep_end) < Date.parse(input.sleep_start)
  ) {
    addIssue(
      errors,
      'sleep_end',
      'INVALID_SLEEP_INTERVAL',
      'sleep_end cannot be earlier than sleep_start.',
    );
  }

  if (input.sleep_duration !== undefined && !isFiniteNumberOrNull(input.sleep_duration)) {
    addIssue(
      errors,
      'sleep_duration',
      'INVALID_NUMERIC_VALUE',
      'sleep_duration must be a finite number or null.',
    );
  } else if (typeof input.sleep_duration === 'number' && input.sleep_duration < 0) {
    addIssue(
      errors,
      'sleep_duration',
      'NEGATIVE_DURATION',
      'sleep_duration cannot be negative.',
    );
  }

  if (input.sleep_latency !== undefined && !isFiniteNumberOrNull(input.sleep_latency)) {
    addIssue(
      errors,
      'sleep_latency',
      'INVALID_NUMERIC_VALUE',
      'sleep_latency must be a finite number or null.',
    );
  } else if (typeof input.sleep_latency === 'number' && input.sleep_latency < 0) {
    addIssue(
      errors,
      'sleep_latency',
      'NEGATIVE_LATENCY',
      'sleep_latency cannot be negative.',
    );
  }

  if (input.sleep_efficiency !== undefined && !isFiniteNumberOrNull(input.sleep_efficiency)) {
    addIssue(
      errors,
      'sleep_efficiency',
      'INVALID_NUMERIC_VALUE',
      'sleep_efficiency must be a finite number or null.',
    );
  } else if (
    typeof input.sleep_efficiency === 'number' &&
    (input.sleep_efficiency < 0 || input.sleep_efficiency > 100)
  ) {
    addIssue(
      errors,
      'sleep_efficiency',
      'OUT_OF_PERCENTAGE_BOUNDS',
      'sleep_efficiency must be between 0 and 100.',
    );
  }
}

function validateCardiovascularFields(
  input: Extract<HealthRecordInput, { category: 'cardiovascular' }>,
  errors: ValidationIssue[],
): void {
  if (input.heart_rate !== undefined && !isFiniteNumberOrNull(input.heart_rate)) {
    addIssue(
      errors,
      'heart_rate',
      'INVALID_NUMERIC_VALUE',
      'heart_rate must be a finite number or null.',
    );
  } else if (typeof input.heart_rate === 'number' && input.heart_rate < 0) {
    addIssue(
      errors,
      'heart_rate',
      'NEGATIVE_HEART_RATE',
      'heart_rate cannot be negative.',
    );
  }

  if (input.cardiac_output !== undefined && !isFiniteNumberOrNull(input.cardiac_output)) {
    addIssue(
      errors,
      'cardiac_output',
      'INVALID_NUMERIC_VALUE',
      'cardiac_output must be a finite number or null.',
    );
  } else if (typeof input.cardiac_output === 'number' && input.cardiac_output < 0) {
    addIssue(
      errors,
      'cardiac_output',
      'NEGATIVE_CARDIAC_OUTPUT',
      'cardiac_output cannot be negative.',
    );
  }

  if (input.blood_pressure !== undefined && input.blood_pressure !== null) {
    const bp = input.blood_pressure;
    if (
      typeof bp !== 'object' ||
      typeof bp.systolic !== 'number' ||
      !Number.isFinite(bp.systolic) ||
      bp.systolic < 0 ||
      typeof bp.diastolic !== 'number' ||
      !Number.isFinite(bp.diastolic) ||
      bp.diastolic < 0
    ) {
      addIssue(
        errors,
        'blood_pressure',
        'INVALID_BLOOD_PRESSURE',
        'blood_pressure must contain non-negative finite systolic and diastolic numbers.',
      );
    }
  }
}

/**
 * Checks that a collection of records for the same indicator uses a single consistent unit.
 * Never silently converts units.
 */
export function validateUnitConsistency(records: readonly HealthRecord[]): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const unitsByIndicator = new Map<string, Set<string>>();

  for (const record of records) {
    const key = `${record.category}:${record.indicator}`;
    let units = unitsByIndicator.get(key);
    if (!units) {
      units = new Set<string>();
      unitsByIndicator.set(key, units);
    }
    units.add(record.unit);
  }

  for (const [key, units] of unitsByIndicator.entries()) {
    if (units.size > 1) {
      addIssue(
        errors,
        'unit',
        'INCONSISTENT_UNITS',
        `Multiple incompatible units detected for ${key}: ${Array.from(units).join(', ')}.`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
