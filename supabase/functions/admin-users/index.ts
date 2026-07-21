import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2.95.0";

type Action = "create" | "update" | "activate" | "deactivate" | "delete";
type UserType = "administrador" | "coletor";
type Profile = { id: string; nome: string; email: string; tipo: UserType; ativo: boolean; criado_em?: string; atualizado_em?: string };
type Payload = Record<string, unknown>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TYPES = new Set<UserType>(["administrador", "coletor"]);
const BAN_DURATION = "876000h";

class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

function cors(origin: string | null) {
  const configured = (Deno.env.get("ALLOWED_ORIGINS") || "").split(",").map((v) => v.trim()).filter(Boolean);
  const defaults = [Deno.env.get("SUPABASE_URL") || "", "capacitor://localhost", "http://localhost"];
  const allowed = new Set([...configured, ...defaults]);
  const localDevelopment = Boolean(origin && /^http:\/\/localhost(?::\d+)?$/.test(origin));
  return {
    "Access-Control-Allow-Origin": origin && (allowed.has(origin) || localDevelopment) ? origin : "null",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
  };
}

function json(status: number, body: Record<string, unknown>, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8" } });
}

function success(status: number, message: string, data: unknown, origin: string | null) {
  return json(status, { success: true, message, data }, origin);
}

function normalizeEmail(value: unknown) { return String(value ?? "").trim().toLowerCase(); }
function normalizeName(value: unknown) { return String(value ?? "").trim().replace(/\s+/g, " "); }

function validId(value: unknown) {
  const id = String(value ?? "").trim();
  if (!UUID.test(id)) throw new ApiError(400, "INVALID_DATA", "Identificador de usuário inválido.");
  return id;
}

function validEmail(value: unknown) {
  const email = normalizeEmail(value);
  if (!EMAIL.test(email) || email.length > 254) throw new ApiError(400, "INVALID_EMAIL", "Informe um e-mail válido.");
  return email;
}

function validName(value: unknown) {
  const name = normalizeName(value);
  if (name.length < 2 || name.length > 120) throw new ApiError(400, "INVALID_NAME", "Informe um nome válido.");
  return name;
}

function validPassword(value: unknown) {
  const password = String(value ?? "");
  if (password.length < 6) throw new ApiError(400, "PASSWORD_TOO_SHORT", "A senha deve possuir pelo menos 6 caracteres.");
  if (password.length > 128) throw new ApiError(400, "INVALID_DATA", "A senha informada é muito longa.");
  return password;
}

function validType(value: unknown): UserType {
  if (!TYPES.has(value as UserType)) throw new ApiError(400, "INVALID_TYPE", "Informe um tipo de usuário válido.");
  return value as UserType;
}

function duplicate(error: { code?: string; message?: string } | null) {
  const text = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
  return text.includes("already") || text.includes("exists") || text.includes("registered") || text.includes("duplicate");
}

function notFound(error: { status?: number; code?: string; message?: string } | null) {
  const text = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
  return error?.status === 404 || text.includes("not_found") || text.includes("not found");
}

function logError(context: string, error: unknown, ids: Record<string, unknown> = {}) {
  console.error(context, { ...ids, message: error instanceof Error ? error.message : String(error) });
}

async function audit(admin: SupabaseClient, actorId: string, targetId: string | null, action: string, details: Payload = {}) {
  const { error } = await admin.from("logs_usuarios").insert({ ator_id: actorId, alvo_id: targetId, acao: action, detalhes: details });
  if (error) logError("Falha ao registrar auditoria", error, { actorId, targetId, action });
}

async function authorize(request: Request, authClient: SupabaseClient, admin: SupabaseClient) {
  const header = request.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new ApiError(401, "UNAUTHORIZED", "Sessão ausente ou inválida.");
  const { data, error } = await authClient.auth.getUser(match[1]);
  if (error || !data.user) throw new ApiError(401, "UNAUTHORIZED", "Sessão ausente ou inválida.");
  const { data: profile, error: profileError } = await admin.from("usuarios").select("id, tipo, ativo").eq("id", data.user.id).maybeSingle();
  if (profileError) throw profileError;
  if (!profile || profile.ativo !== true || profile.tipo !== "administrador") {
    throw new ApiError(403, "FORBIDDEN", "Você não possui permissão para realizar esta operação.");
  }
  return data.user.id;
}

async function findAuthByEmail(admin: SupabaseClient, email: string) {
  const perPage = 200;
  const maxPages = 500;
  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const found = data.users.find((user) => normalizeEmail(user.email) === email);
    if (found) return found;
    if (data.users.length < perPage) return null;
  }
  throw new Error("Limite controlado de paginação do Auth excedido.");
}

async function authById(admin: SupabaseClient, id: string): Promise<User | null> {
  const { data, error } = await admin.auth.admin.getUserById(id);
  if (error && notFound(error)) return null;
  if (error) throw error;
  return data.user || null;
}

