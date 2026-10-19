// @ts-check
// Inicialização: carrega o CSV, monta abas e filtro, e guarda o estado na URL.

import {
    NOMES_MESES, carregarRegistros, dataCompleta, diasNoMes, referenciaMensal, resumirMeses,
} from './dados.js';
import { renderizarMes } from './mes.js';
import { icone } from './dom.js';
import { OPCOES_METRICA } from './metricas.js';

/** @typedef {'mes' | 'ano' | 'comparar' | 'recordes' | 'calendario'} Aba */

// O dado de ontem chega toda manhã; acima disto o selo avisa atraso.
const DIAS_ATE_ATRASO = 2;

// Quais filtros cada aba usa.
/** @type {Record<Aba, { filtros: string[], titulo: string }>} */
const ABAS = {
    mes: { filtros: ['mes', 'ano'], titulo: 'Filtrar período' },
    ano: { filtros: ['ano'], titulo: 'Escolher o ano' },
    comparar: { filtros: ['mes', 'ano'], titulo: 'Escolher o mês (o ano fica em destaque)' },
    recordes: { filtros: [], titulo: '' },
    calendario: { filtros: ['ano', 'metrica'], titulo: 'Escolher o ano e a métrica' },
};

// As outras abas só são baixadas quando abertas pela primeira vez (a aba Mês já vem carregada).
// Cada entrada carrega o módulo e devolve a função que desenha a aba com o estado atual.
/** @type {Record<Exclude<Aba, 'mes'>, () => Promise<() => void>>} */
const ABAS_SOB_DEMANDA = {
    ano: async () => {
        const { renderizarAno } = await import('./ano.js');
        return () => renderizarAno(estado.ano, estado.resumos, estado.referencia);
    },
    comparar: async () => {
        const { renderizarComparar } = await import('./comparar.js');
        return () => renderizarComparar(estado.mes, estado.ano, estado.resumos, estado.referencia);
    },
    recordes: async () => {
        const { renderizarRecordes } = await import('./recordes.js');
        return () => renderizarRecordes(estado.registros, estado.resumos);
    },
    calendario: async () => {
        const { renderizarCalendario } = await import('./calendario.js');
        return () => renderizarCalendario(estado.registros, estado.ano, estado.metrica);
    },
};

const estado = {
    /** @type {import('./dados.js').Registro[]} */ registros: [],
    /** @type {import('./dados.js').ResumoMensal[]} */ resumos: [],
    /** @type {import('./dados.js').ReferenciaMensal[]} */ referencia: [],
    /** @type {Aba} */ aba: 'mes',
    ano: 0,
    mes: 0,
    metrica: OPCOES_METRICA[0][0],
};

/** @param {string} id */
const porId = id => /** @type {HTMLElement} */ (document.getElementById(id));

const el = {
    selo: porId('seloDados'),
    erro: porId('mensagemErro'),
    tentarDeNovo: porId('tentarDeNovo'),
    conteudo: porId('conteudo'),
    filtro: porId('filtro'),
    tituloFiltro: porId('tituloFiltro'),
    ano: /** @type {HTMLSelectElement} */ (porId('selecaoAno')),
    mes: /** @type {HTMLSelectElement} */ (porId('selecaoMes')),
    metrica: /** @type {HTMLSelectElement} */ (porId('selecaoMetrica')),
    avisoParcial: porId('avisoParcial'),
    tituloTabela: porId('tituloTabela'),
    abas: /** @type {HTMLElement[]} */ ([...document.querySelectorAll('[role="tab"]')]),
};

// Abas que não dependem do filtro: montadas uma vez por carga de dados.
const montadasUmaVez = new Set();
// Cada renderização ganha um número; uma aba que termina de carregar tarde não desenha por cima.
let renderizacaoAtual = 0;

// Módulos rodam depois do HTML lido: não é preciso esperar DOMContentLoaded.
// Assim o CSV começa a baixar já, em paralelo com o Chart.js.
configurarControles();
iniciar(carregarRegistros());

/** @param {Promise<import('./dados.js').Registro[]>} promessaRegistros */
async function iniciar(promessaRegistros) {
    try {
        estado.registros = await promessaRegistros;
        if (estado.registros.length === 0) throw new Error('CSV sem registros');
    } catch (erro) {
        console.error('Erro ao ler o CSV:', erro);
        mostrarSelo('erro', 'triangle-exclamation', 'Erro ao carregar os dados');
        el.erro.classList.remove('oculto');
        return;
    }

    estado.resumos = resumirMeses(estado.registros);
    estado.referencia = referenciaMensal(estado.resumos);
    montadasUmaVez.clear();

    atualizarSelo();
    lerUrl();
    el.erro.classList.add('oculto');
    el.conteudo.classList.remove('oculto');
    selecionar({});
}

