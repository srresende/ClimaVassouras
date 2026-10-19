// Inicialização: carrega o CSV, monta abas e filtro, e guarda o estado na URL.

import {
    NOMES_MESES, carregarRegistros, dataCompleta, diasNoMes, referenciaMensal, resumirMeses,
} from './dados.js';
import { renderizarMes } from './mes.js';
import { renderizarAno } from './ano.js';
import { renderizarComparar } from './comparar.js';
import { renderizarRecordes } from './recordes.js';
import { OPCOES_METRICA, renderizarCalendario } from './calendario.js';
import { icone } from './dom.js';

// O dado de ontem chega toda manhã; acima disto o selo avisa atraso.
const DIAS_ATE_ATRASO = 2;

// Quais filtros cada aba usa.
const ABAS = {
    mes: { filtros: ['mes', 'ano'], titulo: 'Filtrar período' },
    ano: { filtros: ['ano'], titulo: 'Escolher o ano' },
    comparar: { filtros: ['mes', 'ano'], titulo: 'Escolher o mês (o ano fica em destaque)' },
    recordes: { filtros: [], titulo: '' },
    calendario: { filtros: ['ano', 'metrica'], titulo: 'Escolher o ano e a métrica' },
};

const estado = {
    registros: [], resumos: [], referencia: [],
    aba: 'mes', ano: null, mes: null, metrica: OPCOES_METRICA[0][0],
};

const el = {
    selo: document.getElementById('seloDados'),
    erro: document.getElementById('mensagemErro'),
    conteudo: document.getElementById('conteudo'),
    filtro: document.getElementById('filtro'),
    tituloFiltro: document.getElementById('tituloFiltro'),
    ano: document.getElementById('selecaoAno'),
    mes: document.getElementById('selecaoMes'),
    metrica: document.getElementById('selecaoMetrica'),
    avisoParcial: document.getElementById('avisoParcial'),
    tituloTabela: document.getElementById('tituloTabela'),
    abas: [...document.querySelectorAll('[role="tab"]')],
};

document.addEventListener('DOMContentLoaded', iniciar);

async function iniciar() {
    try {
        estado.registros = await carregarRegistros();
        if (estado.registros.length === 0) throw new Error('CSV sem registros');
    } catch (erro) {
        console.error('Erro ao ler o CSV:', erro);
        mostrarSelo('erro', 'triangle-exclamation', 'Erro ao carregar os dados');
        el.erro.classList.remove('oculto');
        return;
    }

    estado.resumos = resumirMeses(estado.registros);
    estado.referencia = referenciaMensal(estado.resumos);

    atualizarSelo();
    lerUrl();
    configurarAbas();
    el.ano.addEventListener('change', () => selecionar({ ano: Number(el.ano.value) }));
    el.mes.addEventListener('change', () => selecionar({ mes: Number(el.mes.value) }));
    el.metrica.addEventListener('change', () => selecionar({ metrica: el.metrica.value }));

    el.conteudo.classList.remove('oculto');
    selecionar({});
}

function mostrarSelo(tipo, nomeIcone, texto) {
    const rotulo = document.createElement('span');
    rotulo.textContent = texto;
    el.selo.className = `selo ${tipo}`;
    el.selo.replaceChildren(icone(nomeIcone), rotulo);
}

function atualizarSelo() {
    const ultimo = estado.registros.at(-1);
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
        aba.addEventListener('click', () => selecionar({ aba: aba.dataset.aba }));
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
            const proxima = el.abas[destinos[evento.key]];
            proxima.focus();
            selecionar({ aba: proxima.dataset.aba });
        });
    });
}

function mostrarAba() {
    for (const aba of el.abas) {
        const ativa = aba.dataset.aba === estado.aba;
        aba.setAttribute('aria-selected', String(ativa));
        aba.tabIndex = ativa ? 0 : -1;
        document.getElementById(aba.getAttribute('aria-controls')).hidden = !ativa;
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
    const ultimo = estado.registros.at(-1);
    estado.ano = ultimo.ano;
    estado.mes = ultimo.mes;

    // Object.hasOwn: "constructor" ou "__proto__" na URL não podem passar por aba.
    if (Object.hasOwn(ABAS, parametros.get('aba'))) estado.aba = parametros.get('aba');

    const pedido = /^(\d{4})-(\d{2})$/.exec(parametros.get('mes') || '');
    if (pedido && anosComDados().includes(Number(pedido[1]))) {
        estado.ano = Number(pedido[1]);
        estado.mes = Number(pedido[2]) - 1;
    }

    if (OPCOES_METRICA.some(([chave]) => chave === parametros.get('metrica'))) {
        estado.metrica = parametros.get('metrica');
    }
}

function selecionar(mudancas) {
    Object.assign(estado, mudancas);

    // Ao trocar de ano ou de aba, mantém o mês se ele tiver dados; senão, o último disponível.
    const meses = mesesDisponiveis();
    if (!meses.includes(estado.mes)) estado.mes = meses.at(-1);

    const filtros = ABAS[estado.aba].filtros;
    el.filtro.classList.toggle('oculto', filtros.length === 0);
    el.tituloFiltro.textContent = ABAS[estado.aba].titulo;
    for (const nome of ['ano', 'mes', 'metrica']) {
        el[nome].closest('.campo').classList.toggle('oculto', !filtros.includes(nome));
    }

    preencherOpcoes(el.ano, anosComDados().map(a => [a, a]), estado.ano);
    preencherOpcoes(el.mes, meses.map(m => [m, NOMES_MESES[m]]), estado.mes);
    preencherOpcoes(el.metrica, OPCOES_METRICA, estado.metrica);

    mostrarAba();
    gravarNaUrl();
    renderizarAbaAtual();
}

function preencherOpcoes(select, opcoes, selecionado) {
    select.replaceChildren(...opcoes.map(([valor, texto]) => new Option(texto, valor, false, valor === selecionado)));
}

function gravarNaUrl() {
    const parametros = new URLSearchParams();
    parametros.set('aba', estado.aba);
    parametros.set('mes', `${estado.ano}-${String(estado.mes + 1).padStart(2, '0')}`);
    if (estado.aba === 'calendario') parametros.set('metrica', estado.metrica);
    history.replaceState(null, '', `?${parametros}`);
}

// --- Renderização -----------------------------------------------------------

function renderizarAbaAtual() {
    const { aba, ano, mes } = estado;
    el.avisoParcial.classList.add('oculto');

    if (aba === 'mes') {
        const doMes = estado.registros.filter(r => r.ano === ano && r.mes === mes);
        const totalDias = diasNoMes(ano, mes);
        el.tituloTabela.textContent = `Registros de ${NOMES_MESES[mes]} de ${ano}`;
        if (doMes.length < totalDias) {
            el.avisoParcial.textContent = `Mês parcial: ${doMes.length} de ${totalDias} dias com dados.`;
            el.avisoParcial.classList.remove('oculto');
        }
        renderizarMes(doMes);
    } else if (aba === 'ano') {
        renderizarAno(ano, estado.resumos, estado.referencia);
    } else if (aba === 'comparar') {
        renderizarComparar(mes, ano, estado.resumos, estado.referencia);
    } else if (aba === 'recordes') {
        renderizarRecordes(estado.registros, estado.resumos);
    } else if (aba === 'calendario') {
        renderizarCalendario(estado.registros, ano, estado.metrica);
    }
}
