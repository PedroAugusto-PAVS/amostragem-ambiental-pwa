const assert = require("node:assert/strict");
const fs = require("node:fs");

const caminho =
  "supabase/migrations/202607230001_medicao_codigos.sql";
assert.ok(fs.existsSync(caminho), "A migração de códigos deve existir.");

const sql = fs.readFileSync(caminho, "utf8");
const sqlNormalizado = sql.replace(/\s+/g, " ").trim();

assert.match(sqlNormalizado, /^begin;/i);
assert.match(sqlNormalizado, /commit;$/i);
assert.doesNotMatch(
  sql,
  /\b(?:drop\s+table|truncate\s+table)\b/i,
  "A migração não pode apagar tabelas ou dados.",
);

assert.match(sql, /create table if not exists public\.medicao_codigos/i);
assert.match(
  sql,
  /local_id\s+uuid\s+primary key\s+default\s+gen_random_uuid\(\)/i,
);
assert.match(sql, /medicao_local_id\s+text\s+not null/i);
assert.match(
  sqlNormalizado,
  /foreign key \(medicao_local_id\) references public\.medicoes\(local_id\) on update cascade on delete cascade/i,
);
assert.match(
  sqlNormalizado,
  /create unique index if not exists medicoes_local_id_uidx on public\.medicoes \(local_id\)/i,
);
assert.match(
  sqlNormalizado,
  /create unique index if not exists medicao_codigos_codigo_normalizado_uidx on public\.medicao_codigos \(medicao_local_id, lower\(btrim\(codigo\)\)\)/i,
);
assert.match(
  sqlNormalizado,
  /codigo = btrim\(codigo\) and char_length\(codigo\) between 1 and 200/i,
);

for (const tipo of [
  "normal",
  "duplicata",
  "branco",
  "branco_campo",
  "branco_viagem",
  "controle",
  "outro",
]) {
  assert.match(sql, new RegExp(`'${tipo}'`), `Tipo ausente no SQL: ${tipo}`);
}

assert.match(
  sqlNormalizado,
  /insert into public\.medicao_codigos .* from public\.medicoes medicao/i,
);
assert.match(sql, /medicao\.codigo_frascaria/i);
assert.match(
  sqlNormalizado,
  /lower\(btrim\(medicao\.codigo_frascaria\)\) <> 'marcado manualmente'/i,
  "O marcador de campanha não pode virar código no backfill.",
);
assert.match(
  sqlNormalizado,
  /not exists \( select 1 from public\.medicao_codigos codigo_existente/i,
  "O backfill deve ser repetível sem duplicar códigos.",
);

assert.match(sql, /alter table public\.medicao_codigos enable row level security/i);
for (const operacao of ["select", "insert", "update", "delete"]) {
  assert.match(
    sql,
    new RegExp(
      `create policy medicao_codigos_${operacao}[\\s\\S]*?for ${operacao}`,
      "i",
    ),
    `Policy RLS ausente: ${operacao}.`,
  );
}
assert.match(sql, /public\.medicao_codigos_usuario_ativo\(\)/i);
assert.match(sql, /public\.pode_editar_medicao_codigo\(/i);
assert.match(
  sqlNormalizado,
  /tipo in \('admin', 'administrador'\)/i,
  "Administradores ativos devem manter a autorização administrativa.",
);
assert.doesNotMatch(
  sql,
  /\b(?:is_active_user|is_admin)\s*\(/i,
  "A migração não deve depender de helpers que podem não existir no banco.",
);
assert.match(
  sql,
  /alter function public\.medicao_codigos_usuario_ativo\(\) owner to postgres/i,
);
assert.match(
  sql,
  /alter function public\.pode_editar_medicao_codigo\(text\) owner to postgres/i,
);
assert.match(sql, /revoke all on table public\.medicao_codigos from anon/i);
assert.match(
  sqlNormalizado,
  /grant select, insert, update, delete on table public\.medicao_codigos to authenticated/i,
);

console.log("medicao-codigos-migration.test.js: ok");
