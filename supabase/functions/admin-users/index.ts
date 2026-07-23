import {
  createClient,
  type SupabaseClient,
  type User,
} from "npm:@supabase/supabase-js@2.95.0";

type Action =
  | "create"
  | "update"
  | "activate"
  | "deactivate"
  | "delete";

/*
 * O banco do HydroTrack utiliza:
 * - admin
 * - coletor
 *
 * O frontend pode enviar "administrador".
 * A função converte automaticamente para "admin".
 */
type DatabaseUserType = "admin" | "coletor";

type Profile = {
  id: string;
  nome: string;
  email: string;
  tipo: DatabaseUserType;
  ativo: boolean;
  admin_principal: boolean;
  criado_em?: string;
  atualizado_em?: string;
};

type Payload = Record<string, unknown>;

const EMAIL_REGEX =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/*
 * Aproximadamente 100 anos.
 * Utilizado para impedir login de usuário inativo.
 */
const BAN_DURATION = "876000h";

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

function cors(origin: string | null) {
  const configuredOrigins = (
    Deno.env.get("ALLOWED_ORIGINS") || ""
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const defaultOrigins = [
    Deno.env.get("SUPABASE_URL") || "",
    "capacitor://localhost",
    "http://localhost",
  ];

  const allowedOrigins = new Set([
    ...configuredOrigins,
    ...defaultOrigins,
  ]);

  const isLocalDevelopment = Boolean(
    origin &&
      /^http:\/\/localhost(?::\d+)?$/.test(origin),
  );

  const allowedOrigin =
    origin &&
    (
      allowedOrigins.has(origin) ||
      isLocalDevelopment
    )
      ? origin
      : "null";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods":
      "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  origin: string | null,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...cors(origin),
        "Content-Type":
          "application/json; charset=utf-8",
      },
    },
  );
}

function successResponse(
  status: number,
  message: string,
  data: unknown,
  origin: string | null,
) {
  return jsonResponse(
    status,
    {
      success: true,
      message,
      data,
    },
    origin,
  );
}

