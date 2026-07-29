export async function readOperatorScheduledPostList<TItem>(
  input: {
    payload: Record<string, unknown>;
  },
  dependencies: {
    normalizeText: (
      value: unknown,
      maxLength: number,
      allowEmpty?: boolean,
    ) => string | null;
    defaultTimezone: string;
    isValidIsoDate: (value: string) => boolean;
    listForLocalDate: (query: {
      date: string;
      timezone: string;
    }) => Promise<TItem[]>;
  },
): Promise<{
  items: TItem[];
  returned_count: number;
  total_count: number;
  has_more: false;
  deletion_history_exposed_to_model: false;
}> {
  const date = dependencies.normalizeText(input.payload.date, 20, true);
  const timezone = dependencies.normalizeText(
    input.payload.timezone,
    100,
    true,
  ) ?? dependencies.defaultTimezone;
  const items = date && dependencies.isValidIsoDate(date)
    ? await dependencies.listForLocalDate({ date, timezone })
    : [];

  return {
    items,
    returned_count: items.length,
    total_count: items.length,
    has_more: false,
    deletion_history_exposed_to_model: false,
  };
}
