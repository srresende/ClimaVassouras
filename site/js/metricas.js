// @ts-check
// Métricas do Calendário. Separadas para o filtro montar o seletor sem carregar calendario.js.

/**
 * @typedef {{ ate: number, rotulo: string, cor: string }} Faixa
 * @typedef {{ nome: string, campo: 'tempMax' | 'chuva', faixas: Faixa[] }} Metrica
 */

// Rampas de um tom só, do escuro (menos) ao claro (mais), validadas contra o fundo escuro.
/** @type {Record<string, Metrica>} */
export const METRICAS = {
    tempMax: {
        nome: 'Temperatura máxima',
        campo: 'tempMax',
        faixas: [
            { ate: 20, rotulo: 'abaixo de 20 °C', cor: '#c2410c' },
            { ate: 24, rotulo: '20 a 24 °C', cor: '#ea580c' },
            { ate: 28, rotulo: '24 a 28 °C', cor: '#fb923c' },
            { ate: 32, rotulo: '28 a 32 °C', cor: '#fdba74' },
            { ate: Infinity, rotulo: '32 °C ou mais', cor: '#ffedd5' },
        ],
    },
    chuva: {
        nome: 'Chuva',
        campo: 'chuva',
        faixas: [
            { ate: 1, rotulo: 'sem chuva (menos de 1 mm)', cor: '#334155' },
            { ate: 5, rotulo: '1 a 5 mm', cor: '#1d4ed8' },
            { ate: 10, rotulo: '5 a 10 mm', cor: '#3b82f6' },
            { ate: 20, rotulo: '10 a 20 mm', cor: '#60a5fa' },
            { ate: 40, rotulo: '20 a 40 mm', cor: '#93c5fd' },
            { ate: Infinity, rotulo: '40 mm ou mais', cor: '#dbeafe' },
        ],
    },
};

/** Pares [chave, nome] para o seletor de métrica. */
export const OPCOES_METRICA = Object.entries(METRICAS).map(([chave, metrica]) => [chave, metrica.nome]);
