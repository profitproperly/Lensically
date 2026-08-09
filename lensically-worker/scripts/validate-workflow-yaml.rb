require "yaml"

workflow_dir = File.expand_path("../../.github/workflows", __dir__)
files = Dir.glob(File.join(workflow_dir, "*.{yml,yaml}")).sort
raise "no_workflow_files_found" if files.empty?

files.each do |path|
  YAML.parse_file(path)
  puts "workflow_yaml_ok=#{File.basename(path)}"
end
