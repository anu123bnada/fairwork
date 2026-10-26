// Prepares an unlinked local Supabase project. Never starts services or touches hosted data.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { inventory } from './activation-checks.mjs';

const destination = path.resolve('.tmp/oryqen-local-dev');
const root = path.join(destination, 'supabase');
const foundation = [
  ['202610070001_identity_foundation.sql', '6d76bafdba1d8a4f61c9881068ac56b5071b51cb0212146c92bd4095824fc0a8'],
  ['202610080002_identity_auth_context.sql', '22981389db01426a4136b11c22605b7ccf1f62e9c2cb55274ec524a190fa91b4'],
  ['202610090001_identity_rpc_execute.sql', 'c0292e724cf775811958afc783c0717db159958f02ffc9588376cfc30d5b3754'],
  ['202610090002_demo_authority.sql', '8262978f89b735c6536ae1adf0250ed92e13f0407b1cf0630186c17f903960f6'],
];
const files = [...foundation, ...inventory().map(row => [row.name, row.sha256]),
  ['202610180001_deferred_integrity_context.sql', '26c5fae862178116bbdc1d343d2f65542f7930e01a0c52a6d38e8331a304105c'],
  ['202610180002_offer_workspace.sql', '06cffbe45c8b0117caf0f845d8352e08b97743d13431b7ed5839e0e0c523f9b6'],
  ['202610180003_organization_requests.sql', 'ce17ba6cf581841909f2b65e467eca719be8ab81a5af653cb02a0d913f47a3df'],
  ['202610180004_ai_consent_budget.sql', 'b6c5a04e6dd99c32b37417e1131fd73ea665a58e6ac5a2c759473a106641cf38'],
  ['202610180005_ai_processing_notice.sql', '12780f1c6f7d5dca4c77569e28b0ffa684e59ec3bb0122702c662caf90b7807c'],
  ['202610180006_company_claims.sql', '23a0a18a3b223220228899030c52904cea104109f140f713d7a66aada60f7e99'],
  ['202610180007_activity_notifications.sql', '3871eb6a58ef2577f4b19d346d26ed11b80a1c04ff213c563d280b980b5a54e0'],
  ['202610180008_privacy_requests.sql', '6944ebc450189eeee02513f9362ac024b018a82611003fc6ac6e35eb9a959150'],
  ['202610180009_privacy_review_guards.sql', 'c4946f4fa516ce94d65a06109cd8653bd921bccb7d4c723108f78d0029b263b3'],
  ['202610180010_passport_sharing.sql', 'e5b150a0f1e88fbc578618736a28a0853075923bd03fda955fa0f0c11063ef79'],
  ['202610180011_account_deactivation.sql', 'ae436368e7bb30a19bbd17176b9969c92c1742186637ad24a8c6604b2608a507'],
  ['202610180012_deactivation_retry.sql', '43ddf6bc3d03f097bca48d0be8465578a20c1f085d3842db93abfaa7cbeb8fa9'],
  ['202610190001_offer_history.sql', '40889db9def00b6415356ff8eafea12e45c74e3c3f3b11cbd38295a09df4e52f'],
  ['202610190002_workflow_notifications.sql', '3d07c9570c9ce5f8f0e8fef4a3786674c8b021dd114a984c891002e9bb3bf253'],
  ['202610200001_admin_control_center.sql', 'c984d1b20f03daafc63091d921949bf2e6b5a430025abe757820823003f6af31'],
  ['202610200002_case_followups.sql', 'c394b9f7e34d130d7e30bdda296313d1f83ecfc506f7c801abbc7860df064bd5'],
  ['202610200003_admin_operations.sql', '84c0ceb81101b21ec94f5b1686858c264e317e07e2136416620696a185d5eb33'],
  ['202610200004_organization_appeals.sql', 'f625aaabbebaff7566c1a3898962bc2d3dded8f4a2e58d5fcfebc990c0408ce1'],
  ['202610210001_runtime_telemetry.sql', 'cd3f6ce5888eca6672ded7bd70808d31d34cc865fc9c5f730617cebb3dc17381'],
  ['202610210002_admin_setting_consumers.sql', '482f018b6e19ddf776a5093283a7d4922ecab9e47c0c63e8389c690ae062eb81'],
  ['20261024052407_opportunity_discovery.sql', 'e2395cd0522d08e7af5aa2565b7098f1f7d5b14199938b9760bc1d309890b226'],
  ['20261024053156_private_guidance_history.sql', '51137fd7603fb62804ea5407e55288a29e1ab7c38b8f4c9b5faeb040f67d440b'],
  ['202610250001_offer_lifecycle.sql', '8aa837f9455d5741ba2d5d3f6dd5780b1d4d8bef67cb061d788fe3bf8ee60b5e'],
  ['20261025100610_private_offer_drafts.sql', '3566989b5c9b64cc857d2b20d99305cf024b7f4be86b0d5d3cddd92c95a01aa1'],
  ['20261025140000_private_employment_history.sql', '5562ee174e8ed04bee2b56bcdd0e2f20749100455738ad5d53ceb8a53b7a7c50'],
  ['20261026100000_guidance_thread_deletion.sql', 'ec4871094eb4a239ff98cc08a7f72d3c2e84acd1d0b118078645f485596bb65c'],
  ['20261026110000_list_offers_backward_compat.sql', '8d652a0653ec20b829e17915b8440d67089af6995ca036e151198c757c597823'],
  ['20261026120000_saved_analysis_history.sql', 'ce4a346a9e143d5689f2e84abd282c88cda50866cf13bc8164c09fc650c6a85a'],
  ['20261026130000_company_team_roster.sql', '6cabb1af80d5979d1464e8dc7a04b09e798db1dc08949aa72722593770cb0d4a'],
  ['20261026140000_credential_register.sql', '08bfa6cb53c2614a0250301762abf785cd4cf6bc26885688d77df75b31c1b0a9'],
  ['20261026160000_plan_entitlements.sql', '03cc8243488c2224a5f1fe088d6dbee34fddc3a1a1f239f4432e49e73bd8fcc4'],
  ['20261027100000_evidence_vault.sql', '7481084ef66a37dd4d0fdfaef213ccd4aab40c27800491d9e5d5809e59db2860'],
  ['20261027140000_developer_keys.sql', '1397374e18716b45d0c2f11f04a0b5ffc66d0ab9f6dd104563ade89163477bb3'],
  ['20261027160000_developer_webhooks.sql', '0d914769b2084c3bdca4595d31d4282e196f96defee482602f586f8912682461'],
  ['20261028100000_ai_gateway_providers.sql', 'f5e4c89caeac8c58cff8fc996411cfa0e06e9db0b2bdd49f52d1e51ce22f96a5'],
  ['20261028140000_recruiter_verification.sql', '998e0f382ddec523aefeeac82a6b221b74e5dc377a09280de1262dea737f647a'],
  ['20261028160000_vault_attachments.sql', 'c6bdd907606ceb83c5b105bff16fe4b83bd3d6aeccc99dc185165aa731931493'],
  ['20261028170000_organization_plans.sql', '81333dad336f1979831bc17442aa3028993953e7967594005046c534f1013f0c'],
];
if (JSON.stringify(readdirSync('supabase/migrations').sort()) !== JSON.stringify(files.map(([name]) => name))) throw new Error('Unexpected migration inventory');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
for (const [name, expected] of files) if (hash(readFileSync(`supabase/migrations/${name}`)) !== expected) throw new Error('Migration hash mismatch');
for (const directory of ['.tmp', destination, root]) if (existsSync(directory) && lstatSync(directory).isSymbolicLink()) throw new Error('Refusing linked local project directory');
if (existsSync(path.join(root, '.temp/project-ref'))) throw new Error('STOP: local development project must not be linked to hosted Supabase');

