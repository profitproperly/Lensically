require "yaml"

path = ARGV.fetch(0)
document = YAML.parse_file(path)

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

fast_step_names = jobs.fetch("fast-validation").fetch("steps").map { |step| step["name"] }
abort("fast_validation_upload_step_missing") unless fast_step_names.include?("Upload architecture baseline")

worker_release_step_names = jobs.fetch("worker-release").fetch("steps").map { |step| step["name"] }
required_worker_release_steps = [
  "Deploy exact validated Worker head",
  "Verify production runtime, scheduler, retained website, and retired legacy surfaces",
]
missing_worker_release_steps = required_worker_release_steps.reject { |name| worker_release_step_names.include?(name) }
abort("worker_release_steps_missing:#{missing_worker_release_steps.join(",")}") unless missing_worker_release_steps.empty?

puts "workflow_structure_valid"