async function profileById(admin: SupabaseClient, id: string): Promise<Profile | null> {
  const { data, error } = await admin.from("usuarios").select("id, nome, email, tipo, ativo, criado_em, atualizado_em").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

async function ensureEmailAvailable(admin: SupabaseClient, email: string, ignoredId?: string) {
  let query = admin.from("usuarios").select("id").eq("email", email).limit(1);
  if (ignoredId) query = query.neq("id", ignoredId);
  const { data, error } = await query;
  if (error) throw error;
  if (data?.length) throw new ApiError(409, "EMAIL_ALREADY_EXISTS", "Este e-mail já está cadastrado.");
  const authUser = await findAuthByEmail(admin, email);
  if (authUser && authUser.id !== ignoredId) throw new ApiError(409, "EMAIL_ALREADY_EXISTS", "Este e-mail já está cadastrado.");
}

async function ensureNotLastAdmin(admin: SupabaseClient, profile: Profile, nextType: UserType, nextActive: boolean) {
  if (profile.tipo !== "administrador" || !profile.ativo || (nextType === "administrador" && nextActive)) return;
  const { count, error } = await admin.from("usuarios").select("id", { count: "exact", head: true }).eq("tipo", "administrador").eq("ativo", true);
  if (error) throw error;
  if ((count || 0) <= 1) throw new ApiError(409, "LAST_ACTIVE_ADMIN", "Não é possível remover ou inativar o último administrador ativo.");
}

async function createUser(admin: SupabaseClient, actorId: string, data: Payload, origin: string | null) {
  const nome = validName(data.nome), email = validEmail(data.email), senha = validPassword(data.senha), tipo = validType(data.tipo);
  await ensureEmailAvailable(admin, email);
  const { data: created, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
  if (error) {
    if (duplicate(error)) throw new ApiError(409, "EMAIL_ALREADY_EXISTS", "Este e-mail já está cadastrado.");
    throw error;
  }
  const id = created.user?.id;
  if (!id) throw new Error("Auth não retornou UUID do usuário.");
  const { data: profile, error: profileError } = await admin.from("usuarios").insert({ id, nome, email, tipo, ativo: true }).select("id, nome, email, tipo, ativo").single();
  if (profileError) {
    const { error: rollbackError } = await admin.auth.admin.deleteUser(id);
    logError("Falha ao criar perfil; compensação executada", profileError, { actorId, targetId: id });
    if (rollbackError) logError("Falha na compensação da criação", rollbackError, { actorId, targetId: id });
    await audit(admin, actorId, id, "falha_criacao", { compensacao_falhou: Boolean(rollbackError) });
    throw new Error("Falha consistente ao criar usuário.");
  }
  await audit(admin, actorId, id, "criacao", { tipo });
  return success(201, "Usuário cadastrado com sucesso.", profile, origin);
}

async function updateUser(admin: SupabaseClient, actorId: string, data: Payload, origin: string | null) {
  const id = validId(data.id);
  if (Object.hasOwn(data, "senha")) throw new ApiError(400, "INVALID_DATA", "A senha não pode ser alterada nesta operação.");
  const current = await profileById(admin, id);
  if (!current) throw new ApiError(404, "USER_NOT_FOUND", "Usuário não encontrado.");
  const changes: Partial<Profile> = {};
  if (Object.hasOwn(data, "nome")) changes.nome = validName(data.nome);
  if (Object.hasOwn(data, "email")) changes.email = validEmail(data.email);
  if (Object.hasOwn(data, "tipo")) changes.tipo = validType(data.tipo);
  if (Object.hasOwn(data, "ativo")) {
    if (typeof data.ativo !== "boolean") throw new ApiError(400, "INVALID_DATA", "Status inválido.");
    changes.ativo = data.ativo;
  }
  if (!Object.keys(changes).length) throw new ApiError(400, "INVALID_DATA", "Nenhuma alteração foi informada.");
  const next = { ...current, ...changes };
  if (id === actorId && next.ativo === false) throw new ApiError(409, "SELF_DEACTIVATE", "Você não pode inativar sua própria conta.");
  await ensureNotLastAdmin(admin, current, next.tipo, next.ativo);
  if (changes.email && changes.email !== current.email) await ensureEmailAvailable(admin, changes.email, id);
  const oldAuth = await authById(admin, id);
  if (!oldAuth) throw new ApiError(404, "USER_NOT_FOUND", "Usuário não encontrado.");
  const authChanges: Payload = {};
  if (changes.email && changes.email !== current.email) Object.assign(authChanges, { email: changes.email, email_confirm: true });
  if (changes.ativo !== undefined) authChanges.ban_duration = changes.ativo ? "none" : BAN_DURATION;
  let authChanged = false;
  if (Object.keys(authChanges).length) {
    const { error } = await admin.auth.admin.updateUserById(id, authChanges);
    if (error) {
      if (duplicate(error)) throw new ApiError(409, "EMAIL_ALREADY_EXISTS", "Este e-mail já está cadastrado.");
      throw error;
    }
    authChanged = true;
  }
  const { data: profile, error } = await admin.from("usuarios").update(changes).eq("id", id).select("id, nome, email, tipo, ativo").single();
  if (error) {
    if (authChanged) {
      const { error: rollbackError } = await admin.auth.admin.updateUserById(id, { email: oldAuth.email, email_confirm: Boolean(oldAuth.email_confirmed_at), ban_duration: current.ativo ? "none" : BAN_DURATION });
      if (rollbackError) logError("Falha na compensação da edição", rollbackError, { actorId, targetId: id });
    }
    logError("Falha ao atualizar perfil", error, { actorId, targetId: id });
    throw new Error("Falha consistente ao atualizar usuário.");
  }
  await audit(admin, actorId, id, "edicao", { campos: Object.keys(changes) });
  return success(200, "Usuário atualizado com sucesso.", profile, origin);
}

async function setStatus(admin: SupabaseClient, actorId: string, data: Payload, active: boolean, origin: string | null) {
  const id = validId(data.id);
  const current = await profileById(admin, id);
  if (!current) throw new ApiError(404, "USER_NOT_FOUND", "Usuário não encontrado.");
  if (!active && id === actorId) throw new ApiError(409, "SELF_DEACTIVATE", "Você não pode inativar sua própria conta.");
  await ensureNotLastAdmin(admin, current, current.tipo, active);
  const authUser = await authById(admin, id);
  if (!authUser) throw new ApiError(404, "USER_NOT_FOUND", "Usuário não encontrado.");
  const { error: authError } = await admin.auth.admin.updateUserById(id, { ban_duration: active ? "none" : BAN_DURATION });
  if (authError) throw authError;
  const { data: profile, error } = await admin.from("usuarios").update({ ativo: active }).eq("id", id).select("id, nome, email, tipo, ativo").single();
  if (error) {
    const { error: rollbackError } = await admin.auth.admin.updateUserById(id, { ban_duration: current.ativo ? "none" : BAN_DURATION });
    logError("Falha ao atualizar status", error, { actorId, targetId: id });
    if (rollbackError) logError("Falha na compensação de status", rollbackError, { actorId, targetId: id });
    throw new Error("Falha consistente ao atualizar status.");
  }
  await audit(admin, actorId, id, active ? "ativacao" : "inativacao");
  return success(200, active ? "Usuário ativado com sucesso." : "Usuário inativado com sucesso.", profile, origin);
}

async function deleteUser(admin: SupabaseClient, actorId: string, data: Payload, origin: string | null) {
  const id = validId(data.id);
  if (id === actorId) throw new ApiError(409, "SELF_DELETE", "Você não pode excluir sua própria conta.");
  const profile = await profileById(admin, id);
  const authUser = await authById(admin, id);
  if (!profile && !authUser) return success(200, "Usuário já estava excluído.", { id }, origin);
  if (profile) await ensureNotLastAdmin(admin, profile, "coletor", false);
  if (profile) {
    const { error } = await admin.from("usuarios").delete().eq("id", id);
    if (error) throw error;
  }
  if (authUser) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error && !notFound(error)) {
      if (profile) {
        const { error: rollbackError } = await admin.from("usuarios").insert(profile);
        if (rollbackError) logError("Falha na compensação da exclusão", rollbackError, { actorId, targetId: id });
      }
      logError("Falha ao excluir usuário do Auth", error, { actorId, targetId: id });
      throw new Error("Falha consistente ao excluir usuário.");
    }
  }
  await audit(admin, actorId, id, "exclusao", { perfil_existia: Boolean(profile), auth_existia: Boolean(authUser) });
  return success(200, "Usuário excluído com sucesso.", { id }, origin);
}

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (request.method !== "POST") return json(400, { success: false, code: "INVALID_DATA", message: "Requisição inválida." }, origin);
  try {
    const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anon || !service) throw new Error("Configuração obrigatória ausente.");
    const authClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const actorId = await authorize(request, authClient, admin);
    const body = await request.json().catch(() => { throw new ApiError(400, "INVALID_DATA", "Corpo da requisição inválido."); });
    const action = body?.action as Action, data = body?.data;
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new ApiError(400, "INVALID_DATA", "Dados da operação inválidos.");
    if (action === "create") return await createUser(admin, actorId, data, origin);
    if (action === "update") return await updateUser(admin, actorId, data, origin);
    if (action === "activate") return await setStatus(admin, actorId, data, true, origin);
    if (action === "deactivate") return await setStatus(admin, actorId, data, false, origin);
    if (action === "delete") return await deleteUser(admin, actorId, data, origin);
    throw new ApiError(400, "INVALID_DATA", "Ação administrativa inválida.");
  } catch (error) {
    if (error instanceof ApiError) return json(error.status, { success: false, code: error.code, message: error.message }, origin);
    logError("Falha interna em admin-users", error);
    return json(500, { success: false, code: "UNEXPECTED_ERROR", message: "Não foi possível concluir a operação. Tente novamente." }, origin);
  }
});
