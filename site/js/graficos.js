// @ts-check
// Chart.js: espera o carregamento (async) e padrão visual dos gráficos.

/** Configuração no formato do Chart.js 4 (type, data, options). @typedef {{ type: string, data: object, options?: object }} ConfigGrafico */

export const CORES = {
    texto: '#94a3b8',
    grade: '#334155',
    fundo: '#1e293b',
    maxima: '#f97316',
    minima: '#06b6d4',
    chuva: '#3b82f6',
    chuvaApagada: 'rgba(59, 130, 246, 0.35)',
    referencia: '#94a3b8',
};

// O Chart.js carrega com async: cards e tabelas não esperam por ele, só os gráficos.
// O onerror do <script> marca window.chartErro, caso falhe antes deste módulo rodar.
const chartPronto = new Promise((resolve, reject) => {
    if (window.Chart) return resolve(window.Chart);
    if (window.chartErro) return reject(new Error('Chart.js não carregou'));
    const script = document.getElementById('scriptChart');
    script.addEventListener('load', () => resolve(window.Chart));
    script.addEventListener('error', () => reject(new Error('Chart.js não carregou')));
});

/** @type {Map<string, any>} */
const instancias = new Map();

/**
 * Desenha (ou atualiza) o gráfico do canvas. Trocar de mês reaproveita o gráfico existente,
 * o que deixa a transição suave; se o Chart.js não carregar, avisa no lugar do gráfico.
 * @param {string} idCanvas
 * @param {ConfigGrafico} config
 */
export async function desenhar(idCanvas, config) {
    const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById(idCanvas));
    let Chart;
    try {
        Chart = await chartPronto;
    } catch {
        avisarSemGrafico(canvas);
        return;
    }

    const existente = instancias.get(idCanvas);
    if (existente && /** @type {any} */ (existente.config).type === config.type) {
        existente.data = config.data;
        existente.options = config.options ?? {};
        existente.update();
        return;
    }
    existente?.destroy();
    instancias.set(idCanvas, new Chart(canvas, config));
}

/** @param {HTMLCanvasElement} canvas */
function avisarSemGrafico(canvas) {
    const area = canvas.parentElement;
    if (!area || area.querySelector('.sem-grafico')) return;
    const aviso = document.createElement('p');
    aviso.className = 'sem-grafico';
    aviso.textContent = 'Gráfico indisponível no momento. Os números estão na tabela.';
    area.append(aviso);
}

/**
 * Opções comuns dos gráficos das abas Ano e Comparar.
 * @param {string} unidade
 * @param {{ y?: object }} [extra]
 */
export function opcoes(unidade, extra = {}) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        locale: 'pt-BR',
        interaction: { mode: /** @type {const} */ ('index'), intersect: false },
        plugins: {
            legend: { labels: { color: CORES.texto, usePointStyle: true } },
            tooltip: {
                callbacks: {
                    /** @param {any} contexto */
                    label: contexto => {
                        const valor = contexto.parsed.y;
                        if (valor === null) return `${contexto.dataset.label}: sem dado`;
                        const texto = valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
                        return `${contexto.dataset.label}: ${texto} ${unidade}`;
                    },
                },
            },
        },
        scales: {
            x: { ticks: { color: CORES.texto }, grid: { display: false } },
            y: {
                ticks: { color: CORES.texto },
                grid: { color: CORES.grade },
                title: { display: true, text: unidade, color: CORES.texto },
                ...extra.y,
            },
        },
    };
}

// Barras finas com o canto arredondado só na ponta, separadas por um respiro.
export const BARRA = {
    borderRadius: { topLeft: 4, topRight: 4 },
    borderSkipped: /** @type {const} */ ('start'),
    maxBarThickness: 36,
    categoryPercentage: 0.8,
    barPercentage: 0.9,
};

/**
 * Linha tracejada e neutra para a média de referência.
 * @param {string} rotulo
 * @param {(number | null)[]} dados
 */
export function linhaReferencia(rotulo, dados) {
    return {
        type: /** @type {const} */ ('line'),
        label: rotulo,
        data: dados,
        borderColor: CORES.referencia,
        backgroundColor: CORES.referencia,
        borderDash: [6, 4],
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 0,
        pointHitRadius: 10,
        pointStyle: /** @type {const} */ ('line'),
        spanGaps: true,
    };
}
