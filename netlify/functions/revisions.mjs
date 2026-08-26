import { randomUUID } from "node:crypto";

const OWNER = process.env.GITHUB_OWNER || "Alison-Sousa";
const REPO = process.env.GITHUB_REPO || "hsia-hua-sheng";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const FILE_PATH = "data/revisoes_aprovadas.json";
const TOKEN = process.env.GITHUB_TOKEN;
const MAX_BODY_BYTES = 250_000;
const MAX_HISTORY = 2_000;
const ALLOWED_TYPES = new Set(["add", "edit", "remove", "restore", "book_add", "book_update", "book_archive", "book_restore"]);
const ITEM_FIELDS = [
  "fonte", "categoria_painel", "manifestacao_id", "item_id",
  "producao_principal_item_id", "manifestacao_derivada_de_item_id",
  "papel_manifestacao", "tipo_manifestacao", "titulo", "ano",
  "data_publicacao", "tipo_publicacao", "autores", "papel_hsia",
  "url_original", "url_principal", "urls_secundarias",
  "texto_ou_evidencia_disponivel", "republicacao_de_item_id",
  "status_verificacao", "contabilizado_na_volumetria", "papeis_da_fonte",
  "status_acesso", "conteudo_status", "evidencia", "rotulo_credito",
  "credito_exibicao", "participacao_hsia", "revisor", "contato",
  "created_at", "edited_at", "editado_de_manifestacao_id"
];

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  }
});

function emptyState() {
  return { removed: [], added: [], book_relations: [], history: [], updated_at: null };
}

function cleanText(value, max = 500) {
  return String(value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max);
}

function cleanItem(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Publicacao invalida.");
  }
  const item = {};
  for (const field of ITEM_FIELDS) {
    const limit = ["evidencia", "texto_ou_evidencia_disponivel"].includes(field) ? 5_000 : 1_000;
    item[field] = cleanText(input[field], limit);
  }
  if (!item.fonte || !item.titulo || !item.categoria_painel || !item.data_publicacao) {
    throw new Error("Fonte, titulo, formato e data sao obrigatorios.");
  }
  const dateMatch = item.data_publicacao.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) throw new Error("Informe uma data valida no formato DD/MM/AAAA.");
  const [, year, month, day] = dateMatch;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) {
    throw new Error("Informe uma data valida no formato DD/MM/AAAA.");
  }
  item.ano = year;
  const address = item.url_original || item.url_principal;
  try {
    const parsed = new URL(address);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
  } catch {
    throw new Error("Informe uma URL valida.");
  }
  item.url_original = address;
  item.url_principal = item.url_principal || address;
  return item;
}

function cleanBookRelation(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Relacao do livro invalida.");
  const chapter = Number(input.chapter);
  const nlpChapter = input.nlp_chapter === "" || input.nlp_chapter == null ? "" : Number(input.nlp_chapter);
  const classification = cleanText(input.classification, 30).toLowerCase();
  if (!cleanText(input.relation_id, 300) || !cleanText(input.item_id, 240)) throw new Error("Relacao e item_id sao obrigatorios.");
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > 17) throw new Error("Capitulo invalido.");
  if (!["exclusivo", "compartilhado"].includes(classification)) throw new Error("Classificacao invalida.");
  return {
    relation_id: cleanText(input.relation_id, 300),
    item_id: cleanText(input.item_id, 240),
    chapter,
    classification,
    observation: cleanText(input.observation, 5_000),
    active: input.active !== false,
    source: cleanText(input.source, 20) === "nlp" ? "nlp" : "manual",
    nlp_chapter: Number.isInteger(nlpChapter) && nlpChapter >= 1 && nlpChapter <= 17 ? nlpChapter : "",
    nlp_classification: ["exclusivo", "compartilhado"].includes(cleanText(input.nlp_classification, 30).toLowerCase()) ? cleanText(input.nlp_classification, 30).toLowerCase() : ""
  };
}
function normalizeState(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    removed: Array.isArray(source.removed) ? source.removed.slice(0, 10_000) : [],
    added: Array.isArray(source.added) ? source.added.slice(0, 10_000) : [],
    book_relations: Array.isArray(source.book_relations) ? source.book_relations.slice(0, 10_000) : [],
    history: Array.isArray(source.history) ? source.history.slice(-MAX_HISTORY) : [],
    updated_at: source.updated_at || null
  };
}

