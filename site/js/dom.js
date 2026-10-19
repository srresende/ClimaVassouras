// @ts-check
// Montagem de elementos, sempre com textContent (nunca HTML vindo de dados).

/**
 * @param {string} tag
 * @param {string} [classe]
 * @param {string} [texto]
 * @returns {HTMLElement}
 */
export function elemento(tag, classe, texto) {
    const el = document.createElement(tag);
    if (classe) el.className = classe;
    if (texto !== undefined) el.textContent = texto;
    return el;
}

const SVG = 'http://www.w3.org/2000/svg';

/**
 * Ícone do sprite img/icones.svg (nome sem prefixo, ex.: 'sun').
 * @param {string} nome
 * @returns {SVGSVGElement}
 */
export function icone(nome) {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('class', 'icone');
    svg.setAttribute('aria-hidden', 'true');
    const uso = document.createElementNS(SVG, 'use');
    uso.setAttribute('href', `img/icones.svg#${nome}`);
    svg.append(uso);
    return svg;
}

/**
 * @param {{ titulo: string, cor: string, valor: string, detalhe?: string, ajuda?: string }} dados
 * @returns {HTMLElement}
 */
export function card({ titulo, cor, valor, detalhe, ajuda }) {
    const caixa = elemento('div', `painel card ${cor}`);
    caixa.append(elemento('p', 'card-titulo', titulo), elemento('p', 'card-valor', valor));
    if (detalhe) caixa.append(elemento('p', 'card-detalhe', detalhe));
    if (ajuda) caixa.append(elemento('p', 'card-ajuda', ajuda));
    return caixa;
}

/**
 * Uma linha de tabela; cada célula é um texto ou { texto, classe }.
 * @param {(string | { texto: string, classe?: string })[]} celulas
 * @param {string} [classe]
 * @returns {HTMLTableRowElement}
 */
export function linhaTabela(celulas, classe) {
    const linha = /** @type {HTMLTableRowElement} */ (elemento('tr', classe));
    for (const celula of celulas) {
        /** @type {{ texto: string, classe?: string }} */
        const dados = typeof celula === 'object' ? celula : { texto: celula };
        linha.append(elemento('td', dados.classe, dados.texto));
    }
    return linha;
}
