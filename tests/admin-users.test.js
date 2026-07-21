const assert = require("node:assert/strict");
const fs = require("node:fs");

const edge = fs.readFileSync("supabase/functions/admin-users/index.ts", "utf8");
const admin = fs.readFileSync("public/js/admin.js", "utf8");
const auth = fs.readFileSync("public/js/auth.js", "utf8");
const guard = fs.readFileSync("public/js/supabase.js", "utf8");
const migration = fs.readFileSync("supabase/migrations/202607210002_harden_admin_users.sql", "utf8");

assert.match(edge, /auth\.getUser\(match\[1\]\)/, "JWT deve ser validado pelo Auth");
assert.match(edge, /profile\.tipo !== "administrador"/, "autorização deve vir do perfil");
assert.match(edge, /auth\.admin\.createUser/, "criação deve usar Admin API");
assert.doesNotMatch(admin, /auth\.signUp/, "frontend não pode usar signUp");
assert.doesNotMatch(admin + auth + guard, /SERVICE_ROLE/, "frontend não pode conter Service Role");
assert.match(admin, /body: \{ action, data \}/, "frontend deve usar o contrato action/data");
assert.match(admin, /usuariosEmProcessamento = new Set/, "deve bloquear operação duplicada por usuário");
assert.match(edge, /listUsers\(\{ page, perPage \}\)/, "busca no Auth deve paginar");
assert.match(edge, /deleteUser\(id\)/, "compensação de criação deve remover Auth");
assert.match(edge, /from\("usuarios"\)\.insert\(profile\)/, "exclusão deve restaurar perfil se Auth falhar");
assert.match(edge, /SELF_DEACTIVATE/);
assert.match(edge, /SELF_DELETE/);
assert.match(edge, /LAST_ACTIVE_ADMIN/);
assert.match(guard, /INITIAL_SESSION/);
assert.match(guard, /TOKEN_REFRESHED/);
assert.match(guard, /perfil\.ativo === false/);
assert.match(migration, /lower\(btrim\(email\)\)/);
assert.match(migration, /enable row level security/i);
assert.match(migration, /set row_security = off/i);
assert.match(migration, /create table if not exists public\.logs_usuarios/i);

console.log("admin-users: contrato e invariantes de segurança validados");
