require "yaml"

path = ARGV.fetch(0)
data = YAML.parse_file(path).to_ruby
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

puts "workflow_structure_valid"