function normalizeEmail(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function normalizeName(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

/*
 * Aceita o valor utilizado pela interface:
 * - administrador
 *
 * E converte para o valor real do banco:
 * - admin
 */
function normalizeUserType(
  value: unknown,
): DatabaseUserType {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (
    normalized === "admin" ||
    normalized === "administrador"
  ) {
    return "admin";
  }

  if (normalized === "coletor") {
    return "coletor";
  }

  throw new ApiError(
    400,
    "INVALID_TYPE",
    "Informe um tipo de usuário válido.",
  );
}

function validateId(value: unknown) {
  const id = String(value ?? "").trim();

  if (!UUID_REGEX.test(id)) {
    throw new ApiError(
      400,
      "INVALID_DATA",
      "Identificador de usuário inválido.",
    );
  }

  return id;
}

function validateEmail(value: unknown) {
  const email = normalizeEmail(value);

  if (
    !EMAIL_REGEX.test(email) ||
    email.length > 254
  ) {
    throw new ApiError(
      400,
      "INVALID_EMAIL",
      "Informe um e-mail válido.",
    );
  }

  return email;
}

function validateName(value: unknown) {
  const name = normalizeName(value);

  if (
    name.length < 2 ||
    name.length > 120
  ) {
    throw new ApiError(
      400,
      "INVALID_NAME",
      "Informe um nome válido.",
    );
  }

  return name;
}

function validatePassword(value: unknown) {
  const password = String(value ?? "");

  if (password.length < 6) {
    throw new ApiError(
      400,
      "PASSWORD_TOO_SHORT",
      "A senha deve possuir pelo menos 6 caracteres.",
    );
  }

  if (password.length > 128) {
    throw new ApiError(
      400,
      "INVALID_DATA",
      "A senha informada é muito longa.",
    );
  }

  return password;
}

function isDuplicateError(
  error:
    | {
        code?: string;
        message?: string;
      }
    | null,
) {
  const text = `${
    error?.code || ""
  } ${error?.message || ""}`.toLowerCase();

  return (
    text.includes("already") ||
    text.includes("exists") ||
    text.includes("registered") ||
    text.includes("duplicate") ||
    text.includes("unique")
  );
}

function isNotFoundError(
  error:
    | {
        status?: number;
        code?: string;
        message?: string;
      }
    | null,
) {
  const text = `${
    error?.code || ""
  } ${error?.message || ""}`.toLowerCase();

  return (
    error?.status === 404 ||
    text.includes("not_found") ||
    text.includes("not found")
  );
}

function logError(
  context: string,
  error: unknown,
  ids: Record<string, unknown> = {},
) {
  console.error(context, {
    ...ids,
    message:
      error instanceof Error
        ? error.message
        : String(error),
  });
}

/*
 * A auditoria não impede a operação principal.
 * Caso logs_usuarios não exista, apenas registra
 * o erro no log da Edge Function.
 */
async function audit(
  admin: SupabaseClient,
  actorId: string,
  targetId: string | null,
  action: string,
  details: Payload = {},
) {
  const { error } = await admin
    .from("logs_usuarios")
    .insert({
      ator_id: actorId,
      alvo_id: targetId,
      acao: action,
      detalhes: details,
    });

  if (error) {
    logError(
      "Falha ao registrar auditoria",
      error,
      {
        actorId,
        targetId,
        action,
      },
    );
  }
}

async function authorize(
  request: Request,
  authClient: SupabaseClient,
  admin: SupabaseClient,
) {
  const authorization =
    request.headers.get("Authorization") || "";

  const match =
    authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    throw new ApiError(
      401,
      "UNAUTHORIZED",
      "Sessão ausente ou inválida.",
    );
  }

  const accessToken = match[1];

  const {
    data,
    error,
  } = await authClient.auth.getUser(
    accessToken,
  );

  if (
    error ||
    !data.user
  ) {
    throw new ApiError(
      401,
      "UNAUTHORIZED",
      "Sessão ausente ou inválida.",
    );
  }

  const {
    data: profile,
    error: profileError,
  } = await admin
    .from("usuarios")
    .select(
      `
        id,
        tipo,
        ativo,
        admin_principal
      `,
    )
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  /*
   * Todos os administradores ativos podem:
   * - criar;
   * - editar;
   * - ativar;
   * - inativar.
   *
   * A permissão especial de exclusão será
   * verificada separadamente.
   */
  if (
    !profile ||
    profile.ativo !== true ||
    profile.tipo !== "admin"
  ) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "Você não possui permissão para realizar esta operação.",
    );
  }

  return {
    actorId: data.user.id,
    actorProfile: {
      id: profile.id,
      tipo: profile.tipo as DatabaseUserType,
      ativo: profile.ativo === true,
      admin_principal:
        profile.admin_principal === true,
    },
  };
}

async function findAuthUserByEmail(
  admin: SupabaseClient,
  email: string,
) {
  const perPage = 200;
  const maxPages = 500;

  for (
    let page = 1;
    page <= maxPages;
    page++
  ) {
    const {
      data,
      error,
    } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw error;
    }

    const found = data.users.find(
      (user) =>
        normalizeEmail(user.email) === email,
    );

    if (found) {
      return found;
    }

    if (
      data.users.length < perPage
    ) {
      return null;
    }
  }

  throw new Error(
    "Limite controlado de paginação do Auth excedido.",
  );
}

async function authUserById(
  admin: SupabaseClient,
  id: string,
): Promise<User | null> {
  const {
    data,
    error,
  } = await admin.auth.admin.getUserById(id);

  if (
    error &&
    isNotFoundError(error)
  ) {
    return null;
  }

  if (error) {
    throw error;
  }

  return data.user || null;
}

