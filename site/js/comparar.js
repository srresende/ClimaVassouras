// Aba Comparar: o mês escolhido em cada ano desde 2020.

import {
    NOMES_MESES, NOME_REFERENCIA, diaMes, diasNoMes, formatarNumero, formatarVariacao,
} from './dados.js';
import { linhaTabela } from './dom.js';
import { BARRA, CORES, desenhar, linhaReferencia, opcoes } from './graficos.js';

export function renderizarComparar(mes, anoDestaque, resumos, referencia) {
    const doMes = resumos.filter(r => r.mes === mes);
    const ref = referencia[mes];
    const anos = doMes.map(r => String(r.ano));

    const parcial = doMes.find(r => !r.completo);
    const aviso = document.getElementById('avisoComparar');
    aviso.textContent = parcial
        ? `${NOMES_MESES[mes]} de ${parcial.ano} é parcial: ${parcial.dias} de ${diasNoMes(parcial.ano, mes)} dias.`
        : '';
    aviso.classList.toggle('oculto', !parcial);

    document.getElementById('tituloComparar').textContent = `${NOMES_MESES[mes]} em cada ano`;

    desenhar('graficoCompararChuva', {
        type: 'bar',
        data: {
            labels: anos,
            datasets: [
                {
                    label: `Chuva em ${NOMES_MESES[mes].toLowerCase()}`,
                    data: doMes.map(r => r.chuva),
                    // O ano escolhido no filtro fica em destaque; os outros, apagados.
                    backgroundColor: doMes.map(r => (r.ano === anoDestaque ? CORES.chuva : CORES.chuvaApagada)),
                    ...BARRA,
                },
                linhaReferencia(NOME_REFERENCIA, doMes.map(() => ref.chuva)),
            ],
        },
        options: opcoes('mm'),
    });

    desenhar('graficoCompararTemperatura', {
        type: 'line',
        data: {
            labels: anos,
            datasets: [
                {
                    label: 'Máxima do mês',
                    data: doMes.map(r => (r.maximo ? r.maximo.tempMax : null)),
                    borderColor: CORES.maxima,
                    backgroundColor: CORES.maxima,
                    borderWidth: 2,
                    pointRadius: doMes.map(r => (r.ano === anoDestaque ? 7 : 4)),
                },
                {
                    label: 'Mínima do mês',
                    data: doMes.map(r => (r.minimo ? r.minimo.tempMin : null)),
                    borderColor: CORES.minima,
                    backgroundColor: CORES.minima,
                    borderWidth: 2,
                    pointRadius: doMes.map(r => (r.ano === anoDestaque ? 7 : 4)),
                },
            ],
        },
        options: opcoes('°C'),
    });

    const linhas = doMes.map(r => linhaTabela([
        { texto: r.completo ? String(r.ano) : `${r.ano} (parcial)`, classe: 'data' },
        formatarNumero(r.chuva, 1, 'mm'),
        r.completo ? formatarVariacao(r.chuva, ref.chuva) : '—',
        r.minimo ? `${formatarNumero(r.minimo.tempMin, 1, '°C')} · ${diaMes(r.minimo)}` : '—',
        r.maximo ? `${formatarNumero(r.maximo.tempMax, 1, '°C')} · ${diaMes(r.maximo)}` : '—',
        String(r.quentes),
        String(r.frios),
    ], r.ano === anoDestaque ? 'destaque' : ''));

    document.getElementById('corpoTabelaComparar').replaceChildren(...linhas);
}
