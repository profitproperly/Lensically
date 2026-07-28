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
  abort("job_steps_not_list:#{name}") unless job["steps"].is_a?(Array)
end

puts "workflow_structure_valid"