async function profileById(
  admin: SupabaseClient,
  id: string,
): Promise<Profile | null> {
  const {
    data,
    error,
  } = await admin
    .from("usuarios")
    .select(
      `
        id,
        nome,
        email,
        tipo,
        ativo,
        admin_principal,
        criado_em,
        atualizado_em
      `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as Profile | null;
}

async function ensureEmailAvailable(
  admin: SupabaseClient,
  email: string,
  ignoredId?: string,
) {
  let query = admin
    .from("usuarios")
    .select("id")
    .ilike("email", email)
    .limit(1);

  if (ignoredId) {
    query = query.neq("id", ignoredId);
  }

  const {
    data,
    error,
  } = await query;

  if (error) {
    throw error;
  }

  if (data?.length) {
    throw new ApiError(
      409,
      "EMAIL_ALREADY_EXISTS",
      "Este e-mail já está cadastrado.",
    );
  }

  const authUser =
    await findAuthUserByEmail(
      admin,
      email,
    );

  if (
    authUser &&
    authUser.id !== ignoredId
  ) {
    throw new ApiError(
      409,
      "EMAIL_ALREADY_EXISTS",
      "Este e-mail já está cadastrado.",
    );
  }
}

async function ensureNotLastActiveAdmin(
  admin: SupabaseClient,
  currentProfile: Profile,
  nextType: DatabaseUserType,
  nextActive: boolean,
) {
  const currentlyActiveAdmin =
    currentProfile.tipo === "admin" &&
    currentProfile.ativo === true;

  const remainsActiveAdmin =
    nextType === "admin" &&
    nextActive === true;

  if (
    !currentlyActiveAdmin ||
    remainsActiveAdmin
  ) {
    return;
  }

  const {
    count,
    error,
  } = await admin
    .from("usuarios")
    .select(
      "id",
      {
        count: "exact",
        head: true,
      },
    )
    .eq("tipo", "admin")
    .eq("ativo", true);

  if (error) {
    throw error;
  }

  if ((count || 0) <= 1) {
    throw new ApiError(
      409,
      "LAST_ACTIVE_ADMIN",
      "Não é possível remover ou inativar o último administrador ativo.",
    );
  }
}

async function createUser(
  admin: SupabaseClient,
  actorId: string,
  data: Payload,
  origin: string | null,
) {
  const nome =
    validateName(data.nome);

  const email =
    validateEmail(data.email);

  const senha =
    validatePassword(data.senha);

  const tipo =
    normalizeUserType(data.tipo);

  await ensureEmailAvailable(
    admin,
    email,
  );

  const {
    data: created,
    error: createAuthError,
  } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });

  if (createAuthError) {
    if (
      isDuplicateError(createAuthError)
    ) {
      throw new ApiError(
        409,
        "EMAIL_ALREADY_EXISTS",
        "Este e-mail já está cadastrado.",
      );
    }

    throw createAuthError;
  }

  const id = created.user?.id;

  if (!id) {
    throw new Error(
      "O Supabase Auth não retornou o UUID do usuário.",
    );
  }

  const {
    data: profile,
    error: profileError,
  } = await admin
    .from("usuarios")
    .insert({
      id,
      nome,
      email,
      tipo,
      ativo: true,
      admin_principal: false,
    })
    .select(
      `
        id,
        nome,
        email,
        tipo,
        ativo,
        admin_principal
      `,
    )
    .single();

  if (profileError) {
    const {
      error: rollbackError,
    } = await admin.auth.admin.deleteUser(id);

    logError(
      "Falha ao criar perfil; compensação executada",
      profileError,
      {
        actorId,
        targetId: id,
      },
    );

    if (rollbackError) {
      logError(
        "Falha na compensação da criação",
        rollbackError,
        {
          actorId,
          targetId: id,
        },
      );
    }

    await audit(
      admin,
      actorId,
      id,
      "falha_criacao",
      {
        compensacao_falhou:
          Boolean(rollbackError),
      },
    );

    throw new Error(
      "Falha consistente ao criar usuário.",
    );
  }

  await audit(
    admin,
    actorId,
    id,
    "criacao",
    {
      tipo,
    },
  );

  return successResponse(
    201,
    "Usuário cadastrado com sucesso.",
    profile,
    origin,
  );
}

