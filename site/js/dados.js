// @ts-check
// Leitura do CSV e utilitários compartilhados pelas abas do dashboard.

/**
 * Um dia do CSV. Valor ausente é null (nunca 0), para ficar fora de médias e somas.
 * @typedef {object} Registro
 * @property {string} iso  data AAAA-MM-DD
 * @property {number} ano
 * @property {number} mes  0 = janeiro
 * @property {number} dia
 * @property {number | null} tempMin
 * @property {number | null} tempMax
 * @property {number | null} chuva
 * @property {number | null} umidade
 * @property {number | null} vento
 * @property {number | null} condicao  código WMO
 * @property {number | null} sensMin
 * @property {number | null} sensMax
 */

/**
 * @typedef {object} ResumoMensal
 * @property {number} ano
 * @property {number} mes
 * @property {number} dias  dias com dados
 * @property {boolean} completo
 * @property {number | null} chuva
 * @property {number | null} tempMinMedia
 * @property {number | null} tempMaxMedia
 * @property {number} quentes
 * @property {number} frios
 * @property {Registro | null} minimo
 * @property {Registro | null} maximo
 */

/**
 * @typedef {object} ReferenciaMensal
 * @property {number} mes
 * @property {number} anos  quantos anos completos entraram na média
 * @property {number | null} chuva
 * @property {number | null} tempMinMedia
 * @property {number | null} tempMaxMedia
 * @property {number | null} quentes
 * @property {number | null} frios
 */

export const ARQUIVO_CSV = 'clima_vassouras.csv';

// Limites usados nos cards, na tabela e na classificação dos dias.
export const LIMITES = {
    diaQuente: 28,   // máxima acima disto (°C)
    diaFrio: 14,     // mínima abaixo disto (°C)
    diaChuvoso: 1,   // chuva a partir disto (mm)
};

export const NOMES_MESES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// Coluna do CSV -> campo do registro.
const COLUNAS = {
    temperatura_minima: 'tempMin',
    temperatura_maxima: 'tempMax',
    chuva_mm: 'chuva',
    umidade_media: 'umidade',
    vento_maximo_kmh: 'vento',
    condicao: 'condicao',
    sensacao_minima: 'sensMin',
    sensacao_maxima: 'sensMax',
};

const OBRIGATORIAS = ['data', 'temperatura_minima', 'temperatura_maxima', 'chuva_mm'];

// Códigos WMO (weather_code) agrupados como no PRD.
const CONDICOES = [
    { codigos: [0, 1], texto: 'Ensolarado', icone: 'sun' },
    { codigos: [2], texto: 'Parcialmente nublado', icone: 'cloud-sun' },
    { codigos: [3], texto: 'Nublado', icone: 'cloud' },
    { codigos: [45, 48], texto: 'Nevoeiro', icone: 'smog' },
    { codigos: [51, 53, 55, 56, 57], texto: 'Garoa', icone: 'cloud-rain' },
    { codigos: [61, 63, 65, 66, 67, 80, 81, 82], texto: 'Chuva', icone: 'cloud-showers-heavy' },
    { codigos: [95, 96, 99], texto: 'Trovoada', icone: 'cloud-bolt' },
];

/** @returns {Promise<Registro[]>} */
export async function carregarRegistros() {
    const resposta = await fetch(`${ARQUIVO_CSV}?v=${Date.now()}`, { cache: 'no-store' });
    if (!resposta.ok) {
        throw new Error(`Arquivo não encontrado (HTTP ${resposta.status})`);
    }
    return lerCsv(await resposta.text());
}

/**
 * Lê o CSV pelo nome das colunas (a ordem não importa).
 * @param {string} texto
 * @returns {Registro[]}
 */
