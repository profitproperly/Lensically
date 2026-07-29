require "yaml"

path = ARGV.fetch(0)
source = File.read(path)
misindented_step_lines = source.lines.each_with_index.filter_map do |line, index|
  index + 1 if line.match?(/^ {8,}- name:/)
end
abort("misindented_step_markers:#{misindented_step_lines.join(",")}") unless misindented_step_lines.empty?
canonical_gate_commands = [
  "node scripts/release-preflight.mjs",
  "node scripts/test-d1-migration-release.mjs",
    "node scripts/test-d1-backfill-runner.mjs",
  "node scripts/d1-migration-release.mjs --check",
  "node scripts/test-cron-release.mjs",
  "node scripts/cron-release.mjs --check --config wrangler.jsonc",
]
misindented_gate_commands = source.lines.each_with_index.filter_map do |line, index|
  stripped = line.strip
  index + 1 if canonical_gate_commands.include?(stripped) && !line.match?(/^ {10}\S/)
end
abort("misindented_gate_commands:#{misindented_gate_commands.join(",")}") unless misindented_gate_commands.empty?
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

def step_for(jobs, job_name, step_name)
  step = jobs.fetch(job_name).fetch("steps").find { |candidate| candidate["name"] == step_name }
  abort("required_step_missing:#{job_name}:#{step_name}") unless step
  step
end

def step_run(jobs, job_name, step_name)
  step = step_for(jobs, job_name, step_name)
  run = step["run"]
  abort("required_step_run_missing:#{job_name}:#{step_name}") unless run.is_a?(String)
  run
end

fast_step_names = jobs.fetch("fast-validation").fetch("steps").map { |step| step["name"] }
abort("fast_validation_upload_step_missing") unless fast_step_names.include?("Upload architecture baseline")