async function updateUser(
  admin: SupabaseClient,
  actorId: string,
  data: Payload,
  origin: string | null,
) {
  const id = validateId(data.id);

  if (
    Object.hasOwn(data, "senha")
  ) {
    throw new ApiError(
      400,
      "INVALID_DATA",
      "A senha não pode ser alterada nesta operação.",
    );
  }

  const current =
    await profileById(admin, id);

  if (!current) {
    throw new ApiError(
      404,
      "USER_NOT_FOUND",
      "Usuário não encontrado.",
    );
  }

  const changes:
    Partial<Profile> = {};

  if (
    Object.hasOwn(data, "nome")
  ) {
    changes.nome =
      validateName(data.nome);
  }

  if (
    Object.hasOwn(data, "email")
  ) {
    changes.email =
      validateEmail(data.email);
  }

  if (
    Object.hasOwn(data, "tipo")
  ) {
    changes.tipo =
      normalizeUserType(data.tipo);
  }

  if (
    Object.hasOwn(data, "ativo")
  ) {
    if (
      typeof data.ativo !== "boolean"
    ) {
      throw new ApiError(
        400,
        "INVALID_DATA",
        "Status inválido.",
      );
    }

    changes.ativo = data.ativo;
  }

  if (
    !Object.keys(changes).length
  ) {
    throw new ApiError(
      400,
      "INVALID_DATA",
      "Nenhuma alteração foi informada.",
    );
  }

  const next = {
    ...current,
    ...changes,
  };

  if (
    id === actorId &&
    next.ativo === false
  ) {
    throw new ApiError(
      409,
      "SELF_DEACTIVATE",
      "Você não pode inativar sua própria conta.",
    );
  }

  /*
   * O administrador principal não pode:
   * - ser inativado;
   * - deixar de ser administrador.
   */
  if (
    current.admin_principal === true &&
    (
      next.ativo === false ||
      next.tipo !== "admin"
    )
  ) {
    throw new ApiError(
      409,
      "MAIN_ADMIN_PROTECTED",
      "O administrador principal não pode ser inativado ou transformado em coletor.",
    );
  }

  await ensureNotLastActiveAdmin(
    admin,
    current,
    next.tipo,
    next.ativo,
  );

  if (
    changes.email &&
    changes.email !== current.email
  ) {
    await ensureEmailAvailable(
      admin,
      changes.email,
      id,
    );
  }

  const oldAuth =
    await authUserById(admin, id);

  if (!oldAuth) {
    throw new ApiError(
      404,
      "USER_NOT_FOUND",
      "Usuário não encontrado.",
    );
  }

  const authChanges:
    Record<string, unknown> = {};

  if (
    changes.email &&
    changes.email !== current.email
  ) {
    Object.assign(
      authChanges,
      {
        email: changes.email,
        email_confirm: true,
      },
    );
  }

  if (
    changes.ativo !== undefined
  ) {
    authChanges.ban_duration =
      changes.ativo
        ? "none"
        : BAN_DURATION;
  }

  let authChanged = false;

  if (
    Object.keys(authChanges).length
  ) {
    const {
      error: updateAuthError,
    } =
      await admin.auth.admin.updateUserById(
        id,
        authChanges,
      );

    if (updateAuthError) {
      if (
        isDuplicateError(updateAuthError)
      ) {
        throw new ApiError(
          409,
          "EMAIL_ALREADY_EXISTS",
          "Este e-mail já está cadastrado.",
        );
      }

      throw updateAuthError;
    }

    authChanged = true;
  }

  const {
    data: profile,
    error: updateProfileError,
  } = await admin
    .from("usuarios")
    .update(changes)
    .eq("id", id)
    .select(
      `
        id,
        nome,
        email,
        tipo,
        ativo,
        admin_principal
      `,
    )
    .single();

  if (updateProfileError) {
    if (authChanged) {
      const {
        error: rollbackError,
      } =
        await admin.auth.admin.updateUserById(
          id,
          {
            email:
              oldAuth.email ||
              current.email,

            email_confirm:
              Boolean(
                oldAuth.email_confirmed_at,
              ),

            ban_duration:
              current.ativo
                ? "none"
                : BAN_DURATION,
          },
        );

      if (rollbackError) {
        logError(
          "Falha na compensação da edição",
          rollbackError,
          {
            actorId,
            targetId: id,
          },
        );
      }
    }

    logError(
      "Falha ao atualizar perfil",
      updateProfileError,
      {
        actorId,
        targetId: id,
      },
    );

    throw new Error(
      "Falha consistente ao atualizar usuário.",
    );
  }

  await audit(
    admin,
    actorId,
    id,
    "edicao",
    {
      campos: Object.keys(changes),
    },
  );

  return successResponse(
    200,
    "Usuário atualizado com sucesso.",
    profile,
    origin,
  );
}

