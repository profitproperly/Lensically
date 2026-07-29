require "yaml"

path = ARGV.fetch(0)
source = File.read(path)
misindented_step_lines = source.lines.each_with_index.filter_map do |line, index|
  index + 1 if line.match?(/^ {8,}- name:/)
end
abort("misindented_step_markers:#{misindented_step_lines.join(",")}") unless misindented_step_lines.empty?
if source.lines.any? { |line| line.match?(/^\s+run:\s+node scripts\/run-full-validation\.mjs\s*$/) }
  abort("shared_full_validation_requires_block_run")
end
document = YAML.parse(source, filename: path)

def assert_no_duplicate_mapping_keys(node, path = [])
  if node.is_a?(Psych::Nodes::Mapping)
    seen = {}
    node.children.each_slice(2) do |key_node, value_node|
      key = key_node.respond_to?(:value) ? key_node.value.to_s : key_node.to_s
      location = (path + [key]).join(".")
      abort("duplicate_mapping_key:#{location}") if seen.key?(key)
      seen[key] = true
      assert_no_duplicate_mapping_keys(value_node, path + [key])
    end
  elsif node.respond_to?(:children) && node.children
    node.children.each_with_index do |child, index|
      assert_no_duplicate_mapping_keys(child, path + [index.to_s])
    end
  end
end

assert_no_duplicate_mapping_keys(document)
data = document.to_ruby
jobs = data.fetch("jobs")

required = %w[push-validation fast-validation operator-test-shards worker-release]
missing = required.reject { |name| jobs.key?(name) }
abort("missing_jobs:#{missing.join(",")}") unless missing.empty?

jobs.each do |name, job|
  abort("job_not_mapping:#{name}") unless job.is_a?(Hash)
  abort("job_runs_on_missing:#{name}") unless job.key?("runs-on")
  steps = job["steps"]
  abort("job_steps_not_list:#{name}") unless steps.is_a?(Array)

  steps.each_with_index do |step, index|
    abort("step_not_mapping:#{name}:#{index}") unless step.is_a?(Hash)
    abort("step_name_missing:#{name}:#{index}") unless step["name"].is_a?(String)
    run = step["run"]
    if run.is_a?(String) && run.lines.any? { |line| line.match?(/^\s*-\s+name:/) }
      abort("embedded_step_marker:#{name}:#{step["name"]}")
    end
  end
end

def step_run(jobs, job_name, step_name)
  step = jobs.fetch(job_name).fetch("steps").find { |candidate| candidate["name"] == step_name }
  abort("required_step_missing:#{job_name}:#{step_name}") unless step
  run = step["run"]
  abort("required_step_run_missing:#{job_name}:#{step_name}") unless run.is_a?(String)
  run
end

fast_step_names = jobs.fetch("fast-validation").fetch("steps").map { |step| step["name"] }
abort("fast_validation_upload_step_missing") unless fast_step_names.include?("Upload architecture baseline")

worker_release_step_names = jobs.fetch("worker-release").fetch("steps").map { |step| step["name"] }
required_worker_release_steps = [
  "Deploy exact validated Worker head",
  "Verify production runtime, scheduler, retained website, and retired legacy surfaces",
]
missing_worker_release_steps = required_worker_release_steps.reject { |name| worker_release_step_names.include?(name) }
abort("worker_release_steps_missing:#{missing_worker_release_steps.join(",")}") unless missing_worker_release_steps.empty?

push_full_run = step_run(jobs, "push-validation", "Run full push validation")
abort("push_shared_full_validation_missing") unless push_full_run.strip == "node scripts/run-full-validation.mjs"

release_gate_run = step_run(jobs, "worker-release", "Run exact-head release gates")
abort("release_shared_full_validation_missing") unless release_gate_run.include?("node scripts/run-full-validation.mjs --check")
abort("release_shared_full_validation_execution_missing") unless release_gate_run.lines.count { |line| line.strip == "node scripts/run-full-validation.mjs" } == 1
abort("release_fallback_preflight_missing") unless release_gate_run.include?("node scripts/release-preflight.mjs")
abort("release_fallback_typecheck_missing") unless release_gate_run.include?("npx tsc --noEmit")

[
  ["push-validation", "Typecheck and lifecycle gate"],
  ["fast-validation", "Typecheck and lifecycle gate"],
  ["operator-test-shards", "Verify lifecycle and run deterministic shard"],
].each do |job_name, step_name|
  run = step_run(jobs, job_name, step_name)
  abort("full_validation_plan_check_missing:#{job_name}") unless run.include?("node scripts/run-full-validation.mjs --check")
end

all_run_scripts = jobs.values.flat_map { |job| job.fetch("steps").filter_map { |step| step["run"] if step["run"].is_a?(String) } }.join("\n")
legacy_broad_markers = [
  "npm run test -- --run test/operatorMcpProtocol.spec.ts",
  "npm run test -- --run test/operatorManifestPersistenceService.spec.ts",
  "npm run test -- --run test/operatorScheduledPostEditMutationService.spec.ts",
]
returned_legacy_markers = legacy_broad_markers.select { |marker| all_run_scripts.include?(marker) }
abort("duplicated_broad_validation_commands_returned:#{returned_legacy_markers.join(",")}") unless returned_legacy_markers.empty?

puts "workflow_structure_valid"


