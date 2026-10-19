// Padrão visual dos gráficos das abas Ano e Comparar (Chart.js).

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

const instancias = new Map();

// Cria o gráfico no canvas, destruindo o anterior do mesmo canvas.
export function desenhar(idCanvas, config) {
    instancias.get(idCanvas)?.destroy();
    const grafico = new Chart(document.getElementById(idCanvas), config);
    instancias.set(idCanvas, grafico);
    return grafico;
}

export function opcoes(unidade, extra = {}) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        locale: 'pt-BR',
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { labels: { color: CORES.texto, usePointStyle: true } },
            tooltip: {
                callbacks: {
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
    borderSkipped: 'start',
    maxBarThickness: 36,
    categoryPercentage: 0.8,
    barPercentage: 0.9,
};

// Linha tracejada e neutra para a média de referência.
export function linhaReferencia(rotulo, dados) {
    return {
        type: 'line',
        label: rotulo,
        data: dados,
        borderColor: CORES.referencia,
        backgroundColor: CORES.referencia,
        borderDash: [6, 4],
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 0,
        pointHitRadius: 10,
        pointStyle: 'line',
        spanGaps: true,
    };
}