async function setStatus(
  admin: SupabaseClient,
  actorId: string,
  data: Payload,
  active: boolean,
  origin: string | null,
) {
  const id = validateId(data.id);

  const current =
    await profileById(admin, id);

  if (!current) {
    throw new ApiError(
      404,
      "USER_NOT_FOUND",
      "Usuário não encontrado.",
    );
  }

  if (
    !active &&
    id === actorId
  ) {
    throw new ApiError(
      409,
      "SELF_DEACTIVATE",
      "Você não pode inativar sua própria conta.",
    );
  }

  if (
    !active &&
    current.admin_principal === true
  ) {
    throw new ApiError(
      409,
      "MAIN_ADMIN_PROTECTED",
      "O administrador principal não pode ser inativado.",
    );
  }

  await ensureNotLastActiveAdmin(
    admin,
    current,
    current.tipo,
    active,
  );

  const authUser =
    await authUserById(admin, id);

  if (!authUser) {
    throw new ApiError(
      404,
      "USER_NOT_FOUND",
      "Usuário não encontrado.",
    );
  }

  const {
    error: authError,
  } =
    await admin.auth.admin.updateUserById(
      id,
      {
        ban_duration:
          active
            ? "none"
            : BAN_DURATION,
      },
    );

  if (authError) {
    throw authError;
  }

  const {
    data: profile,
    error: profileError,
  } = await admin
    .from("usuarios")
    .update({
      ativo: active,
    })
    .eq("id", id)
    .select(
      `
        id,
        nome,
        email,
        tipo,
        ativo,
        admin_principal
      `,
    )
    .single();

  if (profileError) {
    const {
      error: rollbackError,
    } =
      await admin.auth.admin.updateUserById(
        id,
        {
          ban_duration:
            current.ativo
              ? "none"
              : BAN_DURATION,
        },
      );

    logError(
      "Falha ao atualizar status",
      profileError,
      {
        actorId,
        targetId: id,
      },
    );

    if (rollbackError) {
      logError(
        "Falha na compensação de status",
        rollbackError,
        {
          actorId,
          targetId: id,
        },
      );
    }

    throw new Error(
      "Falha consistente ao atualizar status.",
    );
  }

  await audit(
    admin,
    actorId,
    id,
    active
      ? "ativacao"
      : "inativacao",
  );

  return successResponse(
    200,
    active
      ? "Usuário ativado com sucesso."
      : "Usuário inativado com sucesso.",
    profile,
    origin,
  );
}

async function deleteUser(
  admin: SupabaseClient,
  actorId: string,
  actorIsMainAdmin: boolean,
  data: Payload,
  origin: string | null,
) {
  /*
   * Esta é a proteção principal.
   *
   * Mesmo que um administrador comum tente
   * chamar a função pelo console, a exclusão
   * será negada.
   */
  if (!actorIsMainAdmin) {
    throw new ApiError(
      403,
      "MAIN_ADMIN_REQUIRED",
      "Somente o administrador principal pode excluir usuários.",
    );
  }

  const id = validateId(data.id);

  if (id === actorId) {
    throw new ApiError(
      409,
      "SELF_DELETE",
      "Você não pode excluir sua própria conta.",
    );
  }

  const profile =
    await profileById(admin, id);

  const authUser =
    await authUserById(admin, id);

  /*
   * Requisição repetida: o usuário já foi
   * excluído nas duas origens.
   */
  if (
    !profile &&
    !authUser
  ) {
    return successResponse(
      200,
      "Usuário já estava excluído.",
      { id },
      origin,
    );
  }

  /*
   * O perfil marcado como principal nunca
   * pode ser excluído.
   */
  if (
    profile?.admin_principal === true
  ) {
    throw new ApiError(
      409,
      "MAIN_ADMIN_DELETE_NOT_ALLOWED",
      "O administrador principal não pode ser excluído.",
    );
  }

  if (profile) {
    await ensureNotLastActiveAdmin(
      admin,
      profile,
      "coletor",
      false,
    );
  }

  /*
   * Guarda todos os dados necessários para
   * restaurar o perfil caso a exclusão no
   * Auth falhe.
   */
  const profileBackup = profile
    ? {
        id: profile.id,
        nome: profile.nome,
        email: profile.email,
        tipo: profile.tipo,
        ativo: profile.ativo,
        admin_principal:
          profile.admin_principal,
        criado_em: profile.criado_em,
        atualizado_em:
          profile.atualizado_em,
      }
    : null;

  /*
   * Primeiro remove o perfil público.
   */
  if (profile) {
    const {
      error: deleteProfileError,
    } = await admin
      .from("usuarios")
      .delete()
      .eq("id", id);

    if (deleteProfileError) {
      throw deleteProfileError;
    }
  }

  /*
   * Depois remove do Supabase Auth.
   */
  if (authUser) {
    const {
      error: deleteAuthError,
    } =
      await admin.auth.admin.deleteUser(id);

    if (
      deleteAuthError &&
      !isNotFoundError(deleteAuthError)
    ) {
      /*
       * Compensação:
       * restaura o perfil apagado.
       */
      if (profileBackup) {
        const {
          error: rollbackError,
        } = await admin
          .from("usuarios")
          .upsert(
            profileBackup,
            {
              onConflict: "id",
            },
          );

        if (rollbackError) {
          logError(
            "Falha crítica na compensação da exclusão",
            rollbackError,
            {
              actorId,
              targetId: id,
            },
          );
        }
      }

      logError(
        "Falha ao excluir usuário do Auth",
        deleteAuthError,
        {
          actorId,
          targetId: id,
        },
      );

      throw new Error(
        "Falha consistente ao excluir usuário.",
      );
    }
  }

  await audit(
    admin,
    actorId,
    id,
    "exclusao",
    {
      perfil_existia:
        Boolean(profile),

      auth_existia:
        Boolean(authUser),
    },
  );

  return successResponse(
    200,
    "Usuário excluído com sucesso.",
    { id },
    origin,
  );
}