function configurarControles() {
    el.ano.addEventListener('change', () => selecionar({ ano: Number(el.ano.value) }));
    el.mes.addEventListener('change', () => selecionar({ mes: Number(el.mes.value) }));
    el.metrica.addEventListener('change', () => selecionar({ metrica: el.metrica.value }));

    el.tentarDeNovo.addEventListener('click', () => {
        el.erro.classList.add('oculto');
        mostrarSelo('', 'spinner', 'Carregando dados...');
        iniciar(carregarRegistros());
    });

    // Voltar/avançar do navegador percorre as abas visitadas.
    window.addEventListener('popstate', () => {
        if (estado.registros.length === 0) return;
        lerUrl();
        selecionar({}, { historico: 'nenhum' });
    });

    configurarAbas();
}

/**
 * @param {string} tipo
 * @param {string} nomeIcone
 * @param {string} texto
 */
function mostrarSelo(tipo, nomeIcone, texto) {
    const rotulo = document.createElement('span');
    rotulo.textContent = texto;
    el.selo.className = `selo ${tipo}`.trim();
    const simbolo = icone(nomeIcone);
    if (nomeIcone === 'spinner') simbolo.classList.add('girando');
    el.selo.replaceChildren(simbolo, rotulo);
}

function atualizarSelo() {
    const ultimo = /** @type {import('./dados.js').Registro} */ (estado.registros.at(-1));
    const hoje = new Date();
    const inicioHoje = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const atraso = Math.round((inicioHoje - Date.UTC(ultimo.ano, ultimo.mes, ultimo.dia)) / 864e5);

    if (atraso > DIAS_ATE_ATRASO) {
        mostrarSelo('alerta', 'clock', `Dados atrasados · último: ${dataCompleta(ultimo)}`);
    } else {
        mostrarSelo('ok', 'circle-check', `Último dado: ${dataCompleta(ultimo)}`);
    }
}

// --- Abas ----------------------------------------------------------------------

function configurarAbas() {
    el.abas.forEach((aba, indice) => {
        aba.addEventListener('click', () => selecionar({ aba: /** @type {Aba} */ (aba.dataset.aba) }));
        // Setas, Home e End trocam de aba, como pede o padrão de abas acessíveis.
        aba.addEventListener('keydown', evento => {
            const destinos = {
                ArrowRight: (indice + 1) % el.abas.length,
                ArrowLeft: (indice - 1 + el.abas.length) % el.abas.length,
                Home: 0,
                End: el.abas.length - 1,
            };
            if (!Object.hasOwn(destinos, evento.key)) return;
            evento.preventDefault();
            const proxima = el.abas[destinos[/** @type {keyof destinos} */ (evento.key)]];
            proxima.focus();
            selecionar({ aba: /** @type {Aba} */ (proxima.dataset.aba) });
        });
    });
}

function mostrarAba() {
    for (const aba of el.abas) {
        const ativa = aba.dataset.aba === estado.aba;
        aba.setAttribute('aria-selected', String(ativa));
        aba.tabIndex = ativa ? 0 : -1;
        porId(/** @type {string} */ (aba.getAttribute('aria-controls'))).hidden = !ativa;
    }
}

// --- Filtro --------------------------------------------------------------------

function anosComDados() {
    return [...new Set(estado.registros.map(r => r.ano))];
}

function mesesDisponiveis() {
    // Na aba Comparar vale qualquer mês que exista em algum ano.
    const base = estado.aba === 'comparar'
        ? estado.resumos
        : estado.resumos.filter(r => r.ano === estado.ano);
    return [...new Set(base.map(r => r.mes))].sort((a, b) => a - b);
}

function lerUrl() {
    const parametros = new URLSearchParams(location.search);
    const ultimo = /** @type {import('./dados.js').Registro} */ (estado.registros.at(-1));
    estado.ano = ultimo.ano;
    estado.mes = ultimo.mes;
    estado.aba = 'mes';

    // Object.hasOwn: "constructor" ou "__proto__" na URL não podem passar por aba.
    const aba = parametros.get('aba');
    if (aba && Object.hasOwn(ABAS, aba)) estado.aba = /** @type {Aba} */ (aba);

    const pedido = /^(\d{4})-(\d{2})$/.exec(parametros.get('mes') || '');
    if (pedido && anosComDados().includes(Number(pedido[1]))) {
        estado.ano = Number(pedido[1]);
        estado.mes = Number(pedido[2]) - 1;
    }

    const metrica = parametros.get('metrica');
    if (OPCOES_METRICA.some(([chave]) => chave === metrica)) estado.metrica = /** @type {string} */ (metrica);
}

/**
 * Ponto único de mudança de estado: atualiza filtro, abas, URL e o conteúdo da aba.
 * @param {Partial<typeof estado>} mudancas
 * @param {{ historico?: 'auto' | 'nenhum' }} [opcoes]
 */
