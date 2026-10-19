// Inicialização: carrega o CSV, monta o filtro e o selo do último dado.

import { NOMES_MESES, carregarRegistros, dataCompleta, diasNoMes } from './dados.js';
import { renderizarMes } from './mes.js';

// O dado de ontem chega toda manhã; acima disto o selo avisa atraso.
const DIAS_ATE_ATRASO = 2;

const estado = { registros: [], ano: null, mes: null };

const el = {
    selo: document.getElementById('seloDados'),
    erro: document.getElementById('mensagemErro'),
    conteudo: document.getElementById('conteudo'),
    ano: document.getElementById('selecaoAno'),
    mes: document.getElementById('selecaoMes'),
    avisoParcial: document.getElementById('avisoParcial'),
    tituloTabela: document.getElementById('tituloTabela'),
};

document.addEventListener('DOMContentLoaded', iniciar);

async function iniciar() {
    try {
        estado.registros = await carregarRegistros();
        if (estado.registros.length === 0) throw new Error('CSV sem registros');
    } catch (erro) {
        console.error('Erro ao ler o CSV:', erro);
        mostrarSelo('erro', 'fa-triangle-exclamation', 'Erro ao carregar os dados');
        el.erro.classList.remove('oculto');
        return;
    }

    atualizarSelo();
    escolherPeriodoInicial();
    el.ano.addEventListener('change', () => selecionar(Number(el.ano.value), estado.mes));
    el.mes.addEventListener('change', () => selecionar(estado.ano, Number(el.mes.value)));
    el.conteudo.classList.remove('oculto');
}

function mostrarSelo(tipo, nomeIcone, texto) {
    const icone = document.createElement('i');
    icone.className = `fa-solid ${nomeIcone}`;
    icone.setAttribute('aria-hidden', 'true');
    const rotulo = document.createElement('span');
    rotulo.textContent = texto;
    el.selo.className = `selo ${tipo}`;
    el.selo.replaceChildren(icone, rotulo);
}

function atualizarSelo() {
    const ultimo = estado.registros.at(-1);
    const hoje = new Date();
    const inicioHoje = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const atraso = Math.round((inicioHoje - Date.UTC(ultimo.ano, ultimo.mes, ultimo.dia)) / 864e5);

    if (atraso > DIAS_ATE_ATRASO) {
        mostrarSelo('alerta', 'fa-clock', `Dados atrasados · último: ${dataCompleta(ultimo)}`);
    } else {
        mostrarSelo('ok', 'fa-circle-check', `Último dado: ${dataCompleta(ultimo)}`);
    }
}

// --- Filtro de mês e ano -----------------------------------------------------

function anosComDados() {
    return [...new Set(estado.registros.map(r => r.ano))];
}

function mesesComDados(ano) {
    return [...new Set(estado.registros.filter(r => r.ano === ano).map(r => r.mes))];
}

function escolherPeriodoInicial() {
    // ?mes=2026-10 na URL tem prioridade; senão, o mês do último dado.
    const pedido = new URLSearchParams(location.search).get('mes');
    const encontrado = /^(\d{4})-(\d{2})$/.exec(pedido || '');
    if (encontrado) {
        const ano = Number(encontrado[1]);
        const mes = Number(encontrado[2]) - 1;
        if (mesesComDados(ano).includes(mes)) {
            selecionar(ano, mes);
            return;
        }
    }

    const ultimo = estado.registros.at(-1);
    selecionar(ultimo.ano, ultimo.mes);
}

function selecionar(ano, mes) {
    const meses = mesesComDados(ano);
    // Ao trocar de ano, mantém o mês se ele tiver dados; senão, o último disponível.
    estado.ano = ano;
    estado.mes = meses.includes(mes) ? mes : meses.at(-1);

    preencherOpcoes(el.ano, anosComDados().map(a => [a, a]), estado.ano);
    preencherOpcoes(el.mes, meses.map(m => [m, NOMES_MESES[m]]), estado.mes);
    gravarNaUrl();
    atualizarMes();
}

function preencherOpcoes(select, opcoes, selecionado) {
    select.replaceChildren(...opcoes.map(([valor, texto]) => new Option(texto, valor, false, valor === selecionado)));
}

function gravarNaUrl() {
    const parametros = new URLSearchParams(location.search);
    parametros.set('aba', 'mes');
    parametros.set('mes', `${estado.ano}-${String(estado.mes + 1).padStart(2, '0')}`);
    history.replaceState(null, '', `?${parametros}`);
}

function atualizarMes() {
    const doMes = estado.registros.filter(r => r.ano === estado.ano && r.mes === estado.mes);
    const totalDias = diasNoMes(estado.ano, estado.mes);
    const nome = `${NOMES_MESES[estado.mes]} de ${estado.ano}`;

    el.tituloTabela.textContent = `Registros de ${nome}`;
    el.avisoParcial.textContent = doMes.length < totalDias
        ? `Mês parcial: ${doMes.length} de ${totalDias} dias com dados.`
        : '';
    el.avisoParcial.classList.toggle('oculto', doMes.length >= totalDias);

    renderizarMes(doMes);
}