export function lerCsv(texto) {
    const linhas = texto.replace(/^﻿/, '').split(/\r?\n/).filter(linha => linha.trim());
    if (linhas.length === 0) {
        throw new Error('CSV vazio');
    }

    const cabecalho = /** @type {string} */ (linhas.shift()).split(';').map(nome => nome.trim());
    const faltantes = OBRIGATORIAS.filter(nome => !cabecalho.includes(nome));
    if (faltantes.length) {
        throw new Error(`Colunas ausentes no CSV: ${faltantes.join(', ')}`);
    }

    const indiceData = cabecalho.indexOf('data');
    const indices = Object.entries(COLUNAS).map(([coluna, campo]) => [campo, cabecalho.indexOf(coluna)]);

    /** @type {Registro[]} */
    const registros = [];
    for (const linha of linhas) {
        const celulas = linha.split(';');
        const iso = (celulas[indiceData] || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) continue;

        /** @type {any} */
        const registro = {
            iso,
            ano: Number(iso.slice(0, 4)),
            mes: Number(iso.slice(5, 7)) - 1,
            dia: Number(iso.slice(8, 10)),
        };
        for (const [campo, indice] of indices) {
            registro[campo] = Number(indice) < 0 ? null : lerNumero(celulas[Number(indice)]);
        }
        registros.push(registro);
    }

    return registros.sort((a, b) => a.iso.localeCompare(b.iso));
}

/**
 * Célula vazia ou inválida vira null (nunca 0), para ficar fora das médias.
 * @param {string | undefined} valor
 */
function lerNumero(valor) {
    const texto = (valor || '').trim().replace(',', '.');
    if (!texto) return null;
    const numero = Number(texto);
    return Number.isFinite(numero) ? numero : null;
}

/**
 * @param {number | null} codigo  código WMO
 * @returns {{ texto: string, icone: string } | null}
 */
export function condicaoDoCodigo(codigo) {
    if (codigo === null) return null;
    return CONDICOES.find(grupo => grupo.codigos.includes(codigo))
        || { texto: 'Outra', icone: 'circle-question' };
}

/**
 * @param {Pick<Registro, 'tempMin' | 'tempMax'>} registro
 * @returns {'quente' | 'frio' | 'agradavel'}
 */
export function classificarDia(registro) {
    if (ehQuente(registro)) return 'quente';
    if (ehFrio(registro)) return 'frio';
    return 'agradavel';
}

// --- Agregações (ignoram valores ausentes) ---------------------------------
// Funcionam com qualquer lista de objetos: registros, resumos mensais ou referências.

/**
 * @param {readonly object[]} lista
 * @param {string} campo
 * @returns {number[]}
 */
export function valoresDe(lista, campo) {
    return lista.map(item => /** @type {any} */ (item)[campo]).filter(v => v !== null && v !== undefined);
}

/** @param {readonly object[]} lista @param {string} campo */
export function media(lista, campo) {
    const valores = valoresDe(lista, campo);
    return valores.length ? soma(valores) / valores.length : null;
}

/** @param {readonly object[]} lista @param {string} campo */
export function total(lista, campo) {
    const valores = valoresDe(lista, campo);
    return valores.length ? soma(valores) : null;
}

/**
 * Item com o menor ou o maior valor do campo (o primeiro, em caso de empate).
 * @template {object} T
 * @param {readonly T[]} lista
 * @param {string} campo
 * @param {'min' | 'max'} tipo
 * @returns {T | null}
 */
export function extremo(lista, campo, tipo) {
    /** @type {T | null} */
    let escolhido = null;
    for (const item of lista) {
        const valor = /** @type {any} */ (item)[campo];
        if (valor === null || valor === undefined) continue;
        const atual = escolhido === null ? null : /** @type {any} */ (escolhido)[campo];
        if (atual === null || (tipo === 'min' && valor < atual) || (tipo === 'max' && valor > atual)) {
            escolhido = item;
        }
    }
    return escolhido;
}

/** @param {number[]} valores */
function soma(valores) {
    return valores.reduce((acumulado, valor) => acumulado + valor, 0);
}

/**
 * @template T
 * @param {readonly T[]} lista
 * @param {(item: T) => boolean} condicao
 */
export function contar(lista, condicao) {
    return lista.filter(condicao).length;
}