function selecionar(mudancas, { historico = 'auto' } = {}) {
    const trocouDeAba = mudancas.aba !== undefined && mudancas.aba !== estado.aba;
    Object.assign(estado, mudancas);

    // Ao trocar de ano ou de aba, mantém o mês se ele tiver dados; senão, o último disponível.
    const meses = mesesDisponiveis();
    if (!meses.includes(estado.mes)) estado.mes = /** @type {number} */ (meses.at(-1));

    const filtros = ABAS[estado.aba].filtros;
    el.filtro.classList.toggle('oculto', filtros.length === 0);
    el.tituloFiltro.textContent = ABAS[estado.aba].titulo;
    for (const nome of /** @type {const} */ (['ano', 'mes', 'metrica'])) {
        /** @type {HTMLElement} */ (el[nome].closest('.campo')).classList.toggle('oculto', !filtros.includes(nome));
    }

    preencherOpcoes(el.ano, anosComDados().map(a => [a, String(a)]), estado.ano);
    preencherOpcoes(el.mes, meses.map(m => [m, NOMES_MESES[m]]), estado.mes);
    preencherOpcoes(el.metrica, OPCOES_METRICA, estado.metrica);

    mostrarAba();
    // Trocar de aba cria uma entrada no histórico (o "voltar" do celular volta para a aba anterior);
    // trocar mês, ano ou métrica só atualiza a URL atual.
    if (historico !== 'nenhum') gravarNaUrl(trocouDeAba ? 'push' : 'replace');
    renderizarAbaAtual();
}

/**
 * @param {HTMLSelectElement} select
 * @param {(string | number)[][]} opcoes  pares [valor, texto]
 * @param {string | number} selecionado
 */
function preencherOpcoes(select, opcoes, selecionado) {
    select.replaceChildren(...opcoes.map(([valor, texto]) =>
        new Option(String(texto), String(valor), false, valor === selecionado)));
}

/** @param {'push' | 'replace'} modo */
function gravarNaUrl(modo) {
    const parametros = new URLSearchParams();
    parametros.set('aba', estado.aba);
    parametros.set('mes', `${estado.ano}-${String(estado.mes + 1).padStart(2, '0')}`);
    if (estado.aba === 'calendario') parametros.set('metrica', estado.metrica);
    const url = `?${parametros}`;
    if (url === location.search) return;
    if (modo === 'push') history.pushState(null, '', url);
    else history.replaceState(null, '', url);
}

// --- Renderização -----------------------------------------------------------

// Como um Error Boundary: um erro numa aba aparece só no painel dela, e as outras seguem funcionando.
async function renderizarAbaAtual() {
    const vez = ++renderizacaoAtual;
    const { aba, ano, mes } = estado;
    const painel = porId(`painel-${aba}`);
    el.avisoParcial.classList.add('oculto');

    try {
        if (aba === 'mes') {
            const doMes = estado.registros.filter(r => r.ano === ano && r.mes === mes);
            const totalDias = diasNoMes(ano, mes);
            el.tituloTabela.textContent = `Registros de ${NOMES_MESES[mes]} de ${ano}`;
            if (doMes.length < totalDias) {
                el.avisoParcial.textContent = `Mês parcial: ${doMes.length} de ${totalDias} dias com dados.`;
                el.avisoParcial.classList.remove('oculto');
            }
            renderizarMes(doMes);
        } else {
            // Recordes não depende do filtro: é montada uma vez por carga de dados.
            if (aba === 'recordes' && montadasUmaVez.has('recordes')) return;
            const desenharAba = await ABAS_SOB_DEMANDA[aba]();
            if (vez !== renderizacaoAtual) return; // o usuário já foi para outra aba
            desenharAba();
            if (aba === 'recordes') montadasUmaVez.add('recordes');
        }
        limparErroDaAba(painel);
    } catch (erro) {
        console.error(`Erro ao montar a aba ${aba}:`, erro);
        mostrarErroDaAba(painel);
    }
}

/** @param {HTMLElement} painel */
function mostrarErroDaAba(painel) {
    painel.classList.add('com-erro');
    if (painel.querySelector('.erro-aba')) return;
    const aviso = document.createElement('div');
    aviso.className = 'mensagem-erro erro-aba';
    aviso.setAttribute('role', 'alert');
    const titulo = document.createElement('h2');
    titulo.textContent = 'Não foi possível montar esta visão';
    const texto = document.createElement('p');
    texto.textContent = 'As outras abas continuam funcionando. Tente outro período ou recarregue a página.';
    aviso.append(titulo, texto);
    painel.prepend(aviso);
}

/** @param {HTMLElement} painel */
function limparErroDaAba(painel) {
    painel.classList.remove('com-erro');
    painel.querySelector('.erro-aba')?.remove();
}
