const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
const projectName = process.env.PROJECT_NAME?.trim();
const branch = process.env.PRODUCTION_BRANCH?.trim() || "main";
const operationId = process.env.OPERATION_ID?.trim();

if (!token || !accountId) throw new Error("cloudflare_credentials_missing");
if (!projectName || !operationId) throw new Error("project_name_operation_id_required");
if (!/^[a-z0-9](?:[a-z0-9-]{0,56}[a-z0-9])?$/.test(projectName)) throw new Error("invalid_project_name");
if (!/^[A-Za-z0-9._/-]+$/.test(branch) || branch.includes("..") || branch.startsWith("/") || branch.endsWith("/")) throw new Error("invalid_production_branch");

const base = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects`;
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
const parse = async (response) => JSON.parse((await response.text()) || "null");

const lookupResponse = await fetch(`${base}/${encodeURIComponent(projectName)}`, { headers });
const lookup = await parse(lookupResponse);

if (lookupResponse.ok) {
  if (!lookup?.success || lookup?.result?.production_branch !== branch) throw new Error("existing_project_configuration_mismatch");
  console.log(JSON.stringify({ ok: true, created: false, operation_id: operationId, project_name: projectName, production_branch: branch, url: `https://${projectName}.pages.dev` }));
  process.exit(0);
}
if (lookupResponse.status !== 404) throw new Error(`cloudflare_project_lookup_failed_${lookupResponse.status}`);

const createResponse = await fetch(base, {
  method: "POST",
  headers,
  body: JSON.stringify({ name: projectName, production_branch: branch }),
});
const created = await parse(createResponse);
if (!createResponse.ok || !created?.success || created?.result?.name !== projectName || created?.result?.production_branch !== branch) {
  throw new Error(`cloudflare_project_creation_failed_${createResponse.status}`);
}
console.log(JSON.stringify({ ok: true, created: true, operation_id: operationId, project_name: projectName, production_branch: branch, url: `https://${projectName}.pages.dev` }));
