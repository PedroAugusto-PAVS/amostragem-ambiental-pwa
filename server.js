const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

function carregarEnvLocal() {
  const envPath = path.join(__dirname, ".env");

  if (!fs.existsSync(envPath)) return;

  const linhas = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  linhas.forEach((linha) => {
    const texto = linha.trim();

    if (!texto || texto.startsWith("#") || !texto.includes("=")) return;

    const indice = texto.indexOf("=");
    const chave = texto.slice(0, indice).trim();
    const valor = texto.slice(indice + 1).trim().replace(/^["']|["']$/g, "");

    if (chave && process.env[chave] === undefined) {
      process.env[chave] = valor;
    }
  });
}

carregarEnvLocal();

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://ecmctjixtznsixajfclt.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjbWN0aml4dHpuc2l4YWpmY2x0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3Mjk0MzIsImV4cCI6MjA5NjMwNTQzMn0.x7TW6TvS04iyqaMBidEkbDTDHC5Oi79Tyulsp9LWhT0";

function obterServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

async function chamarSupabase(caminho, { method = "GET", token, body, prefer } = {}) {
  const headers = {
    apikey: token,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };

  if (prefer) {
    headers.Prefer = prefer;
  }

  const resposta = await fetch(`${SUPABASE_URL}${caminho}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const texto = await resposta.text();
  const dados = texto ? JSON.parse(texto) : null;

  if (!resposta.ok) {
    const mensagem = dados?.msg || dados?.message || texto || "Erro no Supabase";
    const error = new Error(mensagem);
    error.status = resposta.status;
    error.code = dados?.code;
    throw error;
  }

  return dados;
}

async function buscarUsuarioAuthPorEmail(email, serviceRoleKey) {
  const emailNormalizado = email.trim().toLowerCase();
  const porPagina = 1000;
  let pagina = 1;

  while (true) {
    const resultado = await chamarSupabase(
      `/auth/v1/admin/users?page=${pagina}&per_page=${porPagina}`,
      { token: serviceRoleKey }
    );
    const usuarios = resultado?.users || [];
    const usuario = usuarios.find(
      (item) => String(item.email || "").trim().toLowerCase() === emailNormalizado
    );

    if (usuario) return usuario;

    const ultimaPagina = Number(resultado?.last_page || 0);

    if (usuarios.length < porPagina || (ultimaPagina && pagina >= ultimaPagina)) {
      return null;
    }

    pagina += 1;
  }
}

async function obterUsuarioDaSessao(accessToken) {
  const resposta = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!resposta.ok) return null;

  return resposta.json();
}

async function exigirAdmin(req, res, next) {
  try {
    const serviceRoleKey = obterServiceRoleKey();

    if (!serviceRoleKey) {
      return res.status(500).json({
        error:
          "SUPABASE_SERVICE_ROLE_KEY nao configurada no servidor. Configure a chave service_role no .env para criar logins confirmados."
      });
    }

    const authorization = req.headers.authorization || "";
    const accessToken = authorization.replace(/^Bearer\s+/i, "");

    if (!accessToken) {
      return res.status(401).json({ error: "Sessao ausente." });
    }

    const usuarioAuth = await obterUsuarioDaSessao(accessToken);

    if (!usuarioAuth?.id) {
      return res.status(401).json({ error: "Sessao invalida." });
    }

    const perfil = await chamarSupabase(
      `/rest/v1/usuarios?id=eq.${encodeURIComponent(usuarioAuth.id)}&select=id,tipo,ativo`,
      { token: serviceRoleKey }
    );

    const usuario = perfil?.[0];

    if (!usuario || usuario.tipo !== "admin" || usuario.ativo === false) {
      return res.status(403).json({ error: "Acesso permitido apenas para administradores." });
    }

    req.admin = usuarioAuth;
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/api/admin/usuarios", exigirAdmin, async (req, res) => {
  let novoId = null;
  let usuarioNovo = false;

  try {
    const { nome, email, senha, tipo, ativo } = req.body || {};

    if (!nome || !email || !senha) {
      return res.status(400).json({ error: "Nome, email e senha sao obrigatorios." });
    }

    if (senha.length < 6) {
      return res.status(400).json({ error: "A senha precisa ter pelo menos 6 caracteres." });
    }

    if (!["admin", "coletor"].includes(tipo)) {
      return res.status(400).json({ error: "Tipo de usuario invalido." });
    }

    const serviceRoleKey = obterServiceRoleKey();
    const emailNormalizado = email.trim().toLowerCase();
    let usuarioAuth = await buscarUsuarioAuthPorEmail(
      emailNormalizado,
      serviceRoleKey
    );

    if (usuarioAuth) {
      usuarioAuth = await chamarSupabase(
        `/auth/v1/admin/users/${encodeURIComponent(usuarioAuth.id)}`,
        {
          method: "PUT",
          token: serviceRoleKey,
          body: {
            password: senha,
            email_confirm: true,
            user_metadata: {
              nome,
              tipo
            }
          }
        }
      );
    } else {
      usuarioAuth = await chamarSupabase("/auth/v1/admin/users", {
        method: "POST",
        token: serviceRoleKey,
        body: {
          email: emailNormalizado,
          password: senha,
          email_confirm: true,
          user_metadata: {
            nome,
            tipo
          }
        }
      });
      usuarioNovo = true;
    }

    novoId = usuarioAuth?.id;

    if (!novoId) {
      return res.status(500).json({ error: "Usuario salvo no Auth, mas ID nao retornou." });
    }

    await chamarSupabase("/rest/v1/usuarios?on_conflict=id", {
      method: "POST",
      token: serviceRoleKey,
      prefer: "resolution=merge-duplicates",
      body: {
        id: novoId,
        nome,
        email: emailNormalizado,
        tipo,
        ativo,
        atualizado_em: new Date().toISOString(),
        ...(usuarioNovo ? { criado_em: new Date().toISOString() } : {})
      }
    });

    res.status(201).json({
      id: novoId,
      nome,
      email: emailNormalizado,
      tipo,
      ativo,
      recuperado: !usuarioNovo
    });
  } catch (error) {
    if (usuarioNovo && novoId) {
      try {
        await chamarSupabase(`/auth/v1/admin/users/${encodeURIComponent(novoId)}`, {
          method: "DELETE",
          token: obterServiceRoleKey()
        });
      } catch (rollbackError) {
        console.error("Falha ao remover login incompleto:", rollbackError.message);
      }
    }

    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/admin/usuarios/:id", exigirAdmin, async (req, res) => {
  try {
    const usuarioId = String(req.params.id || "").trim();

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(usuarioId)) {
      return res.status(400).json({ error: "ID de usuario invalido." });
    }

    if (usuarioId === req.admin.id) {
      return res.status(400).json({ error: "Voce nao pode excluir seu proprio usuario." });
    }

    const serviceRoleKey = obterServiceRoleKey();

    await chamarSupabase(`/auth/v1/admin/users/${encodeURIComponent(usuarioId)}`, {
      method: "DELETE",
      token: serviceRoleKey
    });

    await chamarSupabase(
      `/rest/v1/usuarios?id=eq.${encodeURIComponent(usuarioId)}`,
      {
        method: "DELETE",
        token: serviceRoleKey
      }
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
