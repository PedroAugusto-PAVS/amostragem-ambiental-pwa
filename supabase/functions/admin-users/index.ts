import {
  createClient,
  type SupabaseClient,
  type User
} from "npm:@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json; charset=utf-8"
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USER_TYPES = new Set(["admin", "coletor"]);
const LONG_BAN_DURATION = "876000h";

type Action = "create" | "update" | "activate" | "deactivate" | "delete";
type UserType = "admin" | "coletor";

interface UserProfile {
  id: string;
  nome: string;
  email: string;
  tipo: UserType;
  ativo: boolean;
  criado_em?: string;
  atualizado_em?: string;
}

interface RequestBody {
  action?: Action;
  id?: string;
  nome?: string;
  email?: string;
  senha?: string;
  tipo?: UserType;
  ativo?: boolean;
}

class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function normalizeName(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function validateId(id: unknown) {
  const normalized = String(id || "").trim();

  if (!UUID_PATTERN.test(normalized)) {
    throw new ApiError(400, "INVALID_DATA", "ID de usuário inválido.");
  }

  return normalized;
}

function validateEmail(email: unknown) {
  const normalized = normalizeEmail(email);

  if (!EMAIL_PATTERN.test(normalized) || normalized.length > 254) {
    throw new ApiError(400, "INVALID_EMAIL", "Informe um e-mail válido.");
  }

  return normalized;
}

function validateName(name: unknown) {
  const normalized = normalizeName(name);

  if (normalized.length < 2 || normalized.length > 120) {
    throw new ApiError(400, "INVALID_DATA", "Informe um nome válido.");
  }

  return normalized;
}

function validateType(type: unknown): UserType {
  if (!USER_TYPES.has(String(type))) {
    throw new ApiError(400, "INVALID_DATA", "Tipo de usuário inválido.");
  }

  return type as UserType;
}

function validatePassword(password: unknown) {
  const normalized = String(password || "");

  if (normalized.length < 6) {
    throw new ApiError(
      400,
      "PASSWORD_TOO_SHORT",
      "A senha deve possuir pelo menos 6 caracteres."
    );
  }

  if (normalized.length > 128) {
    throw new ApiError(400, "INVALID_DATA", "A senha informada é muito longa.");
  }

  return normalized;
}

function isDuplicateAuthError(error: { code?: string; message?: string } | null) {
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();
  return code.includes("exists") || message.includes("already") || message.includes("registered");
}

function isLastAdminError(error: { message?: string } | null) {
  return String(error?.message || "").toLowerCase().includes("último administrador ativo") ||
    String(error?.message || "").toLowerCase().includes("ultimo administrador ativo");
}

function isAuthNotFound(error: { status?: number; code?: string; message?: string } | null) {
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();
  return error?.status === 404 || code.includes("not_found") || message.includes("not found");
}

async function findAuthUserByEmail(admin: SupabaseClient, email: string) {
  const perPage = 1000;

  for (let page = 1; page <= 1000; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });

    if (error) throw error;

    const found = data.users.find((user) => normalizeEmail(user.email) === email);

    if (found) return found;
    if (data.users.length < perPage) return null;
  }

  throw new Error("Limite de paginação de usuários excedido.");
}

async function getProfile(admin: SupabaseClient, id: string) {
  const { data, error } = await admin
    .from("usuarios")
    .select("id, nome, email, tipo, ativo, criado_em, atualizado_em")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new ApiError(404, "USER_NOT_FOUND", "Usuário não encontrado.");
  return data as UserProfile;
}

async function ensureEmailAvailable(
  admin: SupabaseClient,
  email: string,
  ignoredUserId?: string
) {
  let profileQuery = admin.from("usuarios").select("id").ilike("email", email).limit(1);

  if (ignoredUserId) profileQuery = profileQuery.neq("id", ignoredUserId);

  const { data: profiles, error: profileError } = await profileQuery;

  if (profileError) throw profileError;
  if (profiles && profiles.length > 0) {
    throw new ApiError(409, "EMAIL_EXISTS", "Este e-mail já está cadastrado.");
  }

  const authUser = await findAuthUserByEmail(admin, email);

  if (authUser && authUser.id !== ignoredUserId) {
    throw new ApiError(409, "EMAIL_EXISTS", "Este e-mail já está cadastrado.");
  }
}

async function ensureCanRemoveAdminPrivilege(
  admin: SupabaseClient,
  target: UserProfile,
  nextType: UserType,
  nextActive: boolean
) {
  const removesPrivilege =
    target.tipo === "admin" && target.ativo !== false &&
    (nextType !== "admin" || nextActive === false);

  if (!removesPrivilege) return;

  const { count, error } = await admin
    .from("usuarios")
    .select("id", { count: "exact", head: true })
    .eq("tipo", "admin")
    .eq("ativo", true);

  if (error) throw error;
  if ((count || 0) <= 1) {
    throw new ApiError(
      409,
      "LAST_ACTIVE_ADMIN",
      "O último administrador ativo não pode ser alterado."
    );
  }
}

