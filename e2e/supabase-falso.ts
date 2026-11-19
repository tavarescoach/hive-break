/**
 * Servidor Supabase falso, SÓ PARA TESTE de ponta a ponta.
 *
 * Imita o pedaço do Supabase que o app usa (login OAuth, /auth/v1/user e a API
 * REST de tabelas e funções) em cima de um Postgres embutido com as migrações
 * reais. Assim o fluxo de telas é testado contra a RLS e as funções de verdade,
 * sem precisar de um projeto Supabase nem de uma conta Google.
 *
 * Uso: npx tsx e2e/supabase-falso.ts [porta]
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { como, criarBanco } from "../src/banco/banco-de-teste";

const PORTA = Number(process.argv[2] ?? 54329);
const IDENT = /^[a-z_][a-z0-9_]*$/;

interface Identidade {
  nome: string;
  email: string;
}

const b64 = (dados: unknown) => Buffer.from(JSON.stringify(dados)).toString("base64url");
const criarJwt = (sub: string) =>
  `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.assinatura-falsa`;

function lerSub(req: IncomingMessage): string | null {
  const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  const partes = token.split(".");
  if (partes.length !== 3) return null;
  try {
    const dados = JSON.parse(Buffer.from(partes[1], "base64url").toString());
    return dados.role === "authenticated" && typeof dados.sub === "string" ? dados.sub : null;
  } catch {
    return null;
  }
}

async function lerCorpo(req: IncomingMessage): Promise<unknown> {
  const pedacos: Buffer[] = [];
  for await (const pedaco of req) pedacos.push(pedaco as Buffer);
  const texto = Buffer.concat(pedacos).toString();
  return texto ? JSON.parse(texto) : null;
}

// O navegador chama o Auth direto (login anônimo do visitante), como no Supabase real.
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

function responder(res: ServerResponse, status: number, corpo?: unknown) {
  res.writeHead(status, { "content-type": "application/json", ...CORS });
  res.end(corpo === undefined ? "" : JSON.stringify(corpo));
}

function ident(nome: string): string {
  if (!IDENT.test(nome)) throw new Error(`identificador inválido: ${nome}`);
  return `"${nome}"`;
}

/** Converte os filtros da URL (col=eq.x, col=in.(a,b)) em SQL com parâmetros. */
function filtros(busca: URLSearchParams, params: unknown[]): string {
  const condicoes: string[] = [];
  for (const [coluna, bruto] of busca) {
    if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(coluna)) continue;
    const [operador, ...resto] = bruto.split(".");
    const valor = resto.join(".");
    if (operador === "eq") {
      params.push(valor);
      condicoes.push(`${ident(coluna)}::text = $${params.length}`);
    } else if (operador === "in") {
      params.push(valor.replace(/^\(|\)$/g, "").split(",").map((v) => v.replace(/^"|"$/g, "")));
      condicoes.push(`${ident(coluna)}::text = any($${params.length}::text[])`);
    } else {
      throw new Error(`operador não suportado no servidor falso: ${operador}`);
    }
  }
  return condicoes.length ? ` where ${condicoes.join(" and ")}` : "";
}