/** @param {Pick<Registro, 'tempMax'>} r */
export const ehQuente = r => r.tempMax !== null && r.tempMax > LIMITES.diaQuente;
/** @param {Pick<Registro, 'tempMin'>} r */
export const ehFrio = r => r.tempMin !== null && r.tempMin < LIMITES.diaFrio;

// --- Resumos mensais e média de referência -----------------------------------

// Anos completos usados como referência. Não é a normal climatológica oficial.
export const ANOS_REFERENCIA = { inicio: 2020, fim: 2025 };
export const NOME_REFERENCIA = `média ${ANOS_REFERENCIA.inicio}–${ANOS_REFERENCIA.fim}`;

/**
 * Um resumo por mês com dados, em ordem cronológica.
 * @param {Registro[]} registros
 * @returns {ResumoMensal[]}
 */
export function resumirMeses(registros) {
    /** @type {Map<string, Registro[]>} */
    const grupos = new Map();
    for (const registro of registros) {
        const chave = `${registro.ano}-${registro.mes}`;
        const grupo = grupos.get(chave);
        if (grupo) grupo.push(registro);
        else grupos.set(chave, [registro]);
    }

    return [...grupos.values()].map(doMes => {
        const { ano, mes } = doMes[0];
        return {
            ano,
            mes,
            dias: doMes.length,
            completo: doMes.length === diasNoMes(ano, mes),
            chuva: total(doMes, 'chuva'),
            tempMinMedia: media(doMes, 'tempMin'),
            tempMaxMedia: media(doMes, 'tempMax'),
            quentes: contar(doMes, ehQuente),
            frios: contar(doMes, ehFrio),
            minimo: extremo(doMes, 'tempMin', 'min'),
            maximo: extremo(doMes, 'tempMax', 'max'),
        };
    });
}

/**
 * Para cada mês do calendário, a média dos meses completos dos anos de referência.
 * @param {ResumoMensal[]} resumos
 * @returns {ReferenciaMensal[]}
 */
export function referenciaMensal(resumos) {
    return NOMES_MESES.map((_, mes) => {
        const base = resumos.filter(r => r.mes === mes && r.completo
            && r.ano >= ANOS_REFERENCIA.inicio && r.ano <= ANOS_REFERENCIA.fim);
        return {
            mes,
            anos: base.length,
            chuva: media(base, 'chuva'),
            tempMinMedia: media(base, 'tempMinMedia'),
            tempMaxMedia: media(base, 'tempMaxMedia'),
            quentes: media(base, 'quentes'),
            frios: media(base, 'frios'),
        };
    });
}

// --- Formatação --------------------------------------------------------------

const SEM_DADO = '—';

/**
 * "+12%" / "−8%" em relação à referência.
 * @param {number | null} valor
 * @param {number | null} referencia
 */
export function formatarVariacao(valor, referencia) {
    if (valor === null || referencia === null || referencia === 0) return SEM_DADO;
    const percentual = Math.round((valor / referencia - 1) * 100);
    if (percentual === 0) return '0%';
    return `${percentual > 0 ? '+' : '−'}${Math.abs(percentual)}%`;
}

/**
 * @param {number | null | undefined} valor
 * @param {number} [casas]
 * @param {string} [unidade]
 */
export function formatarNumero(valor, casas = 1, unidade = '') {
    if (valor === null || valor === undefined) return SEM_DADO;
    const texto = valor.toLocaleString('pt-BR', {
        minimumFractionDigits: casas,
        maximumFractionDigits: casas,
    });
    return unidade ? `${texto} ${unidade}` : texto;
}

/** @param {Pick<Registro, 'dia' | 'mes'>} registro */
export function diaMes(registro) {
    return `${String(registro.dia).padStart(2, '0')}/${String(registro.mes + 1).padStart(2, '0')}`;
}

/** @param {Pick<Registro, 'dia' | 'mes' | 'ano'>} registro */
export function dataCompleta(registro) {
    return `${diaMes(registro)}/${registro.ano}`;
}

/** @param {number} ano @param {number} mes  0 = janeiro */
export function diasNoMes(ano, mes) {
    return new Date(ano, mes + 1, 0).getDate();
}
