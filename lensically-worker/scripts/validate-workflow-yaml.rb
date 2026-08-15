require "yaml"

workflow_dir = File.expand_path("../../.github/workflows", __dir__)
files = Dir.glob(File.join(workflow_dir, "*.{yml,yaml}")).sort
raise "no_workflow_files_found" if files.empty?

files.each do |path|
  begin
    YAML.parse_file(path)
    puts "workflow_yaml_ok=#{File.basename(path)}"
  rescue Psych::SyntaxError => error
    relative_path = path.delete_prefix("#{File.expand_path('../..', __dir__)}/")
    problem = error.problem.to_s.gsub("%", "%25").gsub("\r", "%0D").gsub("\n", "%0A")
    puts "::error file=#{relative_path},line=#{error.line},col=#{error.column}::#{problem}"
    raise
  end
end