async function main() {
  const db = await criarBanco();
  let proxima: Identidade = { nome: "Pessoa Teste", email: "pessoa@exemplo.com" };
  const codigos = new Map<string, string>();
  // Códigos de 6 dígitos "enviados por e-mail" (VISITANTE.md): e-mail → código pendente.
  const otps = new Map<string, { codigo: string; tipo: "email_change" | "email"; usuario: string; criado: number }>();
  const novoOtp = () => String(100000 + Math.floor(Math.random() * 900000));
  const erroAuth = (res: ServerResponse, status: number, codigo: string, msg: string) => responder(res, status, { error_code: codigo, msg });

  const usuarioJson = async (id: string) => {
    const { rows } = await db.query<{ id: string; email: string; raw_user_meta_data: object; created_at: string; is_anonymous: boolean }>(
      "select * from auth.users where id = $1",
      [id],
    );
    if (!rows[0]) return null;
    return {
      id: rows[0].id,
      aud: "authenticated",
      role: "authenticated",
      email: rows[0].email,
      is_anonymous: rows[0].is_anonymous,
      app_metadata: { provider: rows[0].is_anonymous ? "anonymous" : "google" },
      user_metadata: rows[0].raw_user_meta_data,
      created_at: rows[0].created_at,
    };
  };

  const sessaoJson = async (id: string) => ({
    access_token: criarJwt(id),
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: `renovar-${id}`,
    user: await usuarioJson(id),
  });

  const servidor = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${PORTA}`);
    const caminho = url.pathname;
    if (req.method === "OPTIONS") {
      res.writeHead(204, CORS);
      return res.end();
    }
    try {
      // ------------------------------------------------ controle do teste
      if (caminho === "/__controle/proximo-usuario") {
        proxima = (await lerCorpo(req)) as Identidade;
        return responder(res, 200, { ok: true });
      }
      if (caminho === "/__controle/sql") {
        const { sql, params } = (await lerCorpo(req)) as { sql: string; params?: unknown[] };
        return responder(res, 200, (await db.query(sql, params)).rows);
      }
      if (caminho === "/__controle/pronto") return responder(res, 200, { ok: true });
      if (caminho === "/__controle/codigo") {
        // O "e-mail" com o código, para o teste ler.
        return responder(res, 200, { codigo: otps.get(url.searchParams.get("email") ?? "")?.codigo ?? null });
      }

      // ------------------------------------------------------------ auth
      if (caminho === "/auth/v1/authorize") {
        // No Supabase real, aqui a pessoa escolheria a conta no Google.
        let { rows } = await db.query<{ id: string }>("select id from auth.users where email = $1", [proxima.email]);
        if (!rows[0]) {
          ({ rows } = await db.query<{ id: string }>(
            "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
            [proxima.email, JSON.stringify({ full_name: proxima.nome })],
          ));
        }
        const codigo = randomUUID();
        codigos.set(codigo, rows[0].id);
        const destino = new URL(url.searchParams.get("redirect_to")!);
        destino.searchParams.set("code", codigo);
        res.writeHead(302, { location: destino.toString() });
        return res.end();
      }
      if (caminho === "/auth/v1/token") {
        const corpo = (await lerCorpo(req)) as { auth_code?: string; refresh_token?: string };
        const id = corpo.auth_code ? codigos.get(corpo.auth_code) : corpo.refresh_token?.replace(/^renovar-/, "");
        if (!id) return responder(res, 400, { error: "invalid_grant", error_description: "código inválido" });
        return responder(res, 200, await sessaoJson(id));
      }
      if (caminho === "/auth/v1/signup") {
        // signInAnonymously: sem e-mail, cria um usuário anônimo.
        const corpo = ((await lerCorpo(req)) ?? {}) as { email?: string };
        if (corpo.email) return erroAuth(res, 400, "validation_failed", "só o login anônimo é imitado aqui");
        const { rows } = await db.query<{ id: string }>("insert into auth.users (is_anonymous) values (true) returning id");
        return responder(res, 200, await sessaoJson(rows[0].id));
      }
      if (caminho === "/auth/v1/user" && req.method === "PUT") {
        // updateUser({ email }) no anônimo: manda o código de troca de e-mail.
        const sub = lerSub(req);
        if (!sub) return erroAuth(res, 401, "no_authorization", "sem sessão");
        const { email } = (await lerCorpo(req)) as { email: string };
        const existe = await db.query("select 1 from auth.users where email = $1 and id <> $2", [email, sub]);
        if (existe.rows.length) return erroAuth(res, 422, "email_exists", "A user with this email address has already been registered");
        otps.set(email, { codigo: novoOtp(), tipo: "email_change", usuario: sub, criado: Date.now() });
        return responder(res, 200, await usuarioJson(sub));
      }
      if (caminho === "/auth/v1/otp") {
        const { email, create_user } = (await lerCorpo(req)) as { email: string; create_user?: boolean };
        const { rows } = await db.query<{ id: string }>("select id from auth.users where email = $1", [email]);
        if (!rows[0] && !create_user) return erroAuth(res, 422, "otp_disabled", "Signups not allowed for otp");
        if (!rows[0]) return erroAuth(res, 400, "validation_failed", "criar conta por OTP não é imitado aqui");
        otps.set(email, { codigo: novoOtp(), tipo: "email", usuario: rows[0].id, criado: Date.now() });
        return responder(res, 200, {});
      }
      if (caminho === "/auth/v1/verify") {
        const { email, token, type } = (await lerCorpo(req)) as { email: string; token: string; type: string };
        const otp = otps.get(email);
        const tipoOk = otp && (otp.tipo === "email_change" ? type === "email_change" : ["email", "magiclink"].includes(type));
        if (!otp || !tipoOk || otp.codigo !== token || Date.now() - otp.criado > 600_000) {
          return erroAuth(res, 403, "otp_expired", "Token has expired or is invalid");
        }
        otps.delete(email);
        if (otp.tipo === "email_change") {
          await db.query("update auth.users set email = $2, is_anonymous = false where id = $1", [otp.usuario, email]);
        }
        return responder(res, 200, await sessaoJson(otp.usuario));
      }
      if (caminho === "/auth/v1/user") {
        const sub = lerSub(req);
        const usuario = sub ? await usuarioJson(sub) : null;
        return usuario ? responder(res, 200, usuario) : responder(res, 401, { message: "sem sessão" });
      }
      if (caminho === "/auth/v1/logout") return responder(res, 204);

      // ------------------------------------------------------------ REST
      const papel = { usuario: lerSub(req) };
      const rpc = caminho.match(/^\/rest\/v1\/rpc\/([a-z_0-9]+)$/);
      if (rpc) {
        const funcao = rpc[1];
        const args = ((await lerCorpo(req)) ?? {}) as Record<string, unknown>;
        const assinatura = await db.query<{ nomes: string[] | null; tipos: string[] }>(
          `select proargnames as nomes, array(select t::regtype::text from unnest(proargtypes::oid[]) t) as tipos
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and proname = $1`,
          [funcao],
        );
        if (!assinatura.rows[0]) return responder(res, 404, { message: `função ${funcao} não existe` });
        const { nomes, tipos } = assinatura.rows[0];
        const params: unknown[] = [];
        const partes = Object.entries(args).map(([nome, valor]) => {
          const tipo = tipos[(nomes ?? []).indexOf(nome)];
          if (!tipo) throw new Error(`argumento desconhecido: ${nome}`);
          params.push(valor !== null && typeof valor === "object" ? JSON.stringify(valor) : valor);
          return `${ident(nome)} => $${params.length}::${tipo}`;
        });
        const resultado = await como(db, papel, (tx) => tx.query<Record<string, unknown>>(`select * from public.${ident(funcao)}(${partes.join(", ")})`, params));
        const linhas = resultado.rows;
        // Função escalar devolve o valor; função de tabela devolve as linhas.
        const escalar = linhas.length <= 1 && linhas[0] !== undefined && Object.keys(linhas[0]).length === 1 && funcao in linhas[0];
        if (escalar) return responder(res, 200, linhas[0][funcao] === "" ? null : linhas[0][funcao]);
        if ((req.headers.accept ?? "").includes("vnd.pgrst.object")) {
          return linhas.length === 1 ? responder(res, 200, linhas[0]) : responder(res, 406, { code: "PGRST116", message: "0 linhas", details: "0 rows" });
        }
        return responder(res, 200, linhas);
      }

      const tabela = caminho.match(/^\/rest\/v1\/([a-z_0-9]+)$/);
      if (tabela) {
        const alvo = `public.${ident(tabela[1])}`;
        const params: unknown[] = [];
        if (req.method === "GET" || req.method === "HEAD") {
          const colunas = (url.searchParams.get("select") ?? "*").split(",").map((c) => (c === "*" ? "*" : ident(c))).join(", ");
          let sql = `select ${colunas} from ${alvo}${filtros(url.searchParams, params)}`;
          const ordem = url.searchParams.get("order");
          if (ordem) {
            const [coluna, direcao] = ordem.split(".");
            sql += ` order by ${ident(coluna)} ${direcao === "desc" ? "desc" : "asc"}`;
          }
          const limite = url.searchParams.get("limit");
          if (limite) sql += ` limit ${Number(limite)}`;
          const { rows } = await como(db, papel, (tx) => tx.query(sql, params));
          if ((req.headers.accept ?? "").includes("vnd.pgrst.object")) {
            return rows.length === 1 ? responder(res, 200, rows[0]) : responder(res, 406, { code: "PGRST116", message: "0 ou várias linhas", details: `${rows.length} rows` });
          }
          return responder(res, 200, rows);
        }
        const corpo = await lerCorpo(req);
        if (req.method === "POST") {
          const linhas = Array.isArray(corpo) ? corpo : [corpo];
          const colunas = Object.keys(linhas[0] as object).map(ident).join(", ");
          params.push(JSON.stringify(linhas));
          await como(db, papel, (tx) =>
            tx.query(`insert into ${alvo} (${colunas}) select ${colunas} from json_populate_recordset(null::${alvo}, $1::json)`, params),
          );
          return responder(res, 201);
        }
        if (req.method === "PATCH") {
          const colunas = Object.keys(corpo as object).map(ident).join(", ");
          params.push(JSON.stringify(corpo));
          const onde = filtros(url.searchParams, params);
          await como(db, papel, (tx) =>
            tx.query(`update ${alvo} set (${colunas}) = (select ${colunas} from json_populate_record(null::${alvo}, $1::json))${onde}`, params),
          );
          return responder(res, 204);
        }
      }
      responder(res, 404, { message: `rota não suportada no servidor falso: ${req.method} ${caminho}` });
    } catch (erro) {
      const e = erro as Error & { code?: string };
      console.error(`[supabase-falso] ${req.method} ${caminho}: ${e.message}`);
      responder(res, e.code === "42501" ? 403 : 400, { message: e.message, code: e.code ?? "falso" });
    }
  });

  servidor.listen(PORTA, () => console.log(`[supabase-falso] pronto em http://localhost:${PORTA}`));
}

void main();