function idOf(value) {
  return cleanText(value?.manifestacao_id || value, 240);
}

function validateChange(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Alteracao invalida.");
  }
  const type = cleanText(input.type, 20);
  if (!ALLOWED_TYPES.has(type)) throw new Error("Tipo de alteracao invalido.");
  const change = {
    type,
    reviewer: cleanText(input.reviewer || input.item?.revisor || "Visitante", 120),
    changed_at: new Date().toISOString()
  };
  if (type.startsWith("book_")) {
    change.relation = cleanBookRelation(input.relation);
    change.before = input.before ? cleanBookRelation(input.before) : null;
    return change;
  }
  if (type === "add") {
    change.item = cleanItem(input.item);
  } else if (type === "edit") {
    change.manifestacao_id = cleanText(input.manifestacao_id, 240);
    change.item = cleanItem(input.item);
    if (!change.manifestacao_id) throw new Error("Registro para edicao nao informado.");
  } else {
    change.manifestacao_id = cleanText(input.manifestacao_id, 240);
    change.item_id = cleanText(input.item_id, 240);
    change.titulo = cleanText(input.titulo, 1_000);
    change.fonte = cleanText(input.fonte, 1_000);
    if (!change.manifestacao_id) throw new Error("Registro nao informado.");
  }
  return change;
}

function applyChange(state, change) {
  if (change.type.startsWith("book_")) {
    state.book_relations ||= [];
    state.history ||= [];
    const index = state.book_relations.findIndex(entry => entry.relation_id === change.relation.relation_id);
    if (change.type === "book_add" && index >= 0) throw new Error("Esta relacao ja existe.");
    const before = index >= 0 ? { ...state.book_relations[index] } : change.before;
    if (change.type !== "book_add" && !before) throw new Error("Relacao do livro nao encontrada.");
    const after = { ...(before || {}), ...change.relation };
    if (change.type === "book_archive") after.active = false;
    if (change.type === "book_restore") after.active = true;
    after.reviewer = change.reviewer;
    after.edited_at = change.changed_at;
    if (index >= 0) state.book_relations[index] = after;
    else state.book_relations.push(after);
    const event = (type, oldValue, newValue) => ({
      type,
      reviewer: change.reviewer,
      changed_at: change.changed_at,
      relation_id: after.relation_id,
      item_id: after.item_id,
      chapter: after.chapter,
      old_value: oldValue,
      new_value: newValue
    });
    if (change.type === "book_add") state.history.push(event("book_add", "", `${after.chapter} | ${after.classification}`));
    if (change.type === "book_archive") state.history.push(event("book_archive", "ativo", "arquivado"));
    if (change.type === "book_restore") state.history.push(event("book_restore", "arquivado", "ativo"));
    if (change.type === "book_update") {
      if (Number(before.chapter) !== Number(after.chapter)) state.history.push(event("book_move", before.chapter, after.chapter));
      if (before.classification !== after.classification) state.history.push(event("book_classify", before.classification, after.classification));
      if ((before.observation || "") !== (after.observation || "")) state.history.push(event("book_observe", before.observation || "", after.observation || ""));
    }
    state.history = state.history.slice(-MAX_HISTORY);
    state.updated_at = change.changed_at;
    return state;
  }
  if (change.type === "remove") {
    if (!state.removed.some(entry => idOf(entry) === change.manifestacao_id)) {
      state.removed.push(change);
    }
  }
  if (change.type === "restore") {
    state.removed = state.removed.filter(entry => idOf(entry) !== change.manifestacao_id);
  }
  if (change.type === "add") {
    const item = { ...change.item };
    const uid = randomUUID();
    item.manifestacao_id ||= `manifestacao-revisao-${uid}`;
    item.item_id ||= `hsia-revisao-${uid}`;
    item.producao_principal_item_id ||= item.item_id;
    item.created_at ||= change.changed_at;
    item.status_verificacao ||= "confirmado_por_revisao";
    item.contabilizado_na_volumetria ||= "sim";
    if (state.added.some(entry => idOf(entry) === item.manifestacao_id)) {
      throw new Error("Esta publicacao ja foi adicionada.");
    }
    state.added.push(item);
    change.item = item;
  }
  if (change.type === "edit") {
    const existingIndex = state.added.findIndex(entry => idOf(entry) === change.manifestacao_id);
    if (existingIndex >= 0) {
      const current = state.added[existingIndex];
      state.added[existingIndex] = {
        ...current,
        ...change.item,
        manifestacao_id: current.manifestacao_id,
        item_id: current.item_id,
        edited_at: change.changed_at
      };
      change.item = state.added[existingIndex];
    } else {
      const uid = randomUUID();
      if (!state.removed.some(entry => idOf(entry) === change.manifestacao_id)) {
        state.removed.push({
          type: "remove",
          manifestacao_id: change.manifestacao_id,
          item_id: cleanText(change.item.item_id, 240),
          titulo: change.item.titulo,
          fonte: change.item.fonte,
          reviewer: change.reviewer,
          changed_at: change.changed_at,
          reason: "substituido_por_edicao"
        });
      }
      change.item = {
        ...change.item,
        manifestacao_id: `manifestacao-edicao-${uid}`,
        editado_de_manifestacao_id: change.manifestacao_id,
        edited_at: change.changed_at
      };
      state.added.push(change.item);
    }
  }
  state.history.push(change);
  state.history = state.history.slice(-MAX_HISTORY);
  state.updated_at = change.changed_at;
  return state;
}

