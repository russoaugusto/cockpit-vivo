import React, { useState, useMemo, useRef } from "react";
import Papa from "papaparse";

// ---- Token system ----
// Cor: sala de controle de operações — grafite profundo, painel "vidro" azul-petróleo,
// acento âmbar para alerta/meta, âmbar-esverdeado (teal) para oportunidade real.
// Tipo: rótulos em sans (system-ui), números/dados em mono — leitura tipo terminal.
// Layout: abas Mailing / Proposta — o operador primeiro varre a carteira, depois
// abre um cliente específico pra trabalhar a oferta.
// Assinatura: barra de franquia consolidada + tabela de mailing com prioridade calculada.

const C = {
  bg: "#12181c",
  panel: "#1a2329",
  panelAlt: "#141b20",
  border: "#28343b",
  teal: "#3fb8af",
  tealDim: "#2a7d76",
  amber: "#e0a030",
  red: "#c65a4e",
  text: "#e8ecee",
  textDim: "#8fa0a8",
  textFaint: "#5b6b73",
};

const fmtBRL = (n) =>
  (isNaN(n) ? 0 : n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const NUMEROS_FEMININO = ["zero", "uma", "duas", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez"];
function extensoFeminino(n) {
  return n >= 0 && n <= 10 ? NUMEROS_FEMININO[n] : String(n);
}

function resumoConexoes(linhas) {
  const validas = linhas.filter((r) => r.velocidade && parseFloat(r.qtd) > 0).map((r) => ({ qtd: parseFloat(r.qtd), vel: r.velocidade }));
  if (validas.length === 0) return "";
  if (validas.length === 2 && validas[0].qtd === 1 && validas[1].qtd === 1) {
    return `uma de ${validas[0].vel} e outra de ${validas[1].vel}`;
  }
  const frases = validas.map((v) => `${extensoFeminino(v.qtd)} de ${v.vel}`);
  if (frases.length === 1) return frases[0];
  return frases.slice(0, -1).join(", ") + " e " + frases[frases.length - 1];
}

function joinNatural(lista) {
  if (lista.length === 0) return "";
  if (lista.length === 1) return lista[0];
  return lista.slice(0, -1).join(", ") + " e " + lista[lista.length - 1];
}

function tabelaMonospace(linhas) {
  // linhas: [[rótulo, atual, proposta], ...] -> texto alinhado em colunas, com
  // cabeçalho ATUAL/PROPOSTA, pra usar dentro de um bloco ```monospace``` do WhatsApp.
  const largRotulo = Math.max(...linhas.map((l) => l[0].length));
  const largAtual = Math.max(6, ...linhas.map((l) => l[1].length));
  const cabecalho = `${"".padEnd(largRotulo)}  ${"ATUAL".padEnd(largAtual)}  PROPOSTA`;
  const corpo = linhas.map((l) => `${l[0].padEnd(largRotulo)}  ${l[1].padEnd(largAtual)}  ${l[2]}`).join("\n");
  return `${cabecalho}\n${corpo}`;
}

function montarQuadroResumo({ portfolioAtual, linhasComparativo, economiaTxt, usarIcones = true }) {
  const divisor = "-".repeat(28);
  const partes = [];
  partes.push("RESUMO DA SUA CONTA");
  partes.push(divisor);
  portfolioAtual.forEach((item) => partes.push(usarIcones ? `${item.icone} ${item.texto}` : `- ${item.texto}`));
  partes.push(divisor);
  partes.push("PLANO ATUAL x PROPOSTA");
  partes.push(tabelaMonospace(linhasComparativo));
  if (economiaTxt) {
    partes.push(divisor);
    partes.push(economiaTxt);
  }
  return partes.join("\n");
}

function montarQuadroResumoHtml({ portfolioAtual, linhasComparativo, economiaTxt }) {
  const fonte = "font-family: Calibri, Arial, sans-serif; font-size: 14px;";
  const tdBase = `padding: 8px 12px; border: 1px solid #d0d0d0; ${fonte}`;
  const thBase = `${tdBase} background: #e8e8e8; color: #111111; text-align: left; font-weight: 700; font-size: 14px;`;

  const listaItens = portfolioAtual
    .map((item) => `<li style="${fonte} margin-bottom: 4px;">${item.icone} ${item.texto}</li>`)
    .join("");

  const linhasTr = linhasComparativo
    .map(
      (l) =>
        `<tr>
          <td style="${tdBase} font-weight: 600;">${l[0]}</td>
          <td style="${tdBase}">${l[1]}</td>
          <td style="${tdBase} color: #1a7f5a; font-weight: 600;">${l[2]}</td>
        </tr>`
    )
    .join("");

  const economiaHtml = economiaTxt
    ? `<p style="${fonte} background: #e6f7f0; border-left: 4px solid #1a7f5a; padding: 10px 14px; margin-top: 12px;"><strong>${economiaTxt}</strong></p>`
    : "";

  return `
    <div>
      <p style="${fonte} font-weight: 700; font-size: 15px; margin-bottom: 8px;">Resumo da sua conta</p>
      ${listaItens ? `<ul style="margin: 0 0 14px 0; padding-left: 18px;">${listaItens}</ul>` : ""}
      <p style="${fonte} font-weight: 700; margin-bottom: 6px;">Plano atual x proposta</p>
      <table style="border-collapse: collapse; margin-bottom: 6px;" cellspacing="0" cellpadding="0">
        <tr>
          <th style="${thBase}">Item</th>
          <th style="${thBase}">Atual</th>
          <th style="${thBase}">Proposta</th>
        </tr>
        ${linhasTr}
      </table>
      ${economiaHtml}
    </div>
  `;
}

async function copiarTexto(texto) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch (e) {
    // segue pro fallback
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = texto;
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch (e) {
    return false;
  }
}

async function copiarHtmlRico(html, textoPlano) {
  // Copia como HTML de verdade (tabela renderizada), não como texto puro — pra colar
  // no Outlook/Word/Gmail em modo rico e a tabela aparecer formatada.
  try {
    if (navigator.clipboard && window.isSecureContext && window.ClipboardItem) {
      const item = new window.ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([textoPlano], { type: "text/plain" }),
      });
      await navigator.clipboard.write([item]);
      return true;
    }
  } catch (e) {
    // segue pro fallback
  }
  try {
    const div = document.createElement("div");
    div.setAttribute("contenteditable", "true");
    div.style.position = "fixed";
    div.style.top = "-9999px";
    div.style.opacity = "0";
    div.innerHTML = html;
    document.body.appendChild(div);
    const range = document.createRange();
    range.selectNodeContents(div);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    const ok = document.execCommand("copy");
    sel.removeAllRanges();
    document.body.removeChild(div);
    return ok;
  } catch (e) {
    return false;
  }
}

const sans = "system-ui, -apple-system, sans-serif";
const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

const CONFIG_PADRAO = {
  nomeEmpresa: "Vivo Empresas",
  nomeInternetFixa: "Vivo Fibra",
  mesesFidelidadeTotal: 24,
  mesesElegibilidade: 17,
  metaProdutoNome: "banda larga",
  metaProdutoQtd: 2,
  nomeConsultor: "",
};

const PLANOS_BL_PADRAO = [
  { velocidade: "400MB", valor: 79.99 },
  { velocidade: "500MB", valor: 89.99 },
  { velocidade: "600MB", valor: 94.99 },
  { velocidade: "700MB", valor: 99.99 },
  { velocidade: "1GB", valor: 199.99 },
  { velocidade: "2GB", valor: 399.99 },
  { velocidade: "10GB", valor: 1999.99 },
];

function diasDesde(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function diasUteisDesde(iso, feriadosSet) {
  const inicio = new Date(iso);
  const hoje = new Date();
  let count = 0;
  const d = new Date(inicio);
  d.setHours(0, 0, 0, 0);
  const fimHoje = new Date(hoje);
  fimHoje.setHours(0, 0, 0, 0);
  while (d < fimHoje) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    const dataStr = d.toISOString().slice(0, 10);
    if (dow !== 0 && dow !== 6 && !(feriadosSet && feriadosSet.has(dataStr))) count++;
  }
  return count;
}

function norm(s) {
  return (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function mapTvRow(headers, row) {
  const out = { raw: {} };
  headers.forEach((h, i) => {
    const key = norm(h);
    const val = row[i];
    out.raw[h] = val;
    if (key.includes("PLANO") || key.includes("NOME") || key.includes("PACOTE")) out.nome = val;
    else if (key.includes("CANAIS") || key.includes("CANAL")) out.canais = val;
    else if (key.includes("VALOR") || key.includes("PRECO")) out.valor = parseFloat((val || "").toString().replace(",", ".")) || 0;
  });
  if (!out.nome) out.nome = row[0] || "—";
  return out;
}

function mapPhoneRow(headers, row) {
  const out = { raw: {} };
  headers.forEach((h, i) => {
    const key = norm(h);
    const val = row[i];
    out.raw[h] = val;
    const limpo = (val || "").toString().replace(/[^\d,.-]/g, "");
    const num = parseFloat(limpo.replace(/\./g, "").replace(",", ".")) || 0;
    if (key.includes("MODELO") || key.includes("APARELHO") || key.includes("NOME")) {
      out.nome = val;
    } else if (key === "10X" || (key.includes("10") && key.includes("VEZES"))) {
      out.parcela10x = num;
    } else if (key === "24X" || (key.includes("24") && key.includes("VEZES"))) {
      out.parcela24x = num;
    } else if (key.includes("VALOR") && key.includes("10")) {
      out.precoTotal10x = num;
    } else if (key.includes("VALOR") && key.includes("24")) {
      out.precoTotal24x = num;
    } else if (key.includes("PRECOTOTAL") || key.includes("VALORTOTAL") || key === "PRECO" || key === "VALOR") {
      out.precoTotal = num;
    }
  });
  if (!out.nome) out.nome = row[0] || "—";
  if (!out.precoTotal) {
    out.precoTotal =
      out.precoTotal10x || out.precoTotal24x || (out.parcela10x ? out.parcela10x * 10 : out.parcela24x ? out.parcela24x * 24 : 0);
  }
  // Quando a coluna de parcela vem zerada/ausente mas existe o valor total do plano,
  // calcula a parcela em vez de mostrar R$ 0,00 ou esconder o aparelho.
  if ((!out.parcela10x || out.parcela10x <= 0) && out.precoTotal10x > 0) {
    out.parcela10x = out.precoTotal10x / 10;
  }
  if ((!out.parcela24x || out.parcela24x <= 0) && out.precoTotal24x > 0) {
    out.parcela24x = out.precoTotal24x / 24;
  }
  return out;
}

function dedupeAparelhos(lista) {
  const porNome = new Map();
  lista.forEach((item) => {
    const chave = norm(item.nome);
    if (!chave) return;
    const existente = porNome.get(chave);
    // mantém a entrada mais completa (com maior preço definido) quando há duplicatas
    if (!existente || (item.precoTotal || 0) > (existente.precoTotal || 0)) {
      porNome.set(chave, item);
    }
  });
  return Array.from(porNome.values());
}

function mapRow(headers, row) {
  const out = { raw: {} };
  headers.forEach((h, i) => {
    const key = norm(h);
    const val = row[i];
    out.raw[h] = val;
    if (key.includes("CNPJ")) out.cnpj = val;
    else if (key.includes("RAZAO") || key === "CLIENTE" || key.includes("NOMECLIENTE"))
      out.cliente = val;
    else if (key.includes("LINHAS") && key.includes("T")) out.linhasTotais = parseFloat(val) || 0;
    else if (key.includes("LINHASA") || key === "LINHASATIVAS") out.linhasAtivas = parseFloat(val) || 0;
    else if (key.includes("CONSULTOR")) out.consultor = val;
    else if (key === "M" || key.includes("MESFIDELIDADE") || key.includes("FIDELIDADE") || key.includes("MESES"))
      out.mesesFidelidade = parseFloat(val) || 0;
    else if (key.includes("CONTATO") || key.includes("TELEFONE") || key.includes("FONE"))
      out.telefone = val;
    else if (key.includes("CREDITO") && key.includes("MENSAL")) out.creditoMensal = parseFloat(val) || 0;
    else if (key.includes("CREDITO")) out.credito = parseFloat(val) || 0;
  });
  if (!out.cliente) {
    const firstCol = headers[0];
    out.cliente = row[0] || "—";
  }
  return out;
}

function classificarPorte(faturamento) {
  if (!faturamento || faturamento <= 0) return null;
  if (faturamento <= 81000) return { porte: "MEI", posicao: 0, tom: "simplicidade e custo baixo, do jeito que costuma encaixar melhor nesse momento" };
  if (faturamento <= 360000) return { porte: "Microempresa", posicao: 0.2, tom: "um upgrade de estrutura sem pesar no orçamento" };
  if (faturamento <= 4800000) return { porte: "Pequena empresa", posicao: 0.45, tom: "mais capacidade pra acompanhar o crescimento da operação" };
  if (faturamento <= 30000000) return { porte: "Médio porte", posicao: 0.75, tom: "estabilidade pra suportar o volume de uma operação maior" };
  return { porte: "Grande porte", posicao: 1, tom: "alta capacidade e confiabilidade pra uma operação desse porte" };
}

function sugerirPlano(planos, faturamento) {
  const info = classificarPorte(faturamento);
  if (!info || planos.length === 0) return { indice: 0, info: null };
  const ordenados = [...planos].sort((a, b) => a.valor - b.valor);
  const pos = Math.round(info.posicao * (ordenados.length - 1));
  const escolhido = ordenados[pos];
  const indice = planos.indexOf(escolhido);
  return { indice: indice >= 0 ? indice : 0, info };
}

function statusCobertura(lead) {
  const cov = (lead.cobertura || "").toUpperCase();
  if (cov.includes("VÁLIDA") || cov.includes("VALIDA")) return "valida";
  if (cov.includes("SEM COBERTURA")) return "sem";
  if (cov.includes("NÃO ENCONTRADO") || cov.includes("NAO ENCONTRADO")) return "nao_encontrado";
  if (cov.includes("OUTRO") || cov.includes("ERRO") || cov.includes("VAZIO") || cov.includes("INVÁLIDOS")) return "erro";
  return "nao_consultado";
}
const COBERTURA_BADGE = {
  valida:         { txt: "✅ cobertura",           cor: "#3fb8af" },
  sem:            { txt: "❌ sem cobertura",       cor: "#c65a4e" },
  nao_encontrado: { txt: "❓ endereço não achado", cor: "#e0a030" },
  erro:           { txt: "⚠️ erro na consulta",    cor: "#e0a030" },
  nao_consultado: { txt: "— não consultado",      cor: "#5b6b73" },
};

function mapRowBandaLarga(headers, row) {
  const out = { raw: {} };
  const telefonesPorIndice = {};
  headers.forEach((h, i) => {
    const key = norm(h);
    const val = (row[i] || "").toString().trim();
    out.raw[h] = val;
    if (key === "EMPRESA") out.empresa = val;
    else if (key === "DOCUMENTO") out.cnpj = val;
    else if (key === "CIDADE") out.cidade = val;
    else if (key === "UF") out.uf = val;
    else if (key === "CEP") out.cep = val;
    else if (key === "NUMERO") out.numero = val;
    else if (key === "LOGRADOURO") out.logradouro = val;
    else if (key === "CDCNAE" || key === "CNAE") out.cnae = val;
    else if (key.includes("FATPRESUMIDO") || key.includes("FATURAMENTO")) out.faturamento = parseFloat(val) || 0;
    else if (/^TELEFONE\d*$/.test(key)) {
      if (val) telefonesPorIndice[key] = val;
    } else if (key === "ESTRATEGIA") out.estrategia = val;
    else if (key === "ARMARIO") out.armario = val;
    else if (key === "OFERTAMKT") out.ofertaMkt = val;
	else if (key.includes("COBERTURA")) out.cobertura = val;   // ← coluna COBERTURA_VIVO do bo
  });
  const telefones = Object.keys(telefonesPorIndice)
    .sort()
    .map((k) => telefonesPorIndice[k]);
  out.telefone = telefones[0] || "";
  out.telefonesExtras = telefones.slice(1);
  out.enderecoResumo = [out.logradouro, out.cidade && out.uf ? `${out.cidade}/${out.uf}` : out.cidade || out.uf]
    .filter(Boolean)
    .join(" - ");
  if (!out.empresa) out.empresa = row[0] || "—";
  return out;
}

function Field({ label, children, hint }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: C.textDim,
          marginBottom: 5,
          fontFamily: sans,
        }}
      >
        {label}
      </div>
      {children}
      {hint && <div style={{ fontSize: 11, color: C.textFaint, marginTop: 3 }}>{hint}</div>}
    </label>
  );
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  background: C.panelAlt,
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  padding: "8px 10px",
  color: C.text,
  fontSize: 14,
  fontFamily: mono,
  outline: "none",
};

