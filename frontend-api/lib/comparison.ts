export type ComparisonLabels = {
  original: string;
  newValue: string;
  diff: string;
  diffPercent: string;
  na: string;
};

export function formatNumericComparison(
  originalValue: number,
  newValue: number,
  unit: string | null,
  labels: ComparisonLabels
): string {
  const delta = newValue - originalValue;
  const percent = originalValue ? (delta / originalValue) * 100 : null;
  const unitSuffix = unit ? ` ${unit}` : "";
  const percentText = percent === null ? labels.na : `${percent.toFixed(2)}%`;

  return `${labels.original}: ${originalValue.toFixed(2)}${unitSuffix} | ${labels.newValue}: ${newValue.toFixed(
    2
  )}${unitSuffix} | ${labels.diff}: ${delta.toFixed(2)}${unitSuffix} | ${labels.diffPercent}: ${percentText}`;
}

export function formatTextComparison(
  originalValue: string,
  newValue: string,
  labels: ComparisonLabels
): string {
  return `${labels.original}: ${originalValue} | ${labels.newValue}: ${newValue} | ${labels.diff}: ${
    labels.na
  } | ${labels.diffPercent}: ${labels.na}`;
}
