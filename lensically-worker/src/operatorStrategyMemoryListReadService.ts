export async function readOperatorStrategyMemoryList<TItem>(
  input: {
    payload: Record<string, unknown>;
  },
  dependencies: {
    normalizeMachineKey: (value: unknown, fallback?: string) => string;
    listActiveMemory: (query: {
      kinds: string[];
      limit: number;
      offset: number;
      status: "active";
    }) => Promise<TItem[]>;
    countActiveMemory: (query: {
      kinds: string[];
      status: "active";
    }) => Promise<number>;
  },
): Promise<{
  items: TItem[];
  returned_count: number;
  total_count: number;
  has_more: boolean;
}> {
  const kind = dependencies.normalizeMachineKey(input.payload.kind, "");
  const limit = Math.min(
    Math.max(Math.trunc(Number(input.payload.limit ?? 50)), 1),
    100,
  );
  const offset = Math.max(Math.trunc(Number(input.payload.offset ?? 0)), 0);
  const kinds = kind ? [kind] : [];
  const items = await dependencies.listActiveMemory({
    kinds,
    limit,
    offset,
    status: "active",
  });
  const total = await dependencies.countActiveMemory({
    kinds,
    status: "active",
  });

  return {
    items,
    returned_count: items.length,
    total_count: total,
    has_more: offset + items.length < total,
  };
}