function githubHeaders() {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${TOKEN}`,
    "x-github-api-version": "2022-11-28",
    "user-agent": "hsia-hua-sheng-netlify"
  };
}

async function readRemote() {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}?ref=${encodeURIComponent(BRANCH)}`;
  const response = await fetch(url, { headers: githubHeaders() });
  if (!response.ok) throw new Error(`Repositorio nao respondeu (${response.status}).`);
  const file = await response.json();
  const decoded = Buffer.from(String(file.content || "").replace(/\n/g, ""), "base64").toString("utf8");
  return { sha: file.sha, state: normalizeState(JSON.parse(decoded)) };
}

async function writeRemote(change) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await readRemote();
    const next = applyChange(current.state, change);
    const response = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`, {
      method: "PUT",
      headers: { ...githubHeaders(), "content-type": "application/json" },
      body: JSON.stringify({
        message: change.type.startsWith("book_") ? `livro: ${change.type} pela curadoria aberta` : `acervo: ${change.type} publicacao pela revisao aberta`,
        content: Buffer.from(JSON.stringify(next, null, 2) + "\n", "utf8").toString("base64"),
        sha: current.sha,
        branch: BRANCH
      })
    });
    if (response.ok) return next;
    if (response.status !== 409) throw new Error(`Repositorio recusou a alteracao (${response.status}).`);
  }
  throw new Error("Outra alteracao aconteceu ao mesmo tempo. Tente novamente.");
}

export default async function handler(request) {
  if (!TOKEN) return json({ error: "Integracao com o repositorio ainda nao configurada no Netlify." }, 503);
  if (request.method === "GET") {
    try {
      const current = await readRemote();
      return json(current.state);
    } catch (error) {
      return json({ error: error.message }, 502);
    }
  }
  if (request.method !== "POST") return json({ error: "Metodo nao permitido." }, 405);
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) return json({ error: "Alteracao muito grande." }, 413);
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) return json({ error: "Alteracao muito grande." }, 413);
    const change = validateChange(JSON.parse(raw));
    return json(await writeRemote(change));
  } catch (error) {
    const message = error instanceof SyntaxError ? "JSON invalido." : error.message;
    const status = /invalid|obrigatori|Informe|adicionada|Relacao|Capitulo|Classificacao|existe/.test(message) ? 400 : 502;
    return json({ error: message }, status);
  }
}