async function getAuthUser(admin: SupabaseClient, id: string) {
  const { data, error } = await admin.auth.admin.getUserById(id);

  if (error) throw error;
  if (!data.user) throw new ApiError(404, "USER_NOT_FOUND", "Usuário não encontrado.");
  return data.user;
}

async function rollbackAuthUser(
  admin: SupabaseClient,
  authUser: User,
  profile: UserProfile
) {
  const { error } = await admin.auth.admin.updateUserById(authUser.id, {
    email: authUser.email,
    email_confirm: Boolean(authUser.email_confirmed_at),
    ban_duration: profile.ativo === false ? LONG_BAN_DURATION : "none",
    user_metadata: authUser.user_metadata
  });

  if (error) throw error;
}

async function handleCreate(admin: SupabaseClient, body: RequestBody) {
  const name = validateName(body.nome);
  const email = validateEmail(body.email);
  const password = validatePassword(body.senha);
  const type = validateType(body.tipo);

  await ensureEmailAvailable(admin, email);

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome: name, tipo: type }
  });

  if (authError) {
    if (isDuplicateAuthError(authError)) {
      throw new ApiError(409, "EMAIL_EXISTS", "Este e-mail já está cadastrado.");
    }
    throw authError;
  }

  const userId = authData.user?.id;

  if (!userId) throw new Error("Supabase Auth não retornou o ID do usuário.");

  const { data: profile, error: profileError } = await admin
    .from("usuarios")
    .insert({
      id: userId,
      nome: name,
      email,
      tipo: type,
      ativo: true
    })
    .select("id, nome, email, tipo, ativo, criado_em, atualizado_em")
    .single();

  if (profileError) {
    const { error: rollbackError } = await admin.auth.admin.deleteUser(userId);

    if (rollbackError) {
      console.error("Rollback da criação falhou", {
        userId,
        profileError: profileError.message,
        rollbackError: rollbackError.message
      });
    }

    throw new Error("Falha ao criar o perfil do usuário.");
  }

  return response(201, { ok: true, user: profile });
}

async function handleUpdate(
  admin: SupabaseClient,
  actorId: string,
  body: RequestBody
) {
  const id = validateId(body.id);
  const name = validateName(body.nome);
  const email = validateEmail(body.email);
  const type = validateType(body.tipo);

  if (typeof body.ativo !== "boolean") {
    throw new ApiError(400, "INVALID_DATA", "Status do usuário inválido.");
  }

  const active = body.ativo !== false;
  const oldProfile = await getProfile(admin, id);

  if (id === actorId && !active) {
    throw new ApiError(409, "SELF_DEACTIVATE", "Você não pode inativar sua própria conta.");
  }

  await ensureCanRemoveAdminPrivilege(admin, oldProfile, type, active);
  await ensureEmailAvailable(admin, email, id);

  const oldAuthUser = await getAuthUser(admin, id);
  const { error: authError } = await admin.auth.admin.updateUserById(id, {
    email,
    email_confirm: true,
    ban_duration: active ? "none" : LONG_BAN_DURATION,
    user_metadata: {
      ...oldAuthUser.user_metadata,
      nome: name,
      tipo: type
    }
  });

  if (authError) {
    if (isDuplicateAuthError(authError)) {
      throw new ApiError(409, "EMAIL_EXISTS", "Este e-mail já está cadastrado.");
    }
    throw authError;
  }

  const { data: profile, error: profileError } = await admin
    .from("usuarios")
    .update({ nome: name, email, tipo: type, ativo: active })
    .eq("id", id)
    .select("id, nome, email, tipo, ativo, criado_em, atualizado_em")
    .single();

  if (profileError) {
    try {
      await rollbackAuthUser(admin, oldAuthUser, oldProfile);
    } catch (rollbackError) {
      console.error("Rollback da edição falhou", {
        userId: id,
        profileError: profileError.message,
        rollbackError: rollbackError instanceof Error ? rollbackError.message : rollbackError
      });
    }

    if (isLastAdminError(profileError)) {
      throw new ApiError(409, "LAST_ACTIVE_ADMIN", "O último administrador ativo não pode ser alterado.");
    }
    throw new Error("Falha ao atualizar o perfil do usuário.");
  }

  return response(200, { ok: true, user: profile });
}

