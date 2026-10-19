// Leitura do CSV e utilitários compartilhados pelas abas do dashboard.

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

export async function carregarRegistros() {
    const resposta = await fetch(`${ARQUIVO_CSV}?v=${Date.now()}`, { cache: 'no-store' });
    if (!resposta.ok) {
        throw new Error(`Arquivo não encontrado (HTTP ${resposta.status})`);
    }
    return lerCsv(await resposta.text());
}

export function lerCsv(texto) {
    const linhas = texto.replace(/^﻿/, '').split(/\r?\n/).filter(linha => linha.trim());
    if (linhas.length === 0) {
        throw new Error('CSV vazio');
    }

    const cabecalho = linhas.shift().split(';').map(nome => nome.trim());
    const faltantes = OBRIGATORIAS.filter(nome => !cabecalho.includes(nome));
    if (faltantes.length) {
        throw new Error(`Colunas ausentes no CSV: ${faltantes.join(', ')}`);
    }

    const indiceData = cabecalho.indexOf('data');
    const indices = Object.entries(COLUNAS).map(([coluna, campo]) => [campo, cabecalho.indexOf(coluna)]);

    const registros = [];
    for (const linha of linhas) {
        const celulas = linha.split(';');
        const iso = (celulas[indiceData] || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) continue;

        const registro = {
            iso,
            ano: Number(iso.slice(0, 4)),
            mes: Number(iso.slice(5, 7)) - 1,
            dia: Number(iso.slice(8, 10)),
        };
        for (const [campo, indice] of indices) {
            registro[campo] = indice < 0 ? null : lerNumero(celulas[indice]);
        }
        registros.push(registro);
    }

    return registros.sort((a, b) => a.iso.localeCompare(b.iso));
}

// Célula vazia ou inválida vira null (nunca 0), para ficar fora das médias.
function lerNumero(valor) {
    const texto = (valor || '').trim().replace(',', '.');
    if (!texto) return null;
    const numero = Number(texto);
    return Number.isFinite(numero) ? numero : null;
}

export function condicaoDoCodigo(codigo) {
    if (codigo === null) return null;
    return CONDICOES.find(grupo => grupo.codigos.includes(codigo))
        || { texto: 'Outra', icone: 'circle-question' };
}

export function classificarDia(registro) {
    if (registro.tempMax !== null && registro.tempMax > LIMITES.diaQuente) return 'quente';
    if (registro.tempMin !== null && registro.tempMin < LIMITES.diaFrio) return 'frio';
    return 'agradavel';
}

// --- Agregações (ignoram valores ausentes) ---------------------------------

export function valoresDe(registros, campo) {
    return registros.map(r => r[campo]).filter(v => v !== null);
}

export function media(registros, campo) {
    const valores = valoresDe(registros, campo);
    return valores.length ? soma(valores) / valores.length : null;
}

export function total(registros, campo) {
    const valores = valoresDe(registros, campo);
    return valores.length ? soma(valores) : null;
}

// Registro com o menor ou o maior valor do campo (o primeiro, em caso de empate).
export function extremo(registros, campo, tipo) {
    let escolhido = null;
    for (const registro of registros) {
        const valor = registro[campo];
        if (valor === null) continue;
        if (escolhido === null
            || (tipo === 'min' && valor < escolhido[campo])
            || (tipo === 'max' && valor > escolhido[campo])) {
            escolhido = registro;
        }
    }
    return escolhido;
}

function soma(valores) {
    return valores.reduce((acumulado, valor) => acumulado + valor, 0);
}

export function contar(registros, condicao) {
    return registros.filter(condicao).length;
}

export const ehQuente = r => r.tempMax !== null && r.tempMax > LIMITES.diaQuente;
export const ehFrio = r => r.tempMin !== null && r.tempMin < LIMITES.diaFrio;

// --- Resumos mensais e média de referência -----------------------------------

// Anos completos usados como referência. Não é a normal climatológica oficial.
export const ANOS_REFERENCIA = { inicio: 2020, fim: 2025 };
export const NOME_REFERENCIA = `média ${ANOS_REFERENCIA.inicio}–${ANOS_REFERENCIA.fim}`;

// Um resumo por mês com dados, em ordem cronológica.
export function resumirMeses(registros) {
    const grupos = new Map();
    for (const registro of registros) {
        const chave = `${registro.ano}-${registro.mes}`;
        if (!grupos.has(chave)) grupos.set(chave, []);
        grupos.get(chave).push(registro);
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

// Para cada mês do calendário, a média dos meses completos dos anos de referência.
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

// "+12%" / "−8%" em relação à referência.
export function formatarVariacao(valor, referencia) {
    if (valor === null || referencia === null || referencia === 0) return SEM_DADO;
    const percentual = Math.round((valor / referencia - 1) * 100);
    if (percentual === 0) return '0%';
    return `${percentual > 0 ? '+' : '−'}${Math.abs(percentual)}%`;
}

// --- Formatação --------------------------------------------------------------

const SEM_DADO = '—';

export function formatarNumero(valor, casas = 1, unidade = '') {
    if (valor === null || valor === undefined) return SEM_DADO;
    const texto = valor.toLocaleString('pt-BR', {
        minimumFractionDigits: casas,
        maximumFractionDigits: casas,
    });
    return unidade ? `${texto} ${unidade}` : texto;
}

export function diaMes(registro) {
    return `${String(registro.dia).padStart(2, '0')}/${String(registro.mes + 1).padStart(2, '0')}`;
}

export function dataCompleta(registro) {
    return `${diaMes(registro)}/${registro.ano}`;
}

export function diasNoMes(ano, mes) {
    return new Date(ano, mes + 1, 0).getDate();
}
