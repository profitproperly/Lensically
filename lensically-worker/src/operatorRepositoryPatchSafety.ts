export type RepositoryPatchSafetyResult = {
  ok: boolean;
  error?: string;
  line_numbers?: number[];
};

export function validateRepositoryPatchContent(
  path: string,
  content: string,
): RepositoryPatchSafetyResult {
  if (!/\.ya?ml$/i.test(path)) return { ok: true };

  const lines = content.split(/\r?\n/);
  const tabIndented = lines.flatMap((line, index) => /^\t+\S/.test(line) ? [index + 1] : []);
  if (tabIndented.length) {
    return { ok: false, error: "yaml_tab_indentation_forbidden", line_numbers: tabIndented };
  }

  if (/^\.github\/workflows\//i.test(path)) {
    const misindentedSteps = lines.flatMap((line, index) => /^ {8,}- name:/.test(line) ? [index + 1] : []);
    if (misindentedSteps.length) {
      return {
        ok: false,
        error: "github_workflow_step_indentation_invalid",
        line_numbers: misindentedSteps,
      };
    }

    const embeddedStepMarkers = lines.flatMap((line, index) => /^ {10,}- name:/.test(line) ? [index + 1] : []);
    if (embeddedStepMarkers.length) {
      return {
        ok: false,
        error: "github_workflow_embedded_step_marker",
        line_numbers: embeddedStepMarkers,
      };
    }
  }

  return { ok: true };
}
