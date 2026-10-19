// @ts-check
// Aba Ano: os 12 meses do ano escolhido contra a média de referência.

import {
    NOMES_MESES, NOME_REFERENCIA, dataCompleta, formatarNumero, formatarVariacao, total,
} from './dados.js';
import { card, linhaTabela } from './dom.js';
import { BARRA, CORES, desenhar, linhaReferencia, opcoes } from './graficos.js';

const SIGLAS = NOMES_MESES.map(nome => nome.slice(0, 3));

export function renderizarAno(ano, resumos, referencia) {
    // Um item por mês do calendário; null onde o ano ainda não tem dados.
    const meses = NOMES_MESES.map((_, mes) => resumos.find(r => r.ano === ano && r.mes === mes) || null);

    renderizarCards(ano, meses, referencia);
    renderizarGraficos(meses, referencia);
    renderizarTabela(meses, referencia);
}

function renderizarCards(ano, meses, referencia) {
    const comDados = meses.filter(Boolean);
    const completos = comDados.filter(m => m.completo);

    // A comparação de chuva usa só meses completos, para não comparar mês pela metade.
    const chuvaCompletos = total(completos, 'chuva');
    const referenciaCompletos = total(completos.map(m => referencia[m.mes]), 'chuva');

    const maisChuvoso = completos.reduce((a, b) => (a === null || b.chuva > a.chuva ? b : a), null);
    const minimo = comDados.map(m => m.minimo).filter(Boolean)
        .reduce((a, b) => (a === null || b.tempMin < a.tempMin ? b : a), null);
    const maximo = comDados.map(m => m.maximo).filter(Boolean)
        .reduce((a, b) => (a === null || b.tempMax > a.tempMax ? b : a), null);

    document.getElementById('cardsAno').replaceChildren(
        card({
            titulo: `Chuva em ${ano}`, cor: 'cor-azul',
            valor: formatarNumero(total(comDados, 'chuva'), 1, 'mm'),
            detalhe: completos.length
                ? `${formatarVariacao(chuvaCompletos, referenciaCompletos)} vs. ${NOME_REFERENCIA} (${completos.length} meses completos)`
                : 'Nenhum mês completo ainda',
            ajuda: 'Soma da chuva no ano; a comparação considera só os meses completos.',
        }),
        card({
            titulo: 'Mês mais chuvoso', cor: 'cor-anil',
            valor: maisChuvoso ? NOMES_MESES[maisChuvoso.mes] : '—',
            detalhe: maisChuvoso ? formatarNumero(maisChuvoso.chuva, 1, 'mm') : '',
            ajuda: 'Entre os meses completos do ano.',
        }),
        card({
            titulo: 'Mínima do ano', cor: 'cor-azul-claro',
            valor: formatarNumero(minimo && minimo.tempMin, 1, '°C'),
            detalhe: minimo ? `Dia ${dataCompleta(minimo)}` : '',
            ajuda: 'Menor temperatura registrada no ano.',
        }),
        card({
            titulo: 'Máxima do ano', cor: 'cor-rosa',
            valor: formatarNumero(maximo && maximo.tempMax, 1, '°C'),
            detalhe: maximo ? `Dia ${dataCompleta(maximo)}` : '',
            ajuda: 'Maior temperatura registrada no ano.',
        }),
    );
}

function renderizarGraficos(meses, referencia) {
    desenhar('graficoAnoChuva', {
        type: 'bar',
        data: {
            labels: SIGLAS,
            datasets: [
                {
                    label: 'Chuva no mês',
                    data: meses.map(m => (m ? m.chuva : null)),
                    // Mês parcial em tom apagado: o total ainda vai crescer.
                    backgroundColor: meses.map(m => (m && !m.completo ? CORES.chuvaApagada : CORES.chuva)),
                    ...BARRA,
                },
                linhaReferencia(NOME_REFERENCIA, referencia.map(r => r.chuva)),
            ],
        },
        options: opcoes('mm'),
    });

    desenhar('graficoAnoTemperatura', {
        type: 'line',
        data: {
            labels: SIGLAS,
            datasets: [
                {
                    label: 'Máxima média',
                    data: meses.map(m => (m ? m.tempMaxMedia : null)),
                    borderColor: CORES.maxima,
                    backgroundColor: CORES.maxima,
                    borderWidth: 2,
                    pointRadius: 4,
                    tension: 0.3,
                },
                {
                    label: 'Mínima média',
                    data: meses.map(m => (m ? m.tempMinMedia : null)),
                    borderColor: CORES.minima,
                    backgroundColor: CORES.minima,
                    borderWidth: 2,
                    pointRadius: 4,
                    tension: 0.3,
                },
                linhaReferencia(`Máxima (${NOME_REFERENCIA})`, referencia.map(r => r.tempMaxMedia)),
                linhaReferencia(`Mínima (${NOME_REFERENCIA})`, referencia.map(r => r.tempMinMedia)),
            ],
        },
        options: opcoes('°C'),
    });
}

function renderizarTabela(meses, referencia) {
    const linhas = [];

    meses.forEach((resumo, mes) => {
        if (!resumo) return;
        const ref = referencia[mes];
        const nome = resumo.completo
            ? NOMES_MESES[mes]
            : `${NOMES_MESES[mes]} (parcial: ${resumo.dias} dias)`;

        linhas.push(linhaTabela([
            { texto: nome, classe: 'data' },
            formatarNumero(resumo.chuva, 1, 'mm'),
            formatarNumero(ref.chuva, 1, 'mm'),
            resumo.completo ? formatarVariacao(resumo.chuva, ref.chuva) : '—',
            formatarNumero(resumo.tempMinMedia, 1, '°C'),
            formatarNumero(resumo.tempMaxMedia, 1, '°C'),
            String(resumo.quentes),
            String(resumo.frios),
        ]));
    });

    document.getElementById('corpoTabelaAno').replaceChildren(...linhas);
}