async function handleStatus(
  admin: SupabaseClient,
  actorId: string,
  body: RequestBody,
  active: boolean
) {
  const id = validateId(body.id);
  const oldProfile = await getProfile(admin, id);

  if (!active && id === actorId) {
    throw new ApiError(409, "SELF_DEACTIVATE", "Você não pode inativar sua própria conta.");
  }

  await ensureCanRemoveAdminPrivilege(admin, oldProfile, oldProfile.tipo, active);
  await getAuthUser(admin, id);

  const { error: authError } = await admin.auth.admin.updateUserById(id, {
    ban_duration: active ? "none" : LONG_BAN_DURATION
  });

  if (authError) throw authError;

  const { data: profile, error: profileError } = await admin
    .from("usuarios")
    .update({ ativo: active })
    .eq("id", id)
    .select("id, nome, email, tipo, ativo, criado_em, atualizado_em")
    .single();

  if (profileError) {
    const { error: rollbackError } = await admin.auth.admin.updateUserById(id, {
      ban_duration: oldProfile.ativo === false ? LONG_BAN_DURATION : "none"
    });

    if (rollbackError) {
      console.error("Rollback de status falhou", {
        userId: id,
        profileError: profileError.message,
        rollbackError: rollbackError.message
      });
    }

    if (isLastAdminError(profileError)) {
      throw new ApiError(409, "LAST_ACTIVE_ADMIN", "O último administrador ativo não pode ser alterado.");
    }
    throw new Error("Falha ao atualizar o status do usuário.");
  }

  return response(200, { ok: true, user: profile });
}

async function handleDelete(
  admin: SupabaseClient,
  actorId: string,
  body: RequestBody
) {
  const id = validateId(body.id);

  if (id === actorId) {
    throw new ApiError(409, "SELF_DELETE", "Você não pode excluir sua própria conta.");
  }

  const profile = await getProfile(admin, id);
  await ensureCanRemoveAdminPrivilege(admin, profile, "coletor", false);

  const { error: authError } = await admin.auth.admin.deleteUser(id);

  if (authError && !isAuthNotFound(authError)) {
    if (isLastAdminError(authError)) {
      throw new ApiError(409, "LAST_ACTIVE_ADMIN", "O último administrador ativo não pode ser excluído.");
    }
    throw authError;
  }

  const { data: remainingProfile, error: profileReadError } = await admin
    .from("usuarios")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (profileReadError) throw profileReadError;

  if (remainingProfile) {
    const { error: profileDeleteError } = await admin
      .from("usuarios")
      .delete()
      .eq("id", id);

    if (profileDeleteError) {
      if (isLastAdminError(profileDeleteError)) {
        throw new ApiError(409, "LAST_ACTIVE_ADMIN", "O último administrador ativo não pode ser excluído.");
      }
      throw new Error("O acesso foi removido, mas o perfil exige limpeza administrativa.");
    }
  }

  return response(200, { ok: true });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return response(405, { ok: false, code: "INVALID_DATA", message: "Método não permitido." });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = request.headers.get("Authorization") || "";
    const accessToken = authorization.replace(/^Bearer\s+/i, "");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error("Secrets obrigatórios da Edge Function não estão disponíveis.");
    }

    if (!accessToken || accessToken === authorization) {
      throw new ApiError(401, "NO_PERMISSION", "Sessão inválida.");
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);

    if (authError || !authData.user) {
      throw new ApiError(401, "NO_PERMISSION", "Sessão inválida.");
    }

    const { data: actorProfile, error: actorError } = await admin
      .from("usuarios")
      .select("id, tipo, ativo")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (actorError) throw actorError;
    if (!actorProfile || actorProfile.ativo === false) {
      throw new ApiError(403, "USER_INACTIVE", "Seu usuário está inativo.");
    }
    if (actorProfile.tipo !== "admin") {
      throw new ApiError(403, "NO_PERMISSION", "Operação permitida apenas para administradores.");
    }

    let body: RequestBody;

    try {
      body = await request.json();
    } catch (_error) {
      throw new ApiError(400, "INVALID_DATA", "Corpo da requisição inválido.");
    }

    switch (body.action) {
      case "create":
        return await handleCreate(admin, body);
      case "update":
        return await handleUpdate(admin, authData.user.id, body);
      case "activate":
        return await handleStatus(admin, authData.user.id, body, true);
      case "deactivate":
        return await handleStatus(admin, authData.user.id, body, false);
      case "delete":
        return await handleDelete(admin, authData.user.id, body);
      default:
        throw new ApiError(400, "INVALID_DATA", "Ação administrativa inválida.");
    }
  } catch (error) {
    if (error instanceof ApiError) {
      return response(error.status, { ok: false, code: error.code, message: error.message });
    }

    console.error("Falha inesperada em admin-users", {
      message: error instanceof Error ? error.message : String(error)
    });
    return response(500, {
      ok: false,
      code: "UNEXPECTED",
      message: "Não foi possível concluir a operação. Tente novamente."
    });
  }
});