worker_release_step_names = jobs.fetch("worker-release").fetch("steps").map { |step| step["name"] }
required_worker_release_steps = [
  "Prepare trigger-neutral Worker deploy config",
  "Deploy exact validated Worker head",
  "Reconcile exact Wrangler cron schedule",
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
abort("release_migration_contract_tests_missing") unless release_gate_run.include?("node scripts/test-d1-migration-release.mjs") && release_gate_run.include?("node scripts/test-d1-backfill-runner.mjs") && release_gate_run.include?("node scripts/d1-migration-release.mjs --check")
abort("release_cron_contract_tests_missing") unless release_gate_run.include?("node scripts/test-cron-release.mjs") && release_gate_run.include?("node scripts/cron-release.mjs --check --config wrangler.jsonc")

migration_plan_step = step_for(jobs, "worker-release", "Plan exact-head database migrations")
migration_plan = migration_plan_step["run"].to_s
migration_plan_production_sha = migration_plan_step.dig("env", "LENSICALLY_PRODUCTION_SHA").to_s
abort("release_migration_plan_missing") unless migration_plan.include?("d1-migration-release.mjs --plan-remote") && migration_plan.include?("/tmp/lensically-d1-migration-plan.json")
abort("release_migration_plan_production_sha_missing") unless migration_plan_production_sha.include?("steps.release_scope.outputs.deployed_sha")
migration_apply_step = step_for(jobs, "worker-release", "Apply exact planned database migrations")
migration_apply = migration_apply_step["run"].to_s
migration_apply_production_sha = migration_apply_step.dig("env", "LENSICALLY_PRODUCTION_SHA").to_s
abort("release_migration_apply_not_plan_bound") unless migration_apply.include?("d1-migration-release.mjs --apply-remote") && migration_apply.include?("--plan /tmp/lensically-d1-migration-plan.json")
abort("release_migration_apply_production_sha_missing") unless migration_apply_production_sha.include?("steps.release_scope.outputs.deployed_sha")
release_scope = step_run(jobs, "worker-release", "Resolve exact-SHA release scope")
abort("release_scope_deployed_sha_output_missing") unless release_scope.include?('echo "deployed_sha=${deployed_sha}" >> "${GITHUB_OUTPUT}"')
migration_verify = step_run(jobs, "worker-release", "Verify exact production migration ledger")
abort("release_migration_verify_missing") unless migration_verify.include?("d1-migration-release.mjs --verify-remote")
abort("direct_unplanned_migration_apply_returned") if source.include?("run: npx wrangler d1 migrations apply")
abort("canonical_migration_path_missing") unless source.include?("lensically-worker/database/migrations/*")
abort("legacy_migration_path_classifier_returned") if source.include?("lensically-worker/migrations/*")

cron_prepare = step_run(jobs, "worker-release", "Prepare trigger-neutral Worker deploy config")
abort("trigger_neutral_worker_config_missing") unless cron_prepare.include?("cron-release.mjs --write-deploy-config") && cron_prepare.include?("--config wrangler.jsonc") && cron_prepare.include?("--output wrangler.release.generated.json")
worker_deploy = step_run(jobs, "worker-release", "Deploy exact validated Worker head")
abort("worker_deploy_not_trigger_neutral") unless worker_deploy.include?("--config wrangler.release.generated.json")
abort("raw_wrangler_worker_deploy_returned") if worker_deploy.include?("--config wrangler.jsonc")
cron_reconcile_step = step_for(jobs, "worker-release", "Reconcile exact Wrangler cron schedule")
abort("cron_reconcile_condition_missing") unless cron_reconcile_step["if"].to_s.include?("schedule_contract_changed == 'true'")
abort("cron_reconcile_command_missing") unless cron_reconcile_step["run"].to_s.include?("cron-release.mjs --reconcile-remote --config wrangler.jsonc")
abort("inline_cron_schedule_api_returned") if source.include?("workers/scripts/lensically-worker/schedules")
abort("schedule_contract_classifier_missing") unless release_scope.include?("schedule_contract_changed") && release_scope.include?("lensically-worker/wrangler*")

[
  ["push-validation", "Typecheck and lifecycle gate"],
  ["fast-validation", "Typecheck and lifecycle gate"],
  ["operator-test-shards", "Verify lifecycle and run deterministic shard"],
].each do |job_name, step_name|
    run = step_run(jobs, job_name, step_name)
  abort("full_validation_plan_check_missing:#{job_name}") unless run.include?("node scripts/run-full-validation.mjs --check")
    abort("migration_contract_validation_missing:#{job_name}") unless run.include?("node scripts/test-d1-migration-release.mjs") && run.include?("node scripts/test-d1-backfill-runner.mjs") && run.include?("node scripts/d1-migration-release.mjs --check")
  abort("cron_contract_validation_missing:#{job_name}") unless run.include?("node scripts/test-cron-release.mjs") && run.include?("node scripts/cron-release.mjs --check --config wrangler.jsonc")
end

push_checkout = step_for(jobs, "push-validation", "Checkout pushed head")
abort("push_full_history_checkout_missing") unless push_checkout.dig("with", "fetch-depth") == 0
push_classification = step_run(jobs, "push-validation", "Classify pushed change")
abort("push_production_relative_classification_missing") unless push_classification.include?("https://api.lensically.com/api/operator/health") && push_classification.include?("validation_scope=deployed_production")
abort("push_classification_fallback_missing") unless push_classification.include?("validation_scope=event_before_fallback") && push_classification.include?("validation_scope=parent_fallback")

push_artifact_test = step_run(jobs, "push-validation", "Test validated web artifact contract")
abort("push_web_artifact_test_missing") unless push_artifact_test.include?("npm run test:validated-artifact")
push_web_build = step_run(jobs, "push-validation", "Build exact validated web artifact")
abort("push_web_cloudflare_build_missing") unless push_web_build.include?("npm run build:cf")
push_web_package = step_run(jobs, "push-validation", "Package exact validated web artifact")
abort("push_web_artifact_package_missing") unless push_web_package.include?("validated-web-artifact.mjs package")
push_upload = step_for(jobs, "push-validation", "Upload exact validated web artifact")
abort("push_web_artifact_upload_action_missing") unless push_upload["uses"] == "actions/upload-artifact@v4"
abort("push_web_artifact_upload_name_missing") unless push_upload.dig("with", "name").to_s.include?("lensically-web-")

release_download = step_for(jobs, "worker-release", "Download exact validated web artifact")
abort("release_web_artifact_download_action_missing") unless release_download["uses"] == "actions/download-artifact@v4"
abort("release_web_artifact_download_not_fallback_safe") unless release_download["continue-on-error"] == true
abort("release_web_artifact_cross_run_missing") unless release_download.dig("with", "run-id").to_s.include?("validated_run_id")
release_restore = step_for(jobs, "worker-release", "Restore exact validated web artifact")
abort("release_web_artifact_restore_not_fallback_safe") unless release_restore["continue-on-error"] == true
abort("release_web_artifact_restore_missing") unless release_restore["run"].to_s.include?("validated-web-artifact.mjs restore")
release_path = step_run(jobs, "worker-release", "Resolve validated web release path")
abort("release_web_artifact_path_resolution_incomplete") unless release_path.include?("use_validated_artifact") && release_path.include?("fallback_reason")
fallback_build = step_for(jobs, "worker-release", "Build fallback exact-head web product")
abort("release_web_fallback_build_condition_missing") unless fallback_build["if"].to_s.include?("use_validated_artifact != 'true'")
abort("release_web_fallback_build_missing") unless fallback_build["run"].to_s.include?("npm run build:cf")
release_gate_step = step_for(jobs, "worker-release", "Run exact-head release gates")
abort("release_web_fallback_full_gates_missing") unless release_gate_step["if"].to_s.include?("use_validated_artifact != 'true'")
abort("unconditional_release_web_rebuild_returned") if jobs.fetch("worker-release").fetch("steps").any? { |step| step["name"] == "Build exact-head web product" }

all_run_scripts = jobs.values.flat_map { |job| job.fetch("steps").filter_map { |step| step["run"] if step["run"].is_a?(String) } }.join("\n")
legacy_broad_markers = [
  "npm run test -- --run test/operatorMcpProtocol.spec.ts",
  "npm run test -- --run test/operatorManifestPersistenceService.spec.ts",
  "npm run test -- --run test/operatorScheduledPostEditMutationService.spec.ts",
]
returned_legacy_markers = legacy_broad_markers.select { |marker| all_run_scripts.include?(marker) }
abort("duplicated_broad_validation_commands_returned:#{returned_legacy_markers.join(",")}") unless returned_legacy_markers.empty?

puts "workflow_structure_valid"