const config = `# LOCAL DEVELOPMENT ONLY. Never config push/link this project.
project_id = "oryqen-local-dev"
[api]
enabled = true
port = 55421
schemas = ["api"]
extra_search_path = ["extensions"]
max_rows = 50
[db]
port = 55422
shadow_port = 55420
major_version = 17
[db.seed]
enabled = false
[studio]
enabled = true
port = 55423
[inbucket]
enabled = true
port = 55424
[storage]
enabled = false
[auth]
enabled = true
site_url = "http://127.0.0.1:3100"
additional_redirect_urls = ["http://127.0.0.1:3100/auth/confirm", "http://127.0.0.1:3100/auth/recover", "http://localhost:3102/auth/confirm", "http://localhost:3102/auth/recover"]
jwt_expiry = 3600
enable_signup = true
enable_anonymous_sign_ins = false
minimum_password_length = 12
[auth.email]
enable_signup = true
enable_confirmations = true
secure_password_change = true
[auth.email.template.confirmation]
subject = "Confirm your local ORYQEN account"
content_path = "./supabase/templates/confirmation.html"
[auth.email.template.recovery]
subject = "Recover your local ORYQEN account"
content_path = "./supabase/templates/recovery.html"
[auth.sms]
enable_signup = false
enable_confirmations = false
[auth.mfa.totp]
enroll_enabled = true
verify_enabled = true
`;
const templates = new Map([
  ['supabase/config.toml', config],
  ['supabase/templates/confirmation.html', '<h1>ORYQEN local development</h1><p>This email is captured by your local mail inbox; no external email is sent.</p><p><a href="{{ .RedirectTo }}#token_hash={{ .TokenHash }}">Confirm your ORYQEN email</a></p>\n'],
  ['supabase/templates/recovery.html', '<h1>ORYQEN account recovery</h1><p>This is a local development email. If you did not request a password reset, ignore it.</p><p><a href="{{ .RedirectTo }}#token_hash={{ .TokenHash }}">Reset your ORYQEN password</a></p>\n'],
  ...files.map(([name]) => [`supabase/migrations/${name}`, readFileSync(`supabase/migrations/${name}`)]),
]);
// Refuse to overwrite changed files or traverse links; persistent data is never reset.
for (const [relative, content] of templates) {
  const target = path.join(destination, relative);
  for (let parent = path.dirname(target); parent !== path.dirname(destination); parent = path.dirname(parent)) {
    if (existsSync(parent) && lstatSync(parent).isSymbolicLink()) throw new Error('Refusing symlink in local project');
  }
  if (existsSync(target) && (lstatSync(target).isSymbolicLink() || hash(readFileSync(target)) !== hash(content))) {
    const beforeAndroid = config.replace(', "http://localhost:3102/auth/confirm", "http://localhost:3102/auth/recover"', '');
    const previousConfig = beforeAndroid.replace(', "http://127.0.0.1:3100/auth/recover"', '').replace('[auth.email.template.recovery]\nsubject = "Recover your local ORYQEN account"\ncontent_path = "./supabase/templates/recovery.html"\n', '');
    if (relative !== 'supabase/config.toml' || lstatSync(target).isSymbolicLink() || ![beforeAndroid, previousConfig].includes(readFileSync(target,'utf8'))) throw new Error(`STOP: existing local file differs: ${relative}`);
  }
}
if (existsSync(path.join(root, 'migrations')) && readdirSync(path.join(root, 'migrations')).some(name => !files.some(([file]) => file === name))) throw new Error('Unexpected local migration; preserve and review');
for (const [relative, content] of templates) {
  const target = path.join(destination, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  if (!existsSync(target)) writeFileSync(target, content, { flag: 'wx' });
  else if (relative === 'supabase/config.toml' && readFileSync(target,'utf8') !== config) {
    writeFileSync(`${target}.before-auth-${Date.now()}`, readFileSync(target), { flag: 'wx' });
    writeFileSync(target, content);
  }
}
console.log(JSON.stringify({status:'PREPARED_NOT_RUNNING',directory:destination,project:'oryqen-local-dev',migrations:files.length,appOrigin:'http://127.0.0.1:3100',apiPort:55421,databasePort:55422,mailPort:55424,hostedEnvironmentModified:false}));
