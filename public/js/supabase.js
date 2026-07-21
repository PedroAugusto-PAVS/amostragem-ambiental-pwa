const SUPABASE_URL = "https://ecmctjixtznsixajfclt.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjbWN0aml4dHpuc2l4YWpmY2x0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3Mjk0MzIsImV4cCI6MjA5NjMwNTQzMn0.x7TW6TvS04iyqaMBidEkbDTDHC5Oi79Tyulsp9LWhT0";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const MENSAGEM_USUARIO_INATIVO = "Seu usuário está inativo. Entre em contato com o administrador.";
let validacaoUsuarioEmAndamento = null;

async function encerrarSessaoHydroTrack(mensagem, redirecionar = true) {
  await supabaseClient.auth.signOut().catch(() => null);
  localStorage.removeItem("usuario");
  if (mensagem) sessionStorage.setItem("mensagem_auth", mensagem);
  if (redirecionar && !location.pathname.endsWith("/index.html") && location.pathname !== "/") {
    location.replace("index.html");
  }
}

async function validarUsuarioAtivo(opcoes = {}) {
  if (!navigator.onLine) {
    const conhecido = JSON.parse(localStorage.getItem("usuario") || "null");
    if (conhecido?.ativo === false) {
      await encerrarSessaoHydroTrack(MENSAGEM_USUARIO_INATIVO, opcoes.redirecionar !== false);
      return null;
    }
    return conhecido;
  }
  if (validacaoUsuarioEmAndamento) return validacaoUsuarioEmAndamento;
  validacaoUsuarioEmAndamento = (async () => {
    const { data: sessao } = await supabaseClient.auth.getSession();
    if (!sessao?.session?.user) return null;
    const { data: perfil, error } = await supabaseClient.from("usuarios")
      .select("id, nome, email, tipo, ativo").eq("id", sessao.session.user.id).maybeSingle();
    if (error) throw error;
    if (!perfil || perfil.ativo === false) {
      await encerrarSessaoHydroTrack(MENSAGEM_USUARIO_INATIVO, opcoes.redirecionar !== false);
      return null;
    }
    perfil.tipo = perfil.tipo === "admin" ? "administrador" : perfil.tipo;
    localStorage.setItem("usuario", JSON.stringify(perfil));
    if (opcoes.exigirAdministrador && perfil.tipo !== "administrador") {
      await encerrarSessaoHydroTrack("Você não possui permissão para realizar esta operação.", opcoes.redirecionar !== false);
      return null;
    }
    return perfil;
  })().finally(() => { validacaoUsuarioEmAndamento = null; });
  return validacaoUsuarioEmAndamento;
}

window.hydrotrackAuth = { validarUsuarioAtivo, encerrarSessaoHydroTrack };
supabaseClient.auth.onAuthStateChange((evento, sessao) => {
  if (["SIGNED_IN", "TOKEN_REFRESHED", "INITIAL_SESSION"].includes(evento) && sessao) {
    setTimeout(() => validarUsuarioAtivo().catch(() => null), 0);
  }
  if (evento === "SIGNED_OUT") localStorage.removeItem("usuario");
});
window.addEventListener("online", () => validarUsuarioAtivo().catch(() => null));
