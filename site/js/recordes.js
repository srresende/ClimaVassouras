// @ts-check
// Aba Recordes: extremos do período todo e de cada mês do calendário.

import { NOMES_MESES, dataCompleta, extremo, formatarNumero } from './dados.js';
import { card, linhaTabela } from './dom.js';

/**
 * @typedef {import('./dados.js').Registro} Registro
 * @typedef {import('./dados.js').ResumoMensal} ResumoMensal
 */

/**
 * @param {Registro | null} registro
 * @param {'tempMax' | 'tempMin' | 'chuva'} campo
 * @param {string} unidade
 */
function textoDia(registro, campo, unidade) {
    return registro ? `${formatarNumero(registro[campo], 1, unidade)} · ${dataCompleta(registro)}` : '—';
}

/** @param {ResumoMensal | null} resumo */
function textoMes(resumo) {
    return resumo ? `${formatarNumero(resumo.chuva, 1, 'mm')} · ${resumo.ano}` : '—';
}

/**
 * @param {Registro[]} registros
 * @param {ResumoMensal[]} resumos
 */
export function renderizarRecordes(registros, resumos) {
    // Totais mensais só contam meses completos (um mês pela metade seria sempre "o mais seco").
    const completos = resumos.filter(r => r.completo);
    const primeiro = registros[0];
    const ultimo = registros.at(-1);

    document.getElementById('periodoRecordes').textContent =
        `Período: ${dataCompleta(primeiro)} a ${dataCompleta(ultimo)}. Totais mensais consideram só meses completos.`;

    const quente = extremo(registros, 'tempMax', 'max');
    const frio = extremo(registros, 'tempMin', 'min');
    const chuvoso = extremo(registros, 'chuva', 'max');
    const sensacao = extremo(registros, 'sensMax', 'max');
    const mesChuvoso = extremo(completos, 'chuva', 'max');
    const mesSeco = extremo(completos, 'chuva', 'min');

    document.getElementById('cardsRecordes').replaceChildren(
        card({
            titulo: 'Dia mais quente', cor: 'cor-rosa',
            valor: formatarNumero(quente && quente.tempMax, 1, '°C'),
            detalhe: quente ? dataCompleta(quente) : '',
        }),
        card({
            titulo: 'Dia mais frio', cor: 'cor-azul-claro',
            valor: formatarNumero(frio && frio.tempMin, 1, '°C'),
            detalhe: frio ? dataCompleta(frio) : '',
        }),
        card({
            titulo: 'Maior sensação térmica', cor: 'cor-ambar',
            valor: formatarNumero(sensacao && sensacao.sensMax, 1, '°C'),
            detalhe: sensacao ? dataCompleta(sensacao) : '',
        }),
        card({
            titulo: 'Dia mais chuvoso', cor: 'cor-anil',
            valor: formatarNumero(chuvoso && chuvoso.chuva, 1, 'mm'),
            detalhe: chuvoso ? dataCompleta(chuvoso) : '',
        }),
        card({
            titulo: 'Mês mais chuvoso', cor: 'cor-azul',
            valor: formatarNumero(mesChuvoso && mesChuvoso.chuva, 1, 'mm'),
            detalhe: mesChuvoso ? `${NOMES_MESES[mesChuvoso.mes]} de ${mesChuvoso.ano}` : '',
        }),
        card({
            titulo: 'Mês mais seco', cor: 'cor-laranja',
            valor: formatarNumero(mesSeco && mesSeco.chuva, 1, 'mm'),
            detalhe: mesSeco ? `${NOMES_MESES[mesSeco.mes]} de ${mesSeco.ano}` : '',
        }),
    );

    const linhas = NOMES_MESES.map((nome, mes) => {
        const doMes = registros.filter(r => r.mes === mes);
        const resumosDoMes = completos.filter(r => r.mes === mes);
        return linhaTabela([
            { texto: nome, classe: 'data' },
            { texto: textoDia(extremo(doMes, 'tempMax', 'max'), 'tempMax', '°C'), classe: 'quente' },
            { texto: textoDia(extremo(doMes, 'tempMin', 'min'), 'tempMin', '°C'), classe: 'frio' },
            textoDia(extremo(doMes, 'chuva', 'max'), 'chuva', 'mm'),
            textoMes(extremo(resumosDoMes, 'chuva', 'max')),
            textoMes(extremo(resumosDoMes, 'chuva', 'min')),
        ]);
    });

    document.getElementById('corpoTabelaRecordes').replaceChildren(...linhas);
}