Deno.serve(
  async (request: Request) => {
    const origin =
      request.headers.get("Origin");

    if (
      request.method === "OPTIONS"
    ) {
      return new Response(
        null,
        {
          status: 204,
          headers: cors(origin),
        },
      );
    }

    if (
      request.method !== "POST"
    ) {
      return jsonResponse(
        405,
        {
          success: false,
          code: "INVALID_METHOD",
          message:
            "Método não permitido.",
        },
        origin,
      );
    }

    try {
      const url =
        Deno.env.get("SUPABASE_URL");

      const anonKey =
        Deno.env.get(
          "SUPABASE_ANON_KEY",
        );

      const serviceRoleKey =
        Deno.env.get(
          "SUPABASE_SERVICE_ROLE_KEY",
        );

      if (
        !url ||
        !anonKey ||
        !serviceRoleKey
      ) {
        throw new Error(
          "Configuração obrigatória ausente.",
        );
      }

      /*
       * Cliente usado para validar o JWT.
       */
      const authClient =
        createClient(
          url,
          anonKey,
          {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
            },
          },
        );

      /*
       * Cliente administrativo.
       * A Service Role permanece somente
       * dentro da Edge Function.
       */
      const admin =
        createClient(
          url,
          serviceRoleKey,
          {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
            },
          },
        );

      const {
        actorId,
        actorProfile,
      } = await authorize(
        request,
        authClient,
        admin,
      );

      const body =
        await request
          .json()
          .catch(() => {
            throw new ApiError(
              400,
              "INVALID_DATA",
              "Corpo da requisição inválido.",
            );
          });

      const action =
        body?.action as Action;

      const data = body?.data;

      if (
        !data ||
        typeof data !== "object" ||
        Array.isArray(data)
      ) {
        throw new ApiError(
          400,
          "INVALID_DATA",
          "Dados da operação inválidos.",
        );
      }

      if (
        action === "create"
      ) {
        return await createUser(
          admin,
          actorId,
          data,
          origin,
        );
      }

      if (
        action === "update"
      ) {
        return await updateUser(
          admin,
          actorId,
          data,
          origin,
        );
      }

      if (
        action === "activate"
      ) {
        return await setStatus(
          admin,
          actorId,
          data,
          true,
          origin,
        );
      }

      if (
        action === "deactivate"
      ) {
        return await setStatus(
          admin,
          actorId,
          data,
          false,
          origin,
        );
      }

      if (
        action === "delete"
      ) {
        return await deleteUser(
          admin,
          actorId,
          actorProfile
            .admin_principal,
          data,
          origin,
        );
      }

      throw new ApiError(
        400,
        "INVALID_DATA",
        "Ação administrativa inválida.",
      );
    } catch (error) {
      if (
        error instanceof ApiError
      ) {
        return jsonResponse(
          error.status,
          {
            success: false,
            code: error.code,
            message: error.message,
          },
          origin,
        );
      }

      logError(
        "Falha interna em admin-users",
        error,
      );

      return jsonResponse(
        500,
        {
          success: false,
          code: "UNEXPECTED_ERROR",
          message:
            "Não foi possível concluir a operação. Tente novamente.",
        },
        origin,
      );
    }
  },
);