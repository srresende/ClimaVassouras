// Aba Mês: 10 cards, dois gráficos e a tabela do mês selecionado.

import {
    LIMITES, classificarDia, condicaoDoCodigo, dataCompleta, diaMes,
    extremo, formatarNumero, media, total,
} from './dados.js';

const graficos = { temperatura: null, chuva: null };

function cardExtremo(campo, tipo, unidade) {
    return registros => {
        const registro = extremo(registros, campo, tipo);
        return {
            valor: formatarNumero(registro && registro[campo], 1, unidade),
            detalhe: registro ? `Dia ${diaMes(registro)}` : '',
        };
    };
}

// Ordem = ordem na tela: temperaturas na primeira linha, o resto na segunda.
const CARDS = [
    {
        titulo: 'Mínima do mês', cor: 'cor-azul-claro',
        ajuda: 'Menor temperatura registrada no mês.',
        calcular: cardExtremo('tempMin', 'min', '°C'),
    },
    {
        titulo: 'Máxima do mês', cor: 'cor-rosa',
        ajuda: 'Maior temperatura registrada no mês.',
        calcular: cardExtremo('tempMax', 'max', '°C'),
    },
    {
        titulo: 'Sensação térmica mínima', cor: 'cor-ciano-claro',
        ajuda: 'Como o corpo sentiu o momento mais frio, considerando umidade e vento.',
        calcular: cardExtremo('sensMin', 'min', '°C'),
    },
    {
        titulo: 'Sensação térmica máxima', cor: 'cor-ambar',
        ajuda: 'Como o corpo sentiu o momento mais quente, considerando umidade e vento.',
        calcular: cardExtremo('sensMax', 'max', '°C'),
    },
    {
        titulo: 'Amplitude térmica', cor: 'cor-roxo',
        ajuda: 'Diferença média entre a máxima e a mínima de cada dia.',
        calcular: registros => {
            const amplitudes = registros
                .filter(r => r.tempMin !== null && r.tempMax !== null)
                .map(r => ({ amplitude: r.tempMax - r.tempMin }));
            return { valor: formatarNumero(media(amplitudes, 'amplitude'), 1, '°C') };
        },
    },
    {
        titulo: 'Chuva acumulada', cor: 'cor-azul',
        ajuda: `Soma da chuva no mês. Dia com chuva: ${formatarNumero(LIMITES.diaChuvoso, 0)} mm ou mais.`,
        calcular: registros => {
            const dias = registros.filter(r => r.chuva !== null && r.chuva >= LIMITES.diaChuvoso).length;
            return {
                valor: formatarNumero(total(registros, 'chuva'), 1, 'mm'),
                detalhe: `${dias} dia(s) com chuva`,
            };
        },
    },
    {
        titulo: 'Pico de chuva diária', cor: 'cor-anil',
        ajuda: 'Maior chuva registrada em um único dia.',
        calcular: cardExtremo('chuva', 'max', 'mm'),
    },
    {
        titulo: 'Umidade média', cor: 'cor-verde-agua',
        ajuda: 'Média da umidade relativa do ar no mês.',
        calcular: registros => ({ valor: formatarNumero(media(registros, 'umidade'), 1, '%') }),
    },
    {
        titulo: `Dias quentes (> ${LIMITES.diaQuente}°C)`, cor: 'cor-vermelho',
        ajuda: `Dias com máxima acima de ${LIMITES.diaQuente} °C.`,
        calcular: registros => ({
            valor: `${registros.filter(r => r.tempMax !== null && r.tempMax > LIMITES.diaQuente).length} dia(s)`,
        }),
    },
    {
        titulo: `Dias frios (< ${LIMITES.diaFrio}°C)`, cor: 'cor-celeste',
        ajuda: `Dias com mínima abaixo de ${LIMITES.diaFrio} °C.`,
        calcular: registros => ({
            valor: `${registros.filter(r => r.tempMin !== null && r.tempMin < LIMITES.diaFrio).length} dia(s)`,
        }),
    },
];

const ETIQUETAS = {
    quente: { texto: 'Quente', icone: 'fa-sun' },
    frio: { texto: 'Frio', icone: 'fa-snowflake' },
    agradavel: { texto: 'Agradável', icone: 'fa-face-smile' },
};

export function renderizarMes(registros) {
    renderizarCards(registros);
    renderizarGraficos(registros);
    renderizarTabela(registros);
}

function elemento(tag, classe, texto) {
    const el = document.createElement(tag);
    if (classe) el.className = classe;
    if (texto !== undefined) el.textContent = texto;
    return el;
}

function icone(nome) {
    const el = elemento('i', `fa-solid ${nome}`);
    el.setAttribute('aria-hidden', 'true');
    return el;
}

function renderizarCards(registros) {
    const fragmento = document.createDocumentFragment();

    for (const card of CARDS) {
        const { valor, detalhe } = card.calcular(registros);
        const caixa = elemento('div', `painel card ${card.cor}`);
        caixa.append(elemento('p', 'card-titulo', card.titulo), elemento('p', 'card-valor', valor));
        if (detalhe) caixa.append(elemento('p', 'card-detalhe', detalhe));
        caixa.append(elemento('p', 'card-ajuda', card.ajuda));
        fragmento.append(caixa);
    }

    document.getElementById('cards').replaceChildren(fragmento);
}

function renderizarGraficos(registros) {
    const rotulos = registros.map(diaMes);

    if (graficos.temperatura) graficos.temperatura.destroy();
    if (graficos.chuva) graficos.chuva.destroy();

    graficos.temperatura = new Chart(document.getElementById('graficoTemperatura'), {
        type: 'line',
        data: {
            labels: rotulos,
            datasets: [
                {
                    label: 'Temp. Máxima (°C)',
                    data: registros.map(r => r.tempMax),
                    borderColor: '#f97316',
                    backgroundColor: 'rgba(249, 115, 22, 0.1)',
                    fill: true,
                    tension: 0.3,
                },
                {
                    label: 'Temp. Mínima (°C)',
                    data: registros.map(r => r.tempMin),
                    borderColor: '#06b6d4',
                    backgroundColor: 'rgba(6, 182, 212, 0.1)',
                    fill: true,
                    tension: 0.3,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#94a3b8' } } },
            scales: {
                x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
                y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
            },
        },
    });

    graficos.chuva = new Chart(document.getElementById('graficoChuva'), {
        type: 'bar',
        data: {
            labels: rotulos,
            datasets: [
                {
                    label: 'Chuva (mm)',
                    data: registros.map(r => r.chuva),
                    backgroundColor: '#3b82f6',
                    yAxisID: 'y',
                },
                {
                    label: 'Vento (km/h)',
                    data: registros.map(r => r.vento),
                    type: 'line',
                    borderColor: '#a855f7',
                    borderWidth: 2,
                    pointRadius: 2,
                    yAxisID: 'y1',
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#94a3b8' } } },
            scales: {
                x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
                y: {
                    type: 'linear', position: 'left',
                    ticks: { color: '#94a3b8' }, grid: { color: '#334155' },
                    title: { display: true, text: 'Chuva (mm)', color: '#94a3b8' },
                },
                y1: {
                    type: 'linear', position: 'right',
                    ticks: { color: '#a855f7' }, grid: { drawOnChartArea: false },
                    title: { display: true, text: 'Vento (km/h)', color: '#a855f7' },
                },
            },
        },
    });
}

function renderizarTabela(registros) {
    const fragmento = document.createDocumentFragment();

    for (const registro of registros) {
        const linha = elemento('tr');
        const classe = classificarDia(registro);

        linha.append(elemento('td', 'data', dataCompleta(registro)));

        const condicao = condicaoDoCodigo(registro.condicao);
        const celulaCondicao = elemento('td', 'condicao');
        if (condicao) {
            celulaCondicao.append(icone(condicao.icone), condicao.texto);
        } else {
            celulaCondicao.textContent = '—';
        }
        linha.append(celulaCondicao);

        linha.append(
            elemento('td', registro.tempMin !== null && registro.tempMin < LIMITES.diaFrio ? 'frio' : '',
                formatarNumero(registro.tempMin, 1, '°C')),
            elemento('td', registro.tempMax !== null && registro.tempMax > LIMITES.diaQuente ? 'quente' : '',
                formatarNumero(registro.tempMax, 1, '°C')),
            elemento('td', '', formatarNumero(registro.sensMin, 1, '°C')),
            elemento('td', '', formatarNumero(registro.sensMax, 1, '°C')),
            elemento('td', '', formatarNumero(registro.chuva, 1, 'mm')),
            elemento('td', '', formatarNumero(registro.umidade, 0, '%')),
            elemento('td', '', formatarNumero(registro.vento, 1, 'km/h')),
        );

        const etiqueta = ETIQUETAS[classe];
        const celulaEtiqueta = elemento('td');
        const selo = elemento('span', `etiqueta ${classe}`);
        selo.append(icone(etiqueta.icone), etiqueta.texto);
        celulaEtiqueta.append(selo);
        linha.append(celulaEtiqueta);

        fragmento.append(linha);
    }

    document.getElementById('corpoTabela').replaceChildren(fragmento);
}