function NumberInput({ value, onChange, placeholder, suffix }) {
  return (
    <div style={{ position: "relative" }}>
      <input
        style={inputStyle}
        type="number"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {suffix && (
        <span
          style={{
            position: "absolute",
            right: 10,
            top: 8,
            fontSize: 12,
            color: C.textFaint,
            fontFamily: mono,
          }}
        >
          {suffix}
        </span>
      )}
    </div>
  );
}

function TextInput({ value, onChange, placeholder }) {
  return (
    <input
      style={{ ...inputStyle, fontFamily: sans }}
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "4px 0",
        color: C.text,
        fontFamily: sans,
        fontSize: 13,
      }}
    >
      <span
        style={{
          width: 30,
          height: 17,
          borderRadius: 10,
          background: checked ? C.teal : C.border,
          position: "relative",
          transition: "background 0.15s",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 15 : 2,
            width: 13,
            height: 13,
            borderRadius: "50%",
            background: C.bg,
            transition: "left 0.15s",
          }}
        />
      </span>
      {label}
    </button>
  );
}

function Stat({ label, value, accent, badge }) {
  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase", color: C.textFaint }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
        <div style={{ fontFamily: mono, fontSize: 15, color: accent || C.text }}>{value}</div>
        {badge && (
          <span
            style={{
              fontSize: 9,
              textTransform: "uppercase",
              color: C.bg,
              background: C.teal,
              borderRadius: 3,
              padding: "1px 5px",
              fontFamily: sans,
            }}
          >
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------- Mailing tab ----------------

function MailingTab({ leads, setLeads, onUseLead }) {
  const fileRef = useRef(null);
  const [sortBy, setSortBy] = useState("creditoMensal");
  const [busca, setBusca] = useState("");

  const handleFile = (file) => {
    Papa.parse(file, {
      complete: (res) => {
        const rows = res.data.filter((r) => r.length > 1 && r.some((c) => c && c.toString().trim()));
        if (rows.length < 2) return;
        const headers = rows[0];
        const parsed = rows.slice(1).map((r) => mapRow(headers, r));
        setLeads(parsed);
      },
      skipEmptyLines: true,
    });
  };

  const sorted = useMemo(() => {
    let arr = [...leads];
    if (busca.trim()) {
      const b = norm(busca);
      arr = arr.filter((l) => norm(l.cliente).includes(b) || norm(l.cnpj).includes(b));
    }
    arr.sort((a, b) => {
      if (sortBy === "creditoMensal") return (b.creditoMensal || 0) - (a.creditoMensal || 0);
      if (sortBy === "reativacao")
        return (b.linhasTotais - b.linhasAtivas || 0) - (a.linhasTotais - a.linhasAtivas || 0);
      return 0;
    });
    return arr;
  }, [leads, sortBy, busca]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          background: C.panel,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: 18,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: C.textFaint }}>
              Carteira do dia
            </div>
            <div style={{ fontSize: 13, color: C.textDim, marginTop: 2 }}>
              {leads.length ? `${leads.length} clientes carregados` : "Nenhum mailing carregado ainda"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cliente ou CNPJ"
              style={{ ...inputStyle, width: 180, fontFamily: sans, fontSize: 12, padding: "6px 8px" }}
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{ ...inputStyle, width: "auto", fontFamily: sans, fontSize: 12, padding: "6px 8px" }}
            >
              <option value="creditoMensal">Ordenar: crédito mensal</option>
              <option value="reativacao">Ordenar: linhas p/ reativar</option>
            </select>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              style={{ display: "none" }}
              onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
            />
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                background: "none",
                border: `1px solid ${C.tealDim}`,
                color: C.teal,
                borderRadius: 4,
                padding: "7px 12px",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: sans,
              }}
            >
              Importar CSV
            </button>
          </div>
        </div>
        <div style={{ fontSize: 11, color: C.textFaint, marginTop: 8 }}>
          Exporte o mailing do sistema como CSV e importe aqui. Colunas reconhecidas: cliente,
          CNPJ, linhas ativas/totais, consultor, contato, crédito e crédito mensal.
        </div>
      </div>

      {sorted.length > 0 && (
        <div
          style={{
            background: C.panel,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: 0,
            overflow: "hidden",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: mono, fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: C.panelAlt, textAlign: "left" }}>
                  {["Cliente", "CNPJ", "Linhas", "Reativar", "Fidelidade", "Crédito", "Créd. mensal", "Contato", ""].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "8px 10px",
                        color: C.textFaint,
                        fontWeight: 400,
                        fontFamily: sans,
                        fontSize: 10.5,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        borderBottom: `1px solid ${C.border}`,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((l, i) => {
                  const reativar = (l.linhasTotais || 0) - (l.linhasAtivas || 0);
                  return (
                    <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: "7px 10px", color: C.text, fontFamily: sans, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {l.cliente}
                      </td>
                      <td style={{ padding: "7px 10px", color: C.textDim }}>{l.cnpj}</td>
                      <td style={{ padding: "7px 10px", color: C.textDim }}>
                        {l.linhasAtivas ?? "—"}/{l.linhasTotais ?? "—"}
                      </td>
                      <td style={{ padding: "7px 10px", color: reativar > 0 ? C.amber : C.textFaint }}>
                        {reativar > 0 ? `+${reativar}` : "—"}
                      </td>
                      <td style={{ padding: "7px 10px", color: C.textDim }}>
                        {l.mesesFidelidade != null ? `${l.mesesFidelidade}m` : "—"}
                      </td>
                      <td style={{ padding: "7px 10px", color: C.textDim }}>
                        {l.credito ? fmtBRL(l.credito) : "—"}
                      </td>
                      <td style={{ padding: "7px 10px", color: l.creditoMensal ? C.teal : C.textFaint }}>
                        {l.creditoMensal ? fmtBRL(l.creditoMensal) : "—"}
                      </td>
                      <td style={{ padding: "7px 10px", color: C.textDim }}>{l.telefone}</td>
                      <td style={{ padding: "7px 10px" }}>
                        <button
                          onClick={() => onUseLead(l)}
                          style={{
                            background: "none",
                            border: `1px solid ${C.border}`,
                            color: C.teal,
                            borderRadius: 4,
                            padding: "4px 8px",
                            fontSize: 11,
                            cursor: "pointer",
                            fontFamily: sans,
                            whiteSpace: "nowrap",
                          }}
                        >
                          Usar na proposta →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- Proposta tab ----------------

function PropostaTab({ prefill, aparelhos, tv, config, onRegistrarEnvio }) {
  const [produtoPrincipal, setProdutoPrincipal] = useState("banda_larga");
  const [canalEnvio, setCanalEnvio] = useState("whatsapp");
  const [statusRegistro, setStatusRegistro] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [razao, setRazao] = useState("");
  const [endereco, setEndereco] = useState(null);
  const [buscandoEndereco, setBuscandoEndereco] = useState(false);
  const [erroEndereco, setErroEndereco] = useState("");
  const [nLinhas, setNLinhas] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [franquiaContratada, setFranquiaContratada] = useState("");
  const [novaFranquia, setNovaFranquia] = useState("");
  const [novaQtdLinhas, setNovaQtdLinhas] = useState("");
  const [valorProposta, setValorProposta] = useState("");
  const [limiteCreditoAparelho, setLimiteCreditoAparelho] = useState("");
  const [prazoOferta, setPrazoOferta] = useState("");
  const [fidelidadeMeses, setFidelidadeMeses] = useState("");
  const [temBandaLarga, setTemBandaLarga] = useState(false);
  const [parcelandoCelular, setParcelandoCelular] = useState(false);
  const [coberturaFibra, setCoberturaFibra] = useState(false);
  const [bandaLargaLinhas, setBandaLargaLinhas] = useState([]);
  const [temTvCabo, setTemTvCabo] = useState(false);
  const [temTelefoneFixo, setTemTelefoneFixo] = useState(false);
  const [ofertarPortabilidade, setOfertarPortabilidade] = useState(true);
  const [tentouWhatsapp, setTentouWhatsapp] = useState(false);
  const [telefoneFixoLinhas, setTelefoneFixoLinhas] = useState([]);
  const [contatoNome, setContatoNome] = useState("");
  const [contatoFone, setContatoFone] = useState("");
  const [cepAlternativo, setCepAlternativo] = useState("");
  const [enderecoAlternativo, setEnderecoAlternativo] = useState(null);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [erroCep, setErroCep] = useState("");

  React.useEffect(() => {
    if (!prefill) return;
    if (prefill.cliente) setRazao(prefill.cliente);
    if (prefill.cnpj) setCnpj(prefill.cnpj);
    if (prefill.telefone) setContatoFone(prefill.telefone);
    if (prefill.linhasAtivas) setNLinhas(String(prefill.linhasAtivas));
    if (prefill.mesesFidelidade) setFidelidadeMeses(String(prefill.mesesFidelidade));
	if (prefill.coberturaFibra != null) {
		setTemBandaLarga(false);
		setCoberturaFibra(!!prefill.coberturaFibra);
	}
  }, [prefill]);

  const nl = parseFloat(nLinhas) || 0;
  const vt = parseFloat(valorTotal) || 0;
  const fc = parseFloat(franquiaContratada) || 0;
  const nf = parseFloat(novaFranquia) || 0;
  const nql = parseFloat(novaQtdLinhas) || 0;
  const vp = parseFloat(valorProposta) || 0;
  const fid = parseFloat(fidelidadeMeses) || 0;

  const elegivelRenovacao = fid >= config.mesesElegibilidade;
  const mesesParaElegibilidade = Math.max(0, config.mesesElegibilidade - fid);
  const ticketMedio = nl > 0 ? vt / nl : 0;
  const economia = vt > 0 && vp > 0 ? vt - vp : null;
  const linhasCortesia = nql > 0 && nl > 0 ? nql - nl : 0;
  const limiteNum = parseFloat(limiteCreditoAparelho) || 0;

  const addLinhaBandaLarga = () =>
    setBandaLargaLinhas((l) => [...l, { id: Date.now() + Math.random(), velocidade: "", qtd: "1" }]);
  const atualizarLinhaBandaLarga = (id, campo, valor) =>
    setBandaLargaLinhas((l) => l.map((r) => (r.id === id ? { ...r, [campo]: valor } : r)));
  const removerLinhaBandaLarga = (id) => setBandaLargaLinhas((l) => l.filter((r) => r.id !== id));

  const addLinhaTelefoneFixo = () =>
    setTelefoneFixoLinhas((l) => [...l, { id: Date.now() + Math.random(), numero: "" }]);
  const atualizarLinhaTelefoneFixo = (id, valor) =>
    setTelefoneFixoLinhas((l) => l.map((r) => (r.id === id ? { ...r, numero: valor } : r)));
  const removerLinhaTelefoneFixo = (id) => setTelefoneFixoLinhas((l) => l.filter((r) => r.id !== id));

  const buscarEndereco = async () => {
    const digitos = cnpj.replace(/\D/g, "");
    if (digitos.length !== 14) {
      setErroEndereco("CNPJ precisa ter 14 dígitos.");
      return;
    }
    setErroEndereco("");
    setBuscandoEndereco(true);
    try {
      const chaveCache = `cnpj-endereco:${digitos}`;
      try {
        const cache = await window.storage.get(chaveCache, false);
        if (cache?.value) {
          setEndereco(JSON.parse(cache.value));
          setBuscandoEndereco(false);
          return;
        }
      } catch (e) {
        // sem cache, segue pra buscar na API
      }

      const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digitos}`);
      if (!resp.ok) throw new Error("CNPJ não encontrado ou API indisponível.");
      const data = await resp.json();
      const end = {
        logradouro: data.logradouro || "",
        numero: data.numero || "",
        bairro: data.bairro || "",
        municipio: data.municipio || "",
        uf: data.uf || "",
        cep: data.cep || "",
        razaoSocial: data.razao_social || "",
        situacaoCadastral: (data.descricao_situacao_cadastral || "").toUpperCase(),
      };
      const partes = [
        [end.logradouro, end.numero].filter(Boolean).join(", "),
        end.bairro,
        end.municipio && end.uf ? `${end.municipio}/${end.uf}` : end.municipio || end.uf,
      ].filter(Boolean);
      end.resumo = partes.join(" - ");
      setEndereco(end);
      try {
        await window.storage.set(chaveCache, JSON.stringify(end), false);
      } catch (e) {
        // segue mesmo sem conseguir cachear
      }
      if (!razao && end.razaoSocial) setRazao(end.razaoSocial);
    } catch (e) {
      setErroEndereco("Não foi possível consultar esse CNPJ agora.");
    } finally {
      setBuscandoEndereco(false);
    }
  };

  const buscarCep = async () => {
    const digitos = cepAlternativo.replace(/\D/g, "");
    if (digitos.length !== 8) {
      setErroCep("CEP precisa ter 8 dígitos.");
      return;
    }
    setErroCep("");
    setBuscandoCep(true);
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
      const data = await resp.json();
      if (data.erro) throw new Error("CEP não encontrado.");
      const partes = [
        [data.logradouro, data.bairro].filter(Boolean).join(", "),
        data.localidade && data.uf ? `${data.localidade}/${data.uf}` : data.localidade || data.uf,
      ].filter(Boolean);
      setEnderecoAlternativo({ ...data, resumo: partes.join(" - ") });
    } catch (e) {
      setErroCep("Não foi possível consultar esse CEP agora.");
      setEnderecoAlternativo(null);
    } finally {
      setBuscandoCep(false);
    }
  };
  const aparelhosDisponiveis = useMemo(() => {
    if (!limiteNum) return [];
    return aparelhos
      .map((a) => {
        const total10 = a.precoTotal10x || (a.parcela10x ? a.parcela10x * 10 : 0);
        const total24 = a.precoTotal24x || (a.parcela24x ? a.parcela24x * 24 : 0);
        const cabe10x = total10 > 0 && total10 <= limiteNum && (a.parcela10x || 0) > 0;
        const cabe24x = total24 > 0 && total24 <= limiteNum && (a.parcela24x || 0) > 0;
        return { ...a, total10, total24, cabe10x, cabe24x };
      })
      .filter((a) => a.cabe10x || a.cabe24x);
  }, [aparelhos, limiteNum]);

  const oportunidades = useMemo(() => {
    const list = [];
    if (endereco?.situacaoCadastral && endereco.situacaoCadastral !== "ATIVA") {
      list.push({
        tipo: "Alerta crítico",
        texto: `CNPJ com situação "${endereco.situacaoCadastral}" na Receita — confirme se a empresa segue operando antes de prosseguir.`,
        cor: C.red,
      });
    }
    if (!temBandaLarga && coberturaFibra) {
      list.push({ tipo: "Cross-sell", texto: `Sem banda larga ativa e com cobertura ${config.nomeInternetFixa} confirmada — prioridade alta.`, cor: C.teal });
    } else if (!temBandaLarga && !coberturaFibra) {
      list.push({ tipo: "Verificar", texto: "Sem banda larga ativa, mas cobertura de fibra ainda não confirmada — consultar sistema de cobertura antes de ofertar.", cor: C.textDim });
    }
    if (fc > 0 && nf > fc) {
      list.push({ tipo: "Upgrade real", texto: `Nova franquia (${nf}GB) maior que a atual (${fc}GB) — reforçar esse ganho na abordagem.`, cor: C.teal });
    }
    if (economia !== null && economia > 0) {
      list.push({ tipo: "Redução", texto: `Proposta reduz a fatura em ${fmtBRL(economia)}/mês frente ao valor atual.`, cor: C.teal });
    }
    if (fid > config.mesesFidelidadeTotal) {
      list.push({
        tipo: "Renovação urgente",
        texto: `Fidelidade vencida há ${fid - config.mesesFidelidadeTotal} mês(es) — sem contrato de permanência ativo, o cliente pode migrar a qualquer momento. Prioridade máxima.`,
        cor: C.amber,
      });
    } else if (elegivelRenovacao) {
      list.push({ tipo: "Renovação", texto: `${fid} meses de fidelidade — elegível (a partir de ${config.mesesElegibilidade}/${config.mesesFidelidadeTotal}).`, cor: C.teal });
    } else if (fid > 0) {
      list.push({ tipo: "Aquecimento", texto: `Faltam ${mesesParaElegibilidade} meses para elegibilidade (${config.mesesElegibilidade}/${config.mesesFidelidadeTotal}).`, cor: C.textDim });
    }
    if (parcelandoCelular) {
      list.push({ tipo: "Fidelidade", texto: "Já parcelando aparelho — usar como argumento de fidelidade na proposta, não ofertar novo crédito.", cor: C.teal });
    } else if (limiteNum > 0) {
      list.push({ tipo: "Cross-sell", texto: "Crédito de celular disponível e sem uso — oferta de upgrade de aparelho é válida.", cor: C.teal });
    }
    if (!temTvCabo && tv.length > 0) {
      list.push({ tipo: "Cross-sell", texto: "Sem TV a cabo ativa e há planos no catálogo — produto passou a comissionar.", cor: C.teal });
    }
    return list;
  }, [temBandaLarga, coberturaFibra, fc, nf, economia, elegivelRenovacao, fid, mesesParaElegibilidade, parcelandoCelular, limiteNum, temTvCabo, tv, config, endereco]);

  // Blocos de conteúdo compartilhados entre e-mail e WhatsApp — cada bloco cobre um
  // cenário (elegível/aquecendo/sem dado, com/sem cobertura, com/sem aparelho no limite).
  const blocos = useMemo(() => {
    let estagio = "sem_info";
    if (fid > config.mesesFidelidadeTotal) estagio = "vencido";
    else if (fid >= config.mesesElegibilidade) estagio = "elegivel";
    else if (fid > 0) estagio = "aquecendo";

    let aparelhoOferta = "sem_limite";
    if (limiteNum > 0) aparelhoOferta = aparelhosDisponiveis.length > 0 ? "disponivel" : "indisponivel";
    const aparelhoFidelidade = parcelandoCelular;

    let bandaLargaStatus = "ja_tem";
    if (!temBandaLarga) bandaLargaStatus = coberturaFibra ? "com_cobertura" : "sem_cobertura";
    const bandaLargaResumo = resumoConexoes(bandaLargaLinhas);

    let tvStatus = "nenhum";
    if (temTvCabo) tvStatus = "ja_tem";
    else if (tv.length > 0) tvStatus = "disponivel";

    const telefoneFixoStatus = temTelefoneFixo ? "ja_tem" : "oferta";
    const telefoneFixoNumeros = telefoneFixoLinhas.map((r) => r.numero).filter(Boolean);

    const temComparacao = vt > 0 || vp > 0;
    const economiaAnual = economia && economia > 0 ? economia * 12 : null;

    // Quadro do que a empresa já tem hoje, pra credibilidade antes da proposta
    const portfolioAtual = [];
    if (nl > 0) portfolioAtual.push({ icone: "📱", texto: `${nl} linha${nl > 1 ? "s" : ""} ${nl > 1 ? "móveis" : "móvel"}` });
    if (temTelefoneFixo) {
      portfolioAtual.push({
        icone: "📞",
        texto:
          telefoneFixoNumeros.length > 0
            ? `${telefoneFixoNumeros.length} linha${telefoneFixoNumeros.length > 1 ? "s" : ""} de telefone fixo (${telefoneFixoNumeros.join(", ")})`
            : "Telefone fixo ativo",
      });
    }
    if (temBandaLarga) {
      portfolioAtual.push({ icone: "🌐", texto: bandaLargaResumo ? `Banda larga: ${bandaLargaResumo}` : "Banda larga ativa" });
    }
    if (temTvCabo) portfolioAtual.push({ icone: "📺", texto: "TV a cabo ativa" });

    // Listas unificadas — em vez de um parágrafo repetitivo por serviço, uma frase
    // só juntando tudo que já é fidelidade e outra juntando tudo que ainda é oferta.
    const jaTemLista = [];
    if (bandaLargaStatus === "ja_tem") jaTemLista.push(`banda larga (${bandaLargaResumo || "ativa"})`);
    if (telefoneFixoStatus === "ja_tem") {
      const n = telefoneFixoNumeros.length;
      jaTemLista.push(n > 0 ? `telefone fixo (${n} linha${n > 1 ? "s" : ""})` : "telefone fixo");
    }
    if (tvStatus === "ja_tem") jaTemLista.push("TV a cabo");
    if (aparelhoFidelidade) jaTemLista.push("aparelho financiado");

    const ofertasLista = [];
    if (bandaLargaStatus === "com_cobertura" || bandaLargaStatus === "sem_cobertura") ofertasLista.push("banda larga");
    if (telefoneFixoStatus === "oferta") ofertasLista.push("telefone fixo");
    if (tvStatus === "disponivel") ofertasLista.push("TV a cabo");
    if (aparelhoOferta === "disponivel" || aparelhoOferta === "indisponivel") ofertasLista.push("um aparelho novo");

    return {
      estagio,
      aparelhoOferta,
      aparelhoFidelidade,
      bandaLargaStatus,
      bandaLargaResumo,
      tvStatus,
      telefoneFixoStatus,
      telefoneFixoNumeros,
      temComparacao,
      economiaAnual,
      portfolioAtual,
      jaTemLista,
      ofertasLista,
    };
  }, [
    fid,
    config,
    limiteNum,
    aparelhosDisponiveis,
    parcelandoCelular,
    temBandaLarga,
    coberturaFibra,
    bandaLargaLinhas,
    temTvCabo,
    tv,
    temTelefoneFixo,
    telefoneFixoLinhas,
    nl,
    vt,
    vp,
    economia,
  ]);

  const aberturaMsg = useMemo(() => {
    const nome = contatoNome || "[nome do contato]";
    const empresa = razao || "[razão social]";
    const assinatura = config.nomeConsultor ? `Aqui é o ${config.nomeConsultor}, da ${config.nomeEmpresa}` : `Aqui é da ${config.nomeEmpresa}`;
    return `Oi ${nome}, tudo bem? ${assinatura}. Tava revisando a conta da ${empresa} aqui no sistema e vi que dá pra reduzir bastante o custo das linhas de vocês, aproveitando o tempo que já são clientes. Você é quem cuida da parte de telefonia aí, ou tem outra pessoa que eu falo?`;
  }, [contatoNome, razao, config]);

  const emailMsg = useMemo(() => {
    const nome = contatoNome;
    let corpo = nome ? `Olá, ${nome}! Tudo bem?\n\n` : `Olá! Tudo bem?\n\n`;

    if (tentouWhatsapp) {
      corpo += `Tentei falar com vocês por WhatsApp, mas não tive retorno — por isso resolvi escrever por aqui também.\n\n`;
    }

    if (blocos.estagio === "vencido") {
      corpo += `Seu contrato de fidelidade já venceu. Isso significa que hoje vocês não têm mais nenhuma permanência ativa — podem migrar quando quiserem, e também é o melhor momento pra travar uma condição nova antes de continuar pagando tabela cheia:\n\n`;
    } else if (blocos.estagio === "elegivel") {
      corpo += `Seu contrato está prestes a acabar. Como cliente fidelizado, consegui liberar uma condição especial de renovação pra vocês — quero fechar isso antes que ela saia do sistema.\n\n`;
    } else if (blocos.estagio === "aquecendo") {
      corpo += `Estou passando pra te mostrar uma oportunidade que já reduz seu custo hoje, sem você precisar esperar nada:\n\n`;
    } else {
      corpo += `Revisando a conta da sua empresa, encontrei uma forma de melhorar sua condição atual:\n\n`;
    }

    if (linhasCortesia > 0) {
      corpo += `A proposta inclui ${linhasCortesia} linha(s) de cortesia, sem custo adicional, reduzindo o valor por linha.\n\n`;
    }

    if (blocos.temComparacao) {
      const quadro = montarQuadroResumo({
        portfolioAtual: blocos.portfolioAtual,
        linhasComparativo: [
          ["Linhas", `${nl || "?"}`, `${nql || "?"}${linhasCortesia > 0 ? ` (+${linhasCortesia})` : ""}`],
          ["Franquia", `${fc || "?"}GB`, `${nf || "?"}GB`],
          ["Valor", vt ? fmtBRL(vt) : "?", vp ? fmtBRL(vp) : "?"],
        ],
        economiaTxt: blocos.economiaAnual
          ? `Você economiza ${fmtBRL(economia)}/mês — ${fmtBRL(blocos.economiaAnual)} ao longo de um ano`
          : "",
      });
      corpo += quadro + "\n\n";
    } else if (blocos.portfolioAtual.length > 0) {
      corpo += `Hoje sua empresa tem com a gente:\n`;
      blocos.portfolioAtual.forEach((item) => (corpo += `${item.icone}  ${item.texto}\n`));
      corpo += `\n`;
    }

    if (blocos.jaTemLista.length > 0) {
      corpo += `Além disso, vocês já são clientes fiéis também em ${joinNatural(blocos.jaTemLista)} — isso conta a favor da condição especial que consegui pra vocês.\n\n`;
    }

    if (blocos.ofertasLista.length > 0) {
      corpo += `E já que essa fidelidade toda ajuda, separei um combo pra vocês economizarem ainda mais: incluindo ${joinNatural(blocos.ofertasLista)} na proposta, consigo aumentar o desconto. Topa que eu já cote isso junto?\n\n`;
    }

    if (blocos.aparelhoOferta === "disponivel") {
      corpo += `No caso do aparelho, você tem ${fmtBRL(limiteNum)} em limite de crédito. Já separei estas opções dentro desse limite:\n`;
      aparelhosDisponiveis.forEach((a) => {
        const partes = [];
        if (a.cabe10x) partes.push(`10x de ${fmtBRL(a.parcela10x)} (total ${fmtBRL(a.total10)})`);
        if (a.cabe24x) partes.push(`24x de ${fmtBRL(a.parcela24x)} (total ${fmtBRL(a.total24)})`);
        corpo += `- ${a.nome}${partes.length ? `: ${partes.join(" ou ")}` : ""}\n`;
      });
      corpo += `\n`;
    } else if (blocos.aparelhoOferta === "indisponivel") {
      corpo += `Sobre o aparelho: você tem ${fmtBRL(limiteNum)} em limite de crédito, mas nenhum modelo do catálogo atual coube nesse valor — me diga se tem preferência de marca que eu vejo alternativas.\n\n`;
    }

    if (blocos.bandaLargaStatus === "com_cobertura") {
      const endTxt = endereco?.resumo ? ` (${endereco.resumo})` : "";
      corpo += `Sobre a banda larga: identifiquei cobertura de ${config.nomeInternetFixa} confirmada no endereço da sua empresa${endTxt}.\n\n`;
    } else if (blocos.bandaLargaStatus === "sem_cobertura") {
      const endTxt = endereco?.resumo ? ` (${endereco.resumo})` : "";
      corpo += `Sobre a banda larga: no endereço cadastrado${endTxt} ainda não identifiquei cobertura de ${config.nomeInternetFixa}. `;
      corpo += enderecoAlternativo?.resumo
        ? `Já verifiquei o endereço que você me passou (${enderecoAlternativo.resumo}) e vou confirmar viabilidade por lá também.\n\n`
        : `Se tiver outra filial ou endereço, me envie o CEP que eu checo.\n\n`;
    }

    if (ofertarPortabilidade) {
      corpo += `Se vocês tiverem alguma linha ativa em outra operadora, também consigo portar o número pra Vivo sem burocracia nenhuma pro usuário — só me passar a operadora atual e a quantidade que já incluo isso na proposta.\n\n`;
    }

    corpo += prazoOferta
      ? `Essa condição fica reservada até ${prazoOferta}. Depois disso, o valor volta à tabela vigente.\n\n`
      : `Vou manter essa condição reservada até o fim da semana.\n\n`;

    corpo +=
      blocos.estagio === "aquecendo"
        ? `Já deixo o link pronto pra essa parte que já vale hoje. Prefere que eu envie agora, ou quer me ligar antes pra entender melhor?`
        : `Já deixo o link de confirmação pronto pra você. Prefere que eu envie agora mesmo, ou quer me ligar antes pra tirar alguma dúvida sobre os números?`;
    return corpo;
  }, [contatoNome, fid, mesesParaElegibilidade, blocos, linhasCortesia, nl, fc, vt, nql, nf, vp, limiteNum, aparelhosDisponiveis, economia, prazoOferta, config, endereco, enderecoAlternativo, ofertarPortabilidade, tentouWhatsapp]);

  const quadroResumoHtml = useMemo(() => {
    if (!blocos.temComparacao) return null;
    return montarQuadroResumoHtml({
      portfolioAtual: blocos.portfolioAtual,
      linhasComparativo: [
        ["Linhas", `${nl || "?"}`, `${nql || "?"}${linhasCortesia > 0 ? ` (+${linhasCortesia})` : ""}`],
        ["Franquia", `${fc || "?"}GB`, `${nf || "?"}GB`],
        ["Valor", vt ? fmtBRL(vt) : "?", vp ? fmtBRL(vp) : "?"],
      ],
      economiaTxt: blocos.economiaAnual
        ? `Você economiza ${fmtBRL(economia)}/mês — ${fmtBRL(blocos.economiaAnual)} ao longo de um ano`
        : "",
    });
  }, [blocos, nl, fc, vt, nql, nf, vp, linhasCortesia, economia]);

  const whatsMsg = useMemo(() => {
    const empresa = razao || "[razão social]";
    let corpo = contatoNome
      ? `Olá, ${contatoNome}! Aqui é da ${config.nomeEmpresa} falando sobre a conta da *${empresa}*.\n\n`
      : `Olá! Aqui é da ${config.nomeEmpresa} falando sobre a conta da *${empresa}*.\n\n`;

    if (blocos.estagio === "vencido") {
      corpo += `Seu contrato de fidelidade já venceu — hoje vocês não têm contrato de permanência ativo, podem migrar quando quiserem. Por isso é um ótimo momento pra travar uma condição nova:\n\n`;
    } else if (blocos.estagio === "elegivel") {
      corpo += `Seu contrato está prestes a acabar — já consegui liberar uma condição especial de renovação. Bora fechar isso antes que ela saia do sistema?\n\n`;
    } else if (blocos.estagio === "aquecendo") {
      corpo += `Separei uma condição que já reduz seu custo hoje, sem você precisar esperar nada:\n\n`;
    } else {
      corpo += `Revisando sua conta, achei uma forma de melhorar sua condição atual:\n\n`;
    }

    if (linhasCortesia > 0) {
      corpo += `A proposta inclui ${linhasCortesia} linha(s) de cortesia (sem custo), reduzindo o valor por linha.\n\n`;
    }

    if (blocos.temComparacao) {
      const quadro = montarQuadroResumo({
        portfolioAtual: blocos.portfolioAtual,
        linhasComparativo: [
          ["Linhas", `${nl || "?"}`, `${nql || "?"}${linhasCortesia > 0 ? ` (+${linhasCortesia})` : ""}`],
          ["Franquia", `${fc || "?"}GB`, `${nf || "?"}GB`],
          ["Valor", vt ? fmtBRL(vt) : "?", vp ? fmtBRL(vp) : "?"],
        ],
        economiaTxt: blocos.economiaAnual
          ? `Você economiza ${fmtBRL(economia)}/mês — ${fmtBRL(blocos.economiaAnual)} no ano`
          : "",
        usarIcones: false,
      });
      corpo += "```" + quadro + "```\n\n";
    } else if (blocos.portfolioAtual.length > 0) {
      corpo += `*Hoje vocês têm com a gente:*\n`;
      blocos.portfolioAtual.forEach((item) => (corpo += `- ${item.texto}\n`));
      corpo += `\n`;
    }

    if (blocos.jaTemLista.length > 0) {
      corpo += `Além disso, vocês já são clientes fiéis também em ${joinNatural(blocos.jaTemLista)} — isso conta a favor da condição especial que consegui pra vocês.\n\n`;
    }

    if (blocos.ofertasLista.length > 0) {
      corpo += `E já que essa fidelidade toda ajuda, separei um combo pra vocês economizarem ainda mais: incluindo ${joinNatural(blocos.ofertasLista)} na proposta, consigo aumentar o desconto. Topa que eu já cote isso junto?\n\n`;
    }

    if (blocos.aparelhoOferta === "disponivel") {
      corpo += `No caso do aparelho, você tem *${fmtBRL(limiteNum)}* em limite de crédito. Já separei pra você:\n`;
      aparelhosDisponiveis.forEach((a) => {
        const partes = [];
        if (a.cabe10x) partes.push(`10x R$ ${a.parcela10x.toFixed(2).replace(".", ",")} (total ${fmtBRL(a.total10)})`);
        if (a.cabe24x) partes.push(`24x R$ ${a.parcela24x.toFixed(2).replace(".", ",")} (total ${fmtBRL(a.total24)})`);
        corpo += `- *${a.nome}:* ${partes.join(" / ")}\n`;
      });
      corpo += `\n`;
    } else if (blocos.aparelhoOferta === "indisponivel") {
      corpo += `Sobre o aparelho: você tem *${fmtBRL(limiteNum)}* de limite, mas nenhum modelo do catálogo atual coube nesse valor — me diz se tem alguma marca de preferência que eu vejo opção.\n\n`;
    }

    if (blocos.bandaLargaStatus === "com_cobertura") {
      const endTxt = endereco?.resumo ? ` (${endereco.resumo})` : "";
      corpo += `Sobre a banda larga: temos cobertura confirmada no endereço da sua empresa${endTxt}.\n\n`;
    } else if (blocos.bandaLargaStatus === "sem_cobertura") {
      const endTxt = endereco?.resumo ? ` (${endereco.resumo})` : "";
      corpo += `Sobre a banda larga: no endereço cadastrado${endTxt} ainda não identifiquei cobertura. `;
      corpo += enderecoAlternativo?.resumo
        ? `Já anotei o endereço que você passou (${enderecoAlternativo.resumo}) e vou confirmar viabilidade por lá também.\n\n`
        : `Se tiver outro endereço/filial, me manda o CEP que eu checo.\n\n`;
    }

    if (ofertarPortabilidade) {
      corpo += `Se vocês tiverem alguma linha ativa em outra operadora, também consigo portar o número pra Vivo sem burocracia pro usuário — só me passar a operadora atual e a quantidade que já incluo na proposta.\n\n`;
    }

    corpo += prazoOferta
      ? `Essa condição fica reservada até *${prazoOferta}*.\n\n`
      : `Vou manter essa condição reservada até o fim da semana.\n\n`;

    corpo +=
      blocos.estagio === "aquecendo"
        ? `Já deixo o link pronto pra essa parte que já vale hoje. Fecho por aqui ou prefere que eu ligue rapidinho?`
        : `Já vou deixando o link de confirmação pronto. Fecha por aqui mesmo ou prefere que eu te ligue rapidinho antes?`;
    return corpo;
  }, [razao, contatoNome, fid, mesesParaElegibilidade, blocos, linhasCortesia, nl, fc, vt, nql, nf, vp, limiteNum, aparelhosDisponiveis, economia, prazoOferta, config, endereco, enderecoAlternativo, ofertarPortabilidade]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 380px) 1fr", gap: 16 }}>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 18 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: C.textFaint, marginBottom: 14 }}>
          Dados consultados nos sistemas
        </div>
        <Field label="Razão social">
          <TextInput value={razao} onChange={setRazao} placeholder="Empresa LTDA" />
        </Field>
        <Field label="CNPJ">
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ flex: 1 }}>
              <TextInput value={cnpj} onChange={setCnpj} placeholder="00.000.000/0000-00" />
            </div>
            <button
              onClick={buscarEndereco}
              disabled={buscandoEndereco || !cnpj}
              style={{
                background: "none",
                border: `1px solid ${C.tealDim}`,
                color: C.teal,
                borderRadius: 4,
                padding: "0 10px",
                fontSize: 11,
                cursor: cnpj ? "pointer" : "not-allowed",
                fontFamily: sans,
                whiteSpace: "nowrap",
              }}
            >
              {buscandoEndereco ? "Buscando…" : "Buscar endereço"}
            </button>
          </div>
          {endereco?.situacaoCadastral && endereco.situacaoCadastral !== "ATIVA" && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "rgba(198, 90, 78, 0.12)",
                border: `1px solid ${C.red}`,
                borderRadius: 4,
                padding: "6px 8px",
                marginTop: 6,
                fontSize: 12,
                color: C.red,
                fontWeight: 600,
              }}
            >
              ⚠️ CNPJ com situação cadastral "{endereco.situacaoCadastral}" — não está ativo. Confirme antes de seguir com a proposta.
            </div>
          )}
          {endereco?.resumo && (
            <div style={{ fontSize: 11, color: C.teal, marginTop: 5 }}>
              📍 {endereco.resumo}{" "}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  [endereco.logradouro, endereco.numero, endereco.bairro, endereco.municipio, endereco.uf].filter(Boolean).join(", ")
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: C.tealDim, textDecoration: "underline" }}
              >
                ver no mapa
              </a>
            </div>
          )}
          {erroEndereco && <div style={{ fontSize: 11, color: C.amber, marginTop: 5 }}>{erroEndereco}</div>}
        </Field>

        <div style={{ fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: C.tealDim, marginTop: 4, marginBottom: 8 }}>
          Atual
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Linhas atuais">
            <NumberInput value={nLinhas} onChange={setNLinhas} placeholder="0" />
          </Field>
          <Field label="Franquia atual">
            <NumberInput value={franquiaContratada} onChange={setFranquiaContratada} suffix="GB" placeholder="0" />
          </Field>
        </div>
        <Field label="Valor atual">
          <NumberInput value={valorTotal} onChange={setValorTotal} suffix="R$" placeholder="0" />
        </Field>
        <Field label="Fidelidade (meses)" hint={`Renovação liberada a partir de ${config.mesesElegibilidade} (de ${config.mesesFidelidadeTotal})`}>
          <NumberInput value={fidelidadeMeses} onChange={setFidelidadeMeses} suffix={`/ ${config.mesesFidelidadeTotal}`} placeholder="0" />
        </Field>

        <div style={{ fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: C.teal, marginTop: 14, marginBottom: 8 }}>
          Proposta
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Linhas na proposta">
            <NumberInput value={novaQtdLinhas} onChange={setNovaQtdLinhas} placeholder="0" />
          </Field>
          <Field label="Franquia na proposta">
            <NumberInput value={novaFranquia} onChange={setNovaFranquia} suffix="GB" placeholder="0" />
          </Field>
        </div>
        <Field label="Valor da proposta">
          <NumberInput value={valorProposta} onChange={setValorProposta} suffix="R$" placeholder="0" />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Limite p/ aparelho">
            <NumberInput value={limiteCreditoAparelho} onChange={setLimiteCreditoAparelho} suffix="R$" placeholder="0" />
          </Field>
          <Field label="Prazo da oferta">
            <TextInput value={prazoOferta} onChange={setPrazoOferta} placeholder="ex: sexta-feira" />
          </Field>
        </div>

        <div style={{ fontSize: 11, color: C.textFaint, marginBottom: 14 }}>
          Catálogo de aparelhos: {aparelhos.length ? `${aparelhos.length} modelos carregados` : "nenhum carregado"} — gerencie na aba "Aparelhos".
        </div>
        <div style={{ marginTop: 6, marginBottom: 6 }}>
          <Toggle
            checked={temBandaLarga}
            onChange={(v) => {
              setTemBandaLarga(v);
              if (v) setCoberturaFibra(false);
            }}
            label="Já possui banda larga ativa"
          />
          {!temBandaLarga && (
            <>
              <Toggle checked={coberturaFibra} onChange={setCoberturaFibra} label={`Cobertura ${config.nomeInternetFixa} confirmada`} />
              {!coberturaFibra && (
                <div style={{ margin: "6px 0 10px 38px", maxWidth: 260 }}>
                  <div style={{ fontSize: 11, color: C.textFaint, marginBottom: 4 }}>
                    CEP de outro endereço/filial (opcional)
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <div style={{ flex: 1 }}>
                      <TextInput value={cepAlternativo} onChange={setCepAlternativo} placeholder="00000-000" />
                    </div>
                    <button
                      onClick={buscarCep}
                      disabled={buscandoCep || !cepAlternativo}
                      style={{ background: "none", border: `1px solid ${C.tealDim}`, color: C.teal, borderRadius: 4, padding: "0 10px", fontSize: 11, cursor: cepAlternativo ? "pointer" : "not-allowed", fontFamily: sans, whiteSpace: "nowrap" }}
                    >
                      {buscandoCep ? "Buscando…" : "Consultar"}
                    </button>
                  </div>
                  {enderecoAlternativo?.resumo && (
                    <div style={{ fontSize: 11, color: C.teal, marginTop: 5 }}>
                      📍 {enderecoAlternativo.resumo}{" "}
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          [enderecoAlternativo.logradouro, enderecoAlternativo.bairro, enderecoAlternativo.localidade, enderecoAlternativo.uf].filter(Boolean).join(", ")
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: C.tealDim, textDecoration: "underline" }}
                      >
                        ver no mapa
                      </a>
                    </div>
                  )}
                  {erroCep && <div style={{ fontSize: 11, color: C.amber, marginTop: 5 }}>{erroCep}</div>}
                </div>
              )}
            </>
          )}
          {temBandaLarga && (
            <div style={{ margin: "8px 0 10px 38px" }}>
              {bandaLargaLinhas.map((r) => (
                <div key={r.id} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
                  <input
                    value={r.velocidade}
                    onChange={(e) => atualizarLinhaBandaLarga(r.id, "velocidade", e.target.value)}
                    placeholder="ex: 300MB"
                    style={{ ...inputStyle, fontFamily: sans, fontSize: 12, padding: "5px 8px", width: 100 }}
                  />
                  <input
                    type="number"
                    value={r.qtd}
                    onChange={(e) => atualizarLinhaBandaLarga(r.id, "qtd", e.target.value)}
                    placeholder="qtd"
                    style={{ ...inputStyle, fontFamily: mono, fontSize: 12, padding: "5px 8px", width: 60 }}
                  />
                  <button
                    onClick={() => removerLinhaBandaLarga(r.id)}
                    style={{ background: "none", border: "none", color: C.textFaint, cursor: "pointer", fontSize: 12 }}
                  >
                    remover
                  </button>
                </div>
              ))}
              <button
                onClick={addLinhaBandaLarga}
                style={{ background: "none", border: `1px solid ${C.border}`, color: C.textDim, borderRadius: 4, padding: "4px 8px", fontSize: 11, cursor: "pointer", fontFamily: sans }}
              >
                + conexão
              </button>
            </div>
          )}
          <Toggle checked={temTvCabo} onChange={setTemTvCabo} label="Já possui TV a cabo ativa" />
          <Toggle checked={temTelefoneFixo} onChange={setTemTelefoneFixo} label="Já possui telefone fixo ativo" />
          {temTelefoneFixo && (
            <div style={{ margin: "8px 0 10px 38px" }}>
              {telefoneFixoLinhas.map((r) => (
                <div key={r.id} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
                  <input
                    value={r.numero}
                    onChange={(e) => atualizarLinhaTelefoneFixo(r.id, e.target.value)}
                    placeholder="ex: (31) 3333-4444"
                    style={{ ...inputStyle, fontFamily: sans, fontSize: 12, padding: "5px 8px", width: 160 }}
                  />
                  <button
                    onClick={() => removerLinhaTelefoneFixo(r.id)}
                    style={{ background: "none", border: "none", color: C.textFaint, cursor: "pointer", fontSize: 12 }}
                  >
                    remover
                  </button>
                </div>
              ))}
              <button
                onClick={addLinhaTelefoneFixo}
                style={{ background: "none", border: `1px solid ${C.border}`, color: C.textDim, borderRadius: 4, padding: "4px 8px", fontSize: 11, cursor: "pointer", fontFamily: sans }}
              >
                + linha
              </button>
            </div>
          )}
          <Toggle checked={parcelandoCelular} onChange={setParcelandoCelular} label="Está parcelando celular" />
          <Toggle checked={ofertarPortabilidade} onChange={setOfertarPortabilidade} label="Ofertar portabilidade de outra operadora" />
          <Toggle checked={tentouWhatsapp} onChange={setTentouWhatsapp} label="Já tentei contato por WhatsApp sem resposta" />
        </div>
        <div style={{ height: 1, background: C.border, margin: "14px 0" }} />
        <Field label="Contato (nome)">
          <TextInput value={contatoNome} onChange={setContatoNome} placeholder="Telefone quente" />
        </Field>
        <Field label="Telefone">
          <TextInput value={contatoFone} onChange={setContatoFone} placeholder="(31) 9...." />
        </Field>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 18 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: C.textFaint, marginBottom: 14 }}>
            Quadro comparativo
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: mono, fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "6px 8px", color: C.textFaint, fontFamily: sans, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `2px solid ${C.border}` }}>
                  Item
                </th>
                <th style={{ textAlign: "right", padding: "6px 8px", color: C.textFaint, fontFamily: sans, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `2px solid ${C.border}` }}>
                  Atual
                </th>
                <th style={{ textAlign: "right", padding: "6px 8px", color: C.teal, fontFamily: sans, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `2px solid ${C.tealDim}` }}>
                  Proposta
                </th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: "8px", color: C.text, fontFamily: sans }}>Linhas</td>
                <td style={{ padding: "8px", textAlign: "right", color: C.textDim }}>{nl || "—"}</td>
                <td style={{ padding: "8px", textAlign: "right", color: C.teal, fontWeight: 600 }}>
                  {nql || "—"}
                  {linhasCortesia > 0 && (
                    <span style={{ fontSize: 10, color: C.amber, marginLeft: 4, fontFamily: sans }}>+{linhasCortesia} cortesia</span>
                  )}
                </td>
              </tr>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: "8px", color: C.text, fontFamily: sans }}>Franquia</td>
                <td style={{ padding: "8px", textAlign: "right", color: C.textDim }}>{fc || "—"}GB</td>
                <td style={{ padding: "8px", textAlign: "right", color: nf > fc ? C.teal : C.text, fontWeight: 600 }}>{nf || "—"}GB</td>
              </tr>
              <tr>
                <td style={{ padding: "8px", color: C.text, fontFamily: sans }}>Valor mensal</td>
                <td style={{ padding: "8px", textAlign: "right", color: C.textDim }}>{fmtBRL(vt)}</td>
                <td style={{ padding: "8px", textAlign: "right", color: economia > 0 ? C.teal : C.text, fontWeight: 600 }}>{vp ? fmtBRL(vp) : "—"}</td>
              </tr>
            </tbody>
          </table>
          {economia > 0 && (
            <div style={{ marginTop: 12, padding: "8px 10px", background: "rgba(63, 184, 175, 0.1)", border: `1px solid ${C.tealDim}`, borderRadius: 6, fontSize: 12.5, color: C.teal, fontFamily: sans }}>
              💰 Economia de {fmtBRL(economia)}/mês — {fmtBRL(economia * 12)} ao longo de um ano
            </div>
          )}
          <div style={{ display: "flex", gap: 24, marginTop: 14, flexWrap: "wrap" }}>
            <Stat label="Ticket médio / linha (atual)" value={fmtBRL(ticketMedio)} />
            <Stat label="Fidelidade" value={`${fid || 0} / ${config.mesesFidelidadeTotal} m`} accent={elegivelRenovacao ? C.teal : C.textFaint} badge={elegivelRenovacao ? "elegível" : null} />
            {limiteCreditoAparelho && <Stat label="Limite aparelho" value={fmtBRL(parseFloat(limiteCreditoAparelho))} />}
          </div>
        </div>

        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 18 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: C.textFaint, marginBottom: 12 }}>
            Oportunidades identificadas
          </div>
          {oportunidades.length === 0 ? (
            <div style={{ fontSize: 13, color: C.textFaint }}>Preencha os dados ao lado para gerar a leitura.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {oportunidades.map((o, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 10, fontFamily: mono, textTransform: "uppercase", color: o.cor, border: `1px solid ${o.cor}`, borderRadius: 3, padding: "2px 6px", flexShrink: 0, marginTop: 1 }}>
                    {o.tipo}
                  </span>
                  <span style={{ fontSize: 13, color: C.text, lineHeight: 1.45 }}>{o.texto}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {limiteNum > 0 && (
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 18 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: C.textFaint, marginBottom: 12 }}>
              Aparelhos dentro do limite ({fmtBRL(limiteNum)})
            </div>
            {aparelhos.length === 0 ? (
              <div style={{ fontSize: 13, color: C.textFaint }}>Importe a planilha de aparelhos para ver as opções aqui.</div>
            ) : aparelhosDisponiveis.length === 0 ? (
              <div style={{ fontSize: 13, color: C.amber }}>Nenhum aparelho do catálogo cabe nesse limite.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "6px 8px", color: C.textFaint, fontFamily: sans, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `2px solid ${C.border}` }}>
                        Modelo
                      </th>
                      <th style={{ textAlign: "right", padding: "6px 8px", color: C.textFaint, fontFamily: sans, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `2px solid ${C.border}` }}>
                        10x
                      </th>
                      <th style={{ textAlign: "right", padding: "6px 8px", color: C.textFaint, fontFamily: sans, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `2px solid ${C.border}` }}>
                        24x
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {aparelhosDisponiveis.map((a, i) => (
                      <tr key={i} style={{ borderBottom: i < aparelhosDisponiveis.length - 1 ? `1px solid ${C.border}` : "none" }}>
                        <td style={{ padding: "8px", color: C.text, fontFamily: sans }}>{a.nome}</td>
                        <td style={{ padding: "8px", textAlign: "right", fontFamily: mono, color: a.cabe10x ? C.teal : C.textFaint }}>
                          {a.cabe10x ? (
                            <>
                              {fmtBRL(a.parcela10x)}
                              <div style={{ fontSize: 10, color: C.textFaint }}>tot. {fmtBRL(a.total10)}</div>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td style={{ padding: "8px", textAlign: "right", fontFamily: mono, color: a.cabe24x ? C.teal : C.textFaint }}>
                          {a.cabe24x ? (
                            <>
                              {fmtBRL(a.parcela24x)}
                              <div style={{ fontSize: 10, color: C.textFaint }}>tot. {fmtBRL(a.total24)}</div>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <MessageCard title="Mensagem de abertura (mande antes do rascunho)" text={aberturaMsg} whatsappPhone={contatoFone} />
        <div style={{ fontSize: 11, color: C.textFaint, padding: "0 4px" }}>
          Manda essa primeiro pra qualificar contato e abrir conversa — só envie o rascunho
          completo depois que a pessoa responder.
        </div>

        <MessageCard title="Rascunho de e-mail" text={emailMsg} tabelaHtml={quadroResumoHtml} />
        <MessageCard title="Rascunho de WhatsApp" text={whatsMsg} whatsappPhone={contatoFone} />
        <div style={{ fontSize: 11, color: C.textFaint, padding: "0 4px" }}>
          Rascunhos escritos como oferta (não como exigência do sistema). Revise antes de
          enviar — inclusive o prazo, que só deve constar se for real.
        </div>

        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 18 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: C.textFaint, marginBottom: 12 }}>
            Registrar envio (alimenta follow-up e meta do mês)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <Field label="Produto principal da proposta">
              <select
                value={produtoPrincipal}
                onChange={(e) => setProdutoPrincipal(e.target.value)}
                style={{ ...inputStyle, fontFamily: sans }}
              >
                <option value="banda_larga">Banda larga</option>
                <option value="movel">Plano móvel</option>
                <option value="renovacao">Renovação</option>
                <option value="aparelho">Aparelho</option>
              </select>
            </Field>
            <Field label="Canal do envio">
              <select
                value={canalEnvio}
                onChange={(e) => setCanalEnvio(e.target.value)}
                style={{ ...inputStyle, fontFamily: sans }}
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="email">E-mail</option>
                <option value="ambos">E-mail + WhatsApp</option>
                <option value="ligacao">Ligação</option>
              </select>
            </Field>
          </div>
          <button
            onClick={() => {
              onRegistrarEnvio({
                cnpj,
                cliente: razao,
                contatoNome,
                contatoFone,
                produtoPrincipal,
                canal: canalEnvio,
                valorProposta: vp,
                dataEnvio: new Date().toISOString(),
                status: "aguardando",
              });
              setStatusRegistro("Registrado — confira na aba Follow-up.");
              setTimeout(() => setStatusRegistro(""), 3000);
            }}
            disabled={!razao && !cnpj}
            style={{
              width: "100%",
              background: razao || cnpj ? C.tealDim : "transparent",
              border: `1px solid ${razao || cnpj ? C.tealDim : C.border}`,
              color: razao || cnpj ? C.bg : C.textFaint,
              borderRadius: 4,
              padding: "9px 10px",
              fontSize: 13,
              fontWeight: 600,
              cursor: razao || cnpj ? "pointer" : "not-allowed",
              fontFamily: sans,
            }}
          >
            Registrar proposta enviada
          </button>
          {statusRegistro && (
            <div style={{ fontSize: 11, color: C.teal, marginTop: 6 }}>{statusRegistro}</div>
          )}
          {!razao && !cnpj && (
            <div style={{ fontSize: 11, color: C.textFaint, marginTop: 6 }}>
              Preencha ao menos razão social ou CNPJ para registrar.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageCard({ title, text, whatsappPhone, tabelaHtml }) {
  const [status, setStatus] = useState("idle");
  const [statusTabela, setStatusTabela] = useState("idle");
  const copy = async () => {
    const ok = await copiarTexto(text);
    setStatus(ok ? "ok" : "erro");
    setTimeout(() => setStatus("idle"), 1800);
  };
  const copiarTabela = async () => {
    const ok = await copiarHtmlRico(tabelaHtml, text);
    setStatusTabela(ok ? "ok" : "erro");
    setTimeout(() => setStatusTabela("idle"), 2200);
  };
  const abrirWhatsapp = () => {
    const digitos = (whatsappPhone || "").replace(/\D/g, "");
    if (!digitos) return;
    const comDDI = digitos.length <= 11 ? `55${digitos}` : digitos;
    window.open(`https://wa.me/${comDDI}?text=${encodeURIComponent(text)}`, "_blank");
  };
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: C.textFaint }}>
          {title}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {whatsappPhone && (
            <button
              onClick={abrirWhatsapp}
              style={{ background: "none", border: `1px solid ${C.tealDim}`, color: C.teal, borderRadius: 4, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: sans }}
            >
              Abrir no WhatsApp
            </button>
          )}
          {tabelaHtml && (
            <button
              onClick={copiarTabela}
              style={{ background: "none", border: `1px solid ${statusTabela === "erro" ? C.amber : C.tealDim}`, color: statusTabela === "erro" ? C.amber : C.teal, borderRadius: 4, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: sans }}
            >
              {statusTabela === "ok" ? "Tabela copiada" : statusTabela === "erro" ? "Falhou — tente de novo" : "Copiar tabela p/ Outlook"}
            </button>
          )}
          <button
            onClick={copy}
            style={{ background: "none", border: `1px solid ${status === "erro" ? C.amber : C.tealDim}`, color: status === "erro" ? C.amber : C.teal, borderRadius: 4, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: sans }}
          >
            {status === "ok" ? "Copiado" : status === "erro" ? "Selecione manualmente" : "Copiar"}
          </button>
        </div>
      </div>
      <div style={{ background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 6, padding: 12, fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap", color: C.text }}>
        {text}
      </div>
      {tabelaHtml && (
        <div style={{ fontSize: 11, color: C.textFaint, marginTop: 8 }}>
          "Copiar tabela p/ Outlook" copia só o quadro-resumo formatado (tabela de
          verdade) — cole com Ctrl+V dentro do corpo do e-mail, no meio do texto.
        </div>
      )}
    </div>
  );
}

// ---------------- Aparelhos tab (catálogo único, persistente) ----------------

function AparelhosTab({ aparelhos, setAparelhos }) {
  const fileRef = useRef(null);
  const [status, setStatus] = useState("");

  const salvar = async (lista) => {
    setAparelhos(lista);
    try {
      const res = await window.storage.set("catalogo-aparelhos", JSON.stringify(lista), false);
      setStatus(res ? "Catálogo salvo." : "Não foi possível salvar o catálogo.");
    } catch (e) {
      setStatus("Não foi possível salvar o catálogo.");
    }
    setTimeout(() => setStatus(""), 2000);
  };

  const handleFile = (file) => {
    Papa.parse(file, {
      complete: (res) => {
        const rows = res.data.filter((r) => r.length > 1 && r.some((c) => c && c.toString().trim()));
        if (rows.length < 2) return;
        const headers = rows[0];
        salvar(dedupeAparelhos(rows.slice(1).map((r) => mapPhoneRow(headers, r))));
      },
      skipEmptyLines: true,
    });
  };

  const limpar = () => salvar([]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: C.textFaint }}>
              Catálogo de aparelhos
            </div>
            <div style={{ fontSize: 13, color: C.textDim, marginTop: 2 }}>
              {aparelhos.length ? `${aparelhos.length} modelos salvos — usado em todas as propostas` : "Nenhum catálogo salvo ainda"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {status && <span style={{ fontSize: 11, color: C.textFaint }}>{status}</span>}
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              style={{ display: "none" }}
              onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
            />
            <button
              onClick={() => fileRef.current?.click()}
              style={{ background: "none", border: `1px solid ${C.tealDim}`, color: C.teal, borderRadius: 4, padding: "7px 12px", fontSize: 12, cursor: "pointer", fontFamily: sans }}
            >
              {aparelhos.length ? "Substituir CSV" : "Importar CSV"}
            </button>
            {aparelhos.length > 0 && (
              <button
                onClick={limpar}
                style={{ background: "none", border: `1px solid ${C.border}`, color: C.textFaint, borderRadius: 4, padding: "7px 12px", fontSize: 12, cursor: "pointer", fontFamily: sans }}
              >
                Limpar
              </button>
            )}
          </div>
        </div>
        <div style={{ fontSize: 11, color: C.textFaint, marginTop: 8 }}>
          Importe uma vez — o catálogo fica salvo e é usado automaticamente em todas as
          propostas, filtrando pelos aparelhos que cabem no limite de crédito de cada cliente.
          Colunas reconhecidas: modelo/aparelho, preço total (opcional) e valores de 10x/24x.
        </div>
      </div>

      {aparelhos.length > 0 && (
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: mono, fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: C.panelAlt, textAlign: "left" }}>
                  {["Modelo", "Preço total (est.)", "10x", "24x"].map((h) => (
                    <th key={h} style={{ padding: "8px 10px", color: C.textFaint, fontWeight: 400, fontFamily: sans, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `1px solid ${C.border}` }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {aparelhos.map((a, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: "7px 10px", color: C.text, fontFamily: sans }}>{a.nome}</td>
                    <td style={{ padding: "7px 10px", color: C.textDim }}>{a.precoTotal ? fmtBRL(a.precoTotal) : "—"}</td>
                    <td style={{ padding: "7px 10px", color: C.textDim }}>{a.parcela10x ? fmtBRL(a.parcela10x) : "—"}</td>
                    <td style={{ padding: "7px 10px", color: C.textDim }}>{a.parcela24x ? fmtBRL(a.parcela24x) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- Follow-up tab ----------------

const ESTAGIOS = [
  { min: 0, max: 1, label: null },
  { min: 2, max: 4, label: "1º follow-up", tom: "leve" },
  { min: 5, max: 9, label: "2º follow-up", tom: "urgência real" },
  { min: 10, max: Infinity, label: "Esfriando", tom: "última tentativa ou arquivar" },
];

function estagioFollowUp(dias) {
  return ESTAGIOS.find((e) => dias >= e.min && dias <= e.max) || ESTAGIOS[ESTAGIOS.length - 1];
}

function textoFollowUp(p, dias, estagio) {
  const nome = p.contatoNome || p.cliente;
  if (estagio.tom === "leve") {
    return `Oi ${nome}! Só passando pra saber se você viu a proposta que te enviei — ficou alguma dúvida sobre os valores ou aparelhos? Posso ajustar algo se precisar.`;
  }
  if (estagio.tom === "urgência real") {
    const valorTxt = p.valorProposta ? ` (a de ${fmtBRL(p.valorProposta)})` : "";
    return `Oi ${nome}, tudo bem? Ainda estou com a condição especial reservada pra sua empresa${valorTxt}, mas não sei por quanto tempo mais o sistema mantém essa reserva. Consegue me dar um retorno essa semana?`;
  }
  return `Oi ${nome}, faz um tempo que te mandei a proposta e não tive retorno — sem problema nenhum se não for o momento. Quer que eu deixe registrado pra te procurar de novo mais pra frente, ou prefere que eu feche por aqui?`;
}

function FollowUpTab({ propostas, atualizarStatus, config, feriadosSet }) {
  const pendentes = useMemo(
    () =>
      propostas
        .filter((p) => p.status === "aguardando")
        .map((p) => {
          const diasUteis = diasUteisDesde(p.dataEnvio, feriadosSet);
          return { ...p, dias: diasUteis, diasCorridos: diasDesde(p.dataEnvio), estagio: estagioFollowUp(diasUteis) };
        })
        .filter((p) => p.estagio.label)
        .sort((a, b) => b.dias - a.dias),
    [propostas, feriadosSet]
  );

  const mesAtual = new Date().getMonth();
  const anoAtual = new Date().getFullYear();
  const fechadosMetaMes = propostas.filter((p) => {
    const d = new Date(p.dataEnvio);
    return p.status === "fechou" && p.produtoPrincipal === "banda_larga" && d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
  }).length;
  const metaAtingida = fechadosMetaMes >= config.metaProdutoQtd;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 18 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: C.textFaint, marginBottom: 10 }}>
          Meta do mês — {config.metaProdutoNome}
        </div>
        <div style={{ height: 10, background: C.panelAlt, borderRadius: 5, overflow: "hidden", border: `1px solid ${C.border}`, marginBottom: 8 }}>
          <div style={{ height: "100%", width: `${Math.min(100, (fechadosMetaMes / config.metaProdutoQtd) * 100)}%`, background: metaAtingida ? C.teal : C.amber }} />
        </div>
        <div style={{ fontFamily: mono, fontSize: 13, color: C.textDim }}>
          {fechadosMetaMes} / {config.metaProdutoQtd} fechadas neste mês {metaAtingida ? "— teto de comissão garantido" : ""}
        </div>
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 18 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: C.textFaint, marginBottom: 12 }}>
          Follow-ups pendentes ({pendentes.length})
        </div>
        {pendentes.length === 0 ? (
          <div style={{ fontSize: 13, color: C.textFaint }}>
            Nenhum follow-up pendente agora. Registre envios na aba Proposta pra eles aparecerem aqui.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {pendentes.map((p) => (
              <FollowUpCard key={p.dataEnvio + p.cnpj} p={p} atualizarStatus={atualizarStatus} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FollowUpCard({ p, atualizarStatus }) {
  const [status, setStatus] = useState("idle");
  const texto = textoFollowUp(p, p.dias, p.estagio);
  const copy = async () => {
    const ok = await copiarTexto(texto);
    setStatus(ok ? "ok" : "erro");
    setTimeout(() => setStatus("idle"), 1800);
  };
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
        <div>
          <span style={{ color: C.text, fontFamily: sans, fontSize: 14 }}>{p.cliente || p.cnpj}</span>
          <span style={{ color: C.textFaint, fontSize: 12, marginLeft: 8 }}>{p.dias} dias úteis sem resposta · {p.canal}</span>
        </div>
        <span style={{ fontSize: 10, fontFamily: mono, textTransform: "uppercase", color: C.amber, border: `1px solid ${C.amber}`, borderRadius: 3, padding: "2px 6px" }}>
          {p.estagio.label}
        </span>
      </div>
      <div style={{ background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 6, padding: 10, fontSize: 13, lineHeight: 1.5, color: C.text, marginBottom: 10 }}>
        {texto}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={copy} style={{ background: "none", border: `1px solid ${status === "erro" ? C.amber : C.tealDim}`, color: status === "erro" ? C.amber : C.teal, borderRadius: 4, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: sans }}>
          {status === "ok" ? "Copiado" : status === "erro" ? "Selecione manualmente" : "Copiar"}
        </button>
        <button onClick={() => atualizarStatus(p, "respondeu")} style={{ background: "none", border: `1px solid ${C.border}`, color: C.textDim, borderRadius: 4, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: sans }}>
          Respondeu
        </button>
        <button onClick={() => atualizarStatus(p, "fechou")} style={{ background: "none", border: `1px solid ${C.tealDim}`, color: C.teal, borderRadius: 4, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: sans }}>
          Fechou
        </button>
        <button onClick={() => atualizarStatus(p, "recusado")} style={{ background: "none", border: `1px solid ${C.border}`, color: C.textFaint, borderRadius: 4, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: sans }}>
          Recusou / arquivar
        </button>
      </div>
    </div>
  );
}

// ---------------- TV a cabo tab (catálogo único, persistente) ----------------

function TvCaboTab({ tv, setTv }) {
  const fileRef = useRef(null);
  const [status, setStatus] = useState("");

  const salvar = async (lista) => {
    setTv(lista);
    try {
      const res = await window.storage.set("catalogo-tv", JSON.stringify(lista), false);
      setStatus(res ? "Catálogo salvo." : "Não foi possível salvar o catálogo.");
    } catch (e) {
      setStatus("Não foi possível salvar o catálogo.");
    }
    setTimeout(() => setStatus(""), 2000);
  };

  const handleFile = (file) => {
    Papa.parse(file, {
      complete: (res) => {
        const rows = res.data.filter((r) => r.length > 1 && r.some((c) => c && c.toString().trim()));
        if (rows.length < 2) return;
        const headers = rows[0];
        salvar(rows.slice(1).map((r) => mapTvRow(headers, r)));
      },
      skipEmptyLines: true,
    });
  };

  const limpar = () => salvar([]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: C.textFaint }}>
              Catálogo de TV a cabo
            </div>
            <div style={{ fontSize: 13, color: C.textDim, marginTop: 2 }}>
              {tv.length ? `${tv.length} planos salvos — usado em todas as propostas` : "Nenhum catálogo salvo ainda"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {status && <span style={{ fontSize: 11, color: C.textFaint }}>{status}</span>}
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              style={{ display: "none" }}
              onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
            />
            <button
              onClick={() => fileRef.current?.click()}
              style={{ background: "none", border: `1px solid ${C.tealDim}`, color: C.teal, borderRadius: 4, padding: "7px 12px", fontSize: 12, cursor: "pointer", fontFamily: sans }}
            >
              {tv.length ? "Substituir CSV" : "Importar CSV"}
            </button>
            {tv.length > 0 && (
              <button
                onClick={limpar}
                style={{ background: "none", border: `1px solid ${C.border}`, color: C.textFaint, borderRadius: 4, padding: "7px 12px", fontSize: 12, cursor: "pointer", fontFamily: sans }}
              >
                Limpar
              </button>
            )}
          </div>
        </div>
        <div style={{ fontSize: 11, color: C.textFaint, marginTop: 8 }}>
          Importe uma vez — o catálogo fica salvo e é usado automaticamente em todas as
          propostas. Colunas reconhecidas: plano/pacote, canais (opcional) e valor.
        </div>
      </div>

      {tv.length > 0 && (
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: mono, fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: C.panelAlt, textAlign: "left" }}>
                  {["Plano", "Canais", "Valor"].map((h) => (
                    <th key={h} style={{ padding: "8px 10px", color: C.textFaint, fontWeight: 400, fontFamily: sans, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `1px solid ${C.border}` }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tv.map((t, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: "7px 10px", color: C.text, fontFamily: sans }}>{t.nome}</td>
                    <td style={{ padding: "7px 10px", color: C.textDim }}>{t.canais || "—"}</td>
                    <td style={{ padding: "7px 10px", color: C.textDim }}>{t.valor ? fmtBRL(t.valor) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- Configurações tab (white-label) ----------------

function ConfiguracoesTab({ config, salvarConfig }) {
  const [form, setForm] = useState(config);
  const [status, setStatus] = useState("");

  React.useEffect(() => setForm(config), [config]);

  const set = (campo) => (valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const salvar = async () => {
    const normalizado = {
      ...form,
      mesesFidelidadeTotal: parseFloat(form.mesesFidelidadeTotal) || CONFIG_PADRAO.mesesFidelidadeTotal,
      mesesElegibilidade: parseFloat(form.mesesElegibilidade) || CONFIG_PADRAO.mesesElegibilidade,
      metaProdutoQtd: parseFloat(form.metaProdutoQtd) || CONFIG_PADRAO.metaProdutoQtd,
    };
    const ok = await salvarConfig(normalizado);
    setStatus(ok ? "Configurações salvas." : "Não foi possível salvar.");
    setTimeout(() => setStatus(""), 2000);
  };

  const restaurar = () => setForm(CONFIG_PADRAO);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 480 }}>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 18 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: C.textFaint, marginBottom: 4 }}>
          Marca e regras de negócio
        </div>
        <div style={{ fontSize: 11, color: C.textFaint, marginBottom: 14 }}>
          Isso é o que torna a ferramenta reutilizável pra outra operadora/empresa — troque aqui
          em vez de mexer no código.
        </div>

        <Field label="Seu nome (aparece na mensagem de abertura)">
          <TextInput value={form.nomeConsultor} onChange={set("nomeConsultor")} placeholder="ex: Augusto" />
        </Field>
        <Field label="Nome da empresa (aparece nos textos)">
          <TextInput value={form.nomeEmpresa} onChange={set("nomeEmpresa")} placeholder="Vivo Empresas" />
        </Field>
        <Field label="Nome do produto de internet fixa">
          <TextInput value={form.nomeInternetFixa} onChange={set("nomeInternetFixa")} placeholder="Vivo Fibra" />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Meses de fidelidade (total)">
            <NumberInput value={form.mesesFidelidadeTotal} onChange={set("mesesFidelidadeTotal")} placeholder="24" />
          </Field>
          <Field label="Meses p/ elegibilidade">
            <NumberInput value={form.mesesElegibilidade} onChange={set("mesesElegibilidade")} placeholder="17" />
          </Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Produto da meta de comissão">
            <TextInput value={form.metaProdutoNome} onChange={set("metaProdutoNome")} placeholder="banda larga" />
          </Field>
          <Field label="Qtd. da meta / mês">
            <NumberInput value={form.metaProdutoQtd} onChange={set("metaProdutoQtd")} placeholder="2" />
          </Field>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button
            onClick={salvar}
            style={{ flex: 1, background: C.tealDim, border: `1px solid ${C.tealDim}`, color: C.bg, borderRadius: 4, padding: "9px 10px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: sans }}
          >
            Salvar
          </button>
          <button
            onClick={restaurar}
            style={{ background: "none", border: `1px solid ${C.border}`, color: C.textFaint, borderRadius: 4, padding: "9px 12px", fontSize: 13, cursor: "pointer", fontFamily: sans }}
          >
            Restaurar padrão
          </button>
        </div>
        {status && <div style={{ fontSize: 11, color: C.textFaint, marginTop: 8 }}>{status}</div>}
      </div>
    </div>
  );
}

// ---------------- Banda Larga (prospecção + cobertura do bot) tab ----------------
function BandaLargaTab({ planos, setPlanos, config, onUsarNaProposta }) {
  const [leads, setLeads] = useState([]);
  const [busca, setBusca] = useState("");
  const [filtroCobertura, setFiltroCobertura] = useState("todos");
  const [leadSelecionado, setLeadSelecionado] = useState(null);
  const [planoEscolhido, setPlanoEscolhido] = useState(0);
  const [statusPlanos, setStatusPlanos] = useState("");
  const painelAbordagemRef = useRef(null);
  const fileRefMailing = useRef(null);
  const fileRefPlanos = useRef(null);

  const salvarPlanos = async (lista) => {
    setPlanos(lista);
    try {
      const res = await window.storage.set("planos-banda-larga", JSON.stringify(lista), false);
      setStatusPlanos(res ? "Salvo." : "Não foi possível salvar.");
    } catch (e) {
      setStatusPlanos("Não foi possível salvar.");
    }
    setTimeout(() => setStatusPlanos(""), 2000);
  };

  const handleImportMailing = (file) => {
  const reader = new FileReader();
  reader.onload = () => {
		// Detecta encoding: UTF-8 (saída do bot) ou ISO-8859-1 (mailing bruto da Vivo)
		let text;
		try {
		  text = new TextDecoder("utf-8", { fatal: true }).decode(reader.result);
		} catch (e) {
		  text = new TextDecoder("iso-8859-1").decode(reader.result);
		}
		Papa.parse(text, {
		  complete: (res) => {
			const rows = res.data.filter((r) => r.length > 1 && r.some((c) => c && c.toString().trim()));
			console.log("[cockpit] linhas parseadas:", rows.length, "| headers:", rows[0]);
			if (rows.length < 2) {
			  console.warn("[cockpit] CSV ignorado: menos de 2 linhas válidas. Delimitador/encoding corretos?");
			  return;
			}
			const headers = rows[0];
			setLeads(rows.slice(1).map((r) => mapRowBandaLarga(headers, r)));
		  },
		  skipEmptyLines: true,
		});
	  };
	  reader.readAsArrayBuffer(file);
	};

  const handleImportPlanos = (file) => {
    Papa.parse(file, {
      complete: (res) => {
        const rows = res.data.filter((r) => r.length > 1 && r.some((c) => c && c.toString().trim()));
        if (rows.length < 2) return;
        const headers = rows[0];
        const parsed = rows.slice(1).map((r) => {
          const obj = {};
          headers.forEach((h, i) => {
            const key = norm(h);
            if (key.includes("VELOC") || key.includes("PLANO")) obj.velocidade = r[i];
            else if (key.includes("VALOR") || key.includes("PRECO")) obj.valor = parseFloat((r[i] || "").toString().replace(",", ".")) || 0;
          });
          return obj;
        });
        salvarPlanos(parsed.filter((p) => p.velocidade));
      },
      skipEmptyLines: true,
    });
  };

  // Funil de cobertura do mailing importado (alimentado pelo bot)
  const stats = useMemo(() => {
    const s = { valida: 0, sem: 0, nao_encontrado: 0, erro: 0, nao_consultado: 0 };
    leads.forEach((l) => { s[statusCobertura(l)] += 1; });
    return s;
  }, [leads]);

  const leadsFiltrados = useMemo(() => {
    let arr = [...leads];
    if (busca.trim()) {
      const b = norm(busca);
      arr = arr.filter((l) => norm(l.empresa).includes(b) || norm(l.cidade).includes(b) || norm(l.cnpj).includes(b));
    }
    if (filtroCobertura !== "todos") arr = arr.filter((l) => statusCobertura(l) === filtroCobertura);
    const peso = { valida: 0, sem: 1, nao_encontrado: 2, erro: 3, nao_consultado: 4 };
    arr.sort((a, b) => peso[statusCobertura(a)] - peso[statusCobertura(b)] || (b.faturamento || 0) - (a.faturamento || 0));
    return arr;
  }, [leads, busca, filtroCobertura]);

  const selecionarLead = (lead) => {
    setLeadSelecionado(lead);
    const { indice } = sugerirPlano(planos, lead.faturamento);
    setPlanoEscolhido(indice);
    setTimeout(() => {
      painelAbordagemRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const plano = planos[planoEscolhido] || planos[0];
  const porteInfo = leadSelecionado ? classificarPorte(leadSelecionado.faturamento) : null;

  const mensagem = useMemo(() => {
    if (!leadSelecionado || !plano) return "";
    const consultorTxt = config.nomeConsultor ? `Aqui é o ${config.nomeConsultor}, da ${config.nomeEmpresa}` : `Aqui é da ${config.nomeEmpresa}`;
    const stCov = statusCobertura(leadSelecionado);
    const cobertura =
      stCov === "valida" || leadSelecionado.armario
        ? "já confirmei que a região tem infraestrutura pra receber nossa internet banda larga"
        : stCov === "sem"
        ? "no endereço cadastrado ainda não temos cobertura confirmada, mas quero analisar com você qual endereço ou filial faz sentido pra viabilizar"
        : "quero confirmar a viabilidade técnica de banda larga aí";
    const endTxt = leadSelecionado.enderecoResumo ? ` em ${leadSelecionado.enderecoResumo}` : "";
    const tomTxt = porteInfo ? `, pensando em ${porteInfo.tom}` : "";
    return `Oi! ${consultorTxt}. Localizei a ${leadSelecionado.empresa}${endTxt} e ${cobertura}. Consigo oferecer o plano de ${plano.velocidade} por ${fmtBRL(plano.valor)}/mês${tomTxt}. Faz sentido eu te passar mais detalhes?`;
  }, [leadSelecionado, plano, config, porteInfo]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Catálogo de planos */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: C.textFaint }}>
            Planos de banda larga
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {statusPlanos && <span style={{ fontSize: 11, color: C.textFaint }}>{statusPlanos}</span>}
            <input ref={fileRefPlanos} type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => e.target.files[0] && handleImportPlanos(e.target.files[0])} />
            <button onClick={() => fileRefPlanos.current?.click()} style={{ background: "none", border: `1px solid ${C.tealDim}`, color: C.teal, borderRadius: 4, padding: "6px 10px", fontSize: 11, cursor: "pointer", fontFamily: sans }}>
              Importar CSV
            </button>
            <button onClick={() => salvarPlanos(PLANOS_BL_PADRAO)} style={{ background: "none", border: `1px solid ${C.border}`, color: C.textFaint, borderRadius: 4, padding: "6px 10px", fontSize: 11, cursor: "pointer", fontFamily: sans }}>
              Restaurar padrão
            </button>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {planos.map((p, i) => (
            <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 12px", fontFamily: mono, fontSize: 13 }}>
              <span style={{ color: C.text }}>{p.velocidade}</span>
              <span style={{ color: C.teal, marginLeft: 8 }}>{fmtBRL(p.valor)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Mailing + funil de cobertura */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: C.textFaint }}>
              Mailing de prospecção
            </div>
            <div style={{ fontSize: 13, color: C.textDim, marginTop: 2 }}>
              {leads.length ? `${leads.length} leads carregados` : "Nenhum mailing carregado ainda"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar empresa ou cidade" style={{ ...inputStyle, width: 180, fontFamily: sans, fontSize: 12, padding: "6px 8px" }} />
            <select value={filtroCobertura} onChange={(e) => setFiltroCobertura(e.target.value)} style={{ ...inputStyle, width: "auto", fontFamily: sans, fontSize: 12, padding: "6px 8px" }}>
              <option value="todos">Cobertura: todos</option>
              <option value="valida">✅ Com cobertura</option>
              <option value="sem">❌ Sem cobertura</option>
              <option value="nao_encontrado">❓ Endereço não achado</option>
              <option value="erro">⚠️ Erro na consulta</option>
              <option value="nao_consultado">— Não consultados</option>
            </select>
            <input ref={fileRefMailing} type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => { const f = e.target.files[0]; if (f) handleImportMailing(f); e.target.value = ""; }} />
            <button onClick={() => fileRefMailing.current?.click()} style={{ background: "none", border: `1px solid ${C.tealDim}`, color: C.teal, borderRadius: 4, padding: "7px 12px", fontSize: 12, cursor: "pointer", fontFamily: sans }}>
              Importar CSV
            </button>
          </div>
        </div>
        <div style={{ fontSize: 11, color: C.textFaint, marginTop: 8 }}>
          Aceita direto o CSV de saída do bot de cobertura (coluna COBERTURA_VIVO) — leads com ✅ sobem pro topo da lista.
        </div>
        {leads.length > 0 && (
          <div style={{ display: "flex", gap: 24, marginTop: 12, flexWrap: "wrap" }}>
            <Stat label="Com cobertura" value={stats.valida} accent={C.teal} />
            <Stat label="Sem cobertura" value={stats.sem} accent={C.red} />
            <Stat label="Endereço não achado" value={stats.nao_encontrado} accent={C.amber} />
            <Stat label="Erro na consulta" value={stats.erro} accent={C.amber} />
            <Stat label="Não consultados" value={stats.nao_consultado} />
          </div>
        )}
        {leadsFiltrados.length > 0 && (
          <div style={{ overflowX: "auto", marginTop: 14 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: mono, fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: C.panelAlt, textAlign: "left" }}>
                  {["Empresa", "Cidade", "Porte", "Telefone", "Armário", "Cobertura", ""].map((h) => (
                    <th key={h} style={{ padding: "8px 10px", color: C.textFaint, fontWeight: 400, fontFamily: sans, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leadsFiltrados.map((l, i) => {
                  const porteLead = classificarPorte(l.faturamento);
                  const st = statusCobertura(l);
                  return (
                    <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, background: leadSelecionado === l ? C.panelAlt : "transparent" }}>
                      <td style={{ padding: "7px 10px", color: C.text, fontFamily: sans, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.empresa}</td>
                      <td style={{ padding: "7px 10px", color: C.textDim }}>{l.cidade}/{l.uf}</td>
                      <td style={{ padding: "7px 10px", color: C.textDim }}>{porteLead ? porteLead.porte : "—"}</td>
                      <td style={{ padding: "7px 10px", color: C.textDim }}>{l.telefone}</td>
                      <td style={{ padding: "7px 10px", color: l.armario ? C.teal : C.textFaint }}>{l.armario ? "confirmado" : "—"}</td>
                      <td style={{ padding: "7px 10px", whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: 10, fontFamily: mono, textTransform: "uppercase", color: COBERTURA_BADGE[st].cor, border: `1px solid ${COBERTURA_BADGE[st].cor}`, borderRadius: 3, padding: "2px 6px" }}>
                          {COBERTURA_BADGE[st].txt}
                        </span>
                      </td>
                      <td style={{ padding: "7px 10px", whiteSpace: "nowrap" }}>
                        <button onClick={() => selecionarLead(l)} style={{ background: "none", border: `1px solid ${C.border}`, color: C.teal, borderRadius: 4, padding: "4px 8px", fontSize: 11, cursor: "pointer", fontFamily: sans, whiteSpace: "nowrap", marginRight: 6 }}>
                          Gerar abordagem →
                        </button>
                        {onUsarNaProposta && (
                          <button onClick={() => onUsarNaProposta(l)} style={{ background: "none", border: `1px solid ${C.tealDim}`, color: C.teal, borderRadius: 4, padding: "4px 8px", fontSize: 11, cursor: "pointer", fontFamily: sans, whiteSpace: "nowrap" }}>
                            Usar na proposta →
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Abordagem gerada */}
      {leadSelecionado && (
        <div ref={painelAbordagemRef} style={{ background: C.panel, border: `1px solid ${C.tealDim}`, borderRadius: 8, padding: 18, scrollMarginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: C.textFaint }}>
              Abordagem — {leadSelecionado.empresa}
            </div>
            {porteInfo && (
              <span style={{ fontSize: 10, fontFamily: mono, textTransform: "uppercase", color: C.teal, border: `1px solid ${C.tealDim}`, borderRadius: 3, padding: "2px 6px" }}>
                Porte estimado: {porteInfo.porte}
              </span>
            )}
          </div>
          {leadSelecionado.enderecoResumo && (
            <div style={{ fontSize: 12, color: C.textFaint, marginBottom: 10 }}>{leadSelecionado.enderecoResumo}</div>
          )}
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: C.textDim, fontFamily: sans }}>Plano:</span>
            <select value={planoEscolhido} onChange={(e) => setPlanoEscolhido(parseInt(e.target.value, 10))} style={{ ...inputStyle, width: "auto", fontFamily: sans, fontSize: 12, padding: "6px 8px" }}>
              {planos.map((p, i) => (
                <option key={i} value={i}>
                  {p.velocidade} — {fmtBRL(p.valor)}
                </option>
              ))}
            </select>
            {porteInfo && <span style={{ fontSize: 11, color: C.textFaint, fontFamily: sans }}>(sugerido pelo porte)</span>}
          </div>
          <MessageCard title="Rascunho de abordagem" text={mensagem} whatsappPhone={leadSelecionado.telefone} />
        </div>
      )}
    </div>
  );
}

// ---------------- App ----------------

export default function App() {
  const [tab, setTab] = useState("mailing");
  const [leads, setLeads] = useState([]);
  const [prefill, setPrefill] = useState(null);
  const [aparelhos, setAparelhos] = useState([]);
  const [tv, setTv] = useState([]);
  const [planosBL, setPlanosBL] = useState(PLANOS_BL_PADRAO);
  const [propostas, setPropostas] = useState([]);
  const [config, setConfig] = useState(CONFIG_PADRAO);
  const [feriadosSet, setFeriadosSet] = useState(new Set());
  const [carregandoCatalogo, setCarregandoCatalogo] = useState(true);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("catalogo-aparelhos", false);
        if (res?.value) setAparelhos(JSON.parse(res.value));
      } catch (e) {
        // sem catálogo salvo ainda
      }
      try {
        const resTv = await window.storage.get("catalogo-tv", false);
        if (resTv?.value) setTv(JSON.parse(resTv.value));
      } catch (e) {
        // sem catálogo salvo ainda
      }
      try {
        const resBL = await window.storage.get("planos-banda-larga", false);
        if (resBL?.value) setPlanosBL(JSON.parse(resBL.value));
      } catch (e) {
        // sem planos salvos ainda — segue com o padrão
      }
      try {
        const res2 = await window.storage.get("log-propostas", false);
        if (res2?.value) setPropostas(JSON.parse(res2.value));
      } catch (e) {
        // sem log salvo ainda
      }
      try {
        const resCfg = await window.storage.get("config-white-label", false);
        if (resCfg?.value) setConfig({ ...CONFIG_PADRAO, ...JSON.parse(resCfg.value) });
      } catch (e) {
        // sem config salva ainda — segue com o padrão
      }
      try {
        const ano = new Date().getFullYear();
        const chaveFeriados = `feriados-${ano}`;
        const cacheFeriados = await window.storage.get(chaveFeriados, true).catch(() => null);
        if (cacheFeriados?.value) {
          setFeriadosSet(new Set(JSON.parse(cacheFeriados.value)));
        } else {
          const resp = await fetch(`https://brasilapi.com.br/api/feriados/v1/${ano}`);
          if (resp.ok) {
            const dados = await resp.json();
            const datas = dados.map((f) => f.date);
            setFeriadosSet(new Set(datas));
            window.storage.set(chaveFeriados, JSON.stringify(datas), true).catch(() => {});
          }
        }
      } catch (e) {
        // segue sem feriados — cálculo de follow-up cai para dias corridos
      } finally {
        setCarregandoCatalogo(false);
      }
    })();
  }, []);

  const salvarConfig = async (novaConfig) => {
    setConfig(novaConfig);
    try {
      const res = await window.storage.set("config-white-label", JSON.stringify(novaConfig), false);
      return !!res;
    } catch (e) {
      return false;
    }
  };

  const salvarPropostas = async (lista) => {
    setPropostas(lista);
    try {
      await window.storage.set("log-propostas", JSON.stringify(lista), false);
    } catch (e) {
      // segue mesmo se não conseguir persistir
    }
  };

  const registrarEnvio = (entry) => salvarPropostas([...propostas, entry]);

  const atualizarStatus = (alvo, status) =>
    salvarPropostas(
      propostas.map((p) => (p.dataEnvio === alvo.dataEnvio && p.cnpj === alvo.cnpj ? { ...p, status } : p))
    );

  const useLead = (lead) => {
    setPrefill(lead);
    setTab("proposta");
  };
  
  const useLeadBandaLarga = (lead) => {
  setPrefill({
    cliente: lead.empresa,
    cnpj: lead.cnpj,
    telefone: lead.telefone,
    coberturaFibra: statusCobertura(lead) === "valida",
  });
  setTab("proposta");
};

  return (
    <div style={{ background: C.bg, minHeight: "100%", color: C.text, fontFamily: sans, padding: "20px 16px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: C.teal, fontFamily: mono }}>
            Cockpit de proposta · {config.nomeEmpresa}
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, marginTop: 2 }}>Mailing e geração de oferta</div>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {[
            ["mailing", "Mailing"],
            ["proposta", "Proposta"],
            ["followup", "Follow-up"],
            ["aparelhos", "Aparelhos"],
            ["tv", "TV a cabo"],
            ["bandalarga", "Banda Larga"],
            ["config", "Configurações"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                background: tab === id ? C.panel : "transparent",
                border: `1px solid ${tab === id ? C.tealDim : C.border}`,
                color: tab === id ? C.teal : C.textDim,
                borderRadius: 6,
                padding: "7px 16px",
                fontSize: 13,
                cursor: "pointer",
                fontFamily: sans,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {carregandoCatalogo ? (
          <div style={{ fontSize: 13, color: C.textFaint, padding: 18 }}>Carregando catálogo salvo…</div>
        ) : tab === "mailing" ? (
          <MailingTab leads={leads} setLeads={setLeads} onUseLead={useLead} />
        ) : tab === "proposta" ? (
          <PropostaTab prefill={prefill} aparelhos={aparelhos} tv={tv} config={config} onRegistrarEnvio={registrarEnvio} />
        ) : tab === "followup" ? (
          <FollowUpTab propostas={propostas} atualizarStatus={atualizarStatus} config={config} feriadosSet={feriadosSet} />
        ) : tab === "aparelhos" ? (
          <AparelhosTab aparelhos={aparelhos} setAparelhos={setAparelhos} />
        ) : tab === "tv" ? (
          <TvCaboTab tv={tv} setTv={setTv} />
        ) : tab === "bandalarga" ? (
          <BandaLargaTab planos={planosBL} setPlanos={setPlanosBL} config={config} onUsarNaProposta={useLeadBandaLarga} />
        ) : (
          <ConfiguracoesTab config={config} salvarConfig={salvarConfig} />
        )}
      </div>
    </div>
  );
}
