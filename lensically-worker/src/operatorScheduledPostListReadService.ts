export async function readOperatorScheduledPostList<TItem, TDeletion>(

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
    listDeletions: (query: {
      date?: string | null;
      timezone: string;
    }) => Promise<TDeletion[]>;

  },
): Promise<{
  items: TItem[];
  returned_count: number;
  total_count: number;
  has_more: false;
    deletions: TDeletion[];
  deletion_count: number;
  deletion_history_exposed_to_model: true;
  deletion_history_learning_effect: "none";
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
  const deletions = await dependencies.listDeletions({
    date: date && dependencies.isValidIsoDate(date) ? date : null,
    timezone,
  });

  return {
    items,
    returned_count: items.length,
    total_count: items.length,
    has_more: false,
    deletions,
    deletion_count: deletions.length,
    deletion_history_exposed_to_model: true,
    deletion_history_learning_effect: "none",
  };

}
