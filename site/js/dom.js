// Montagem de elementos, sempre com textContent (nunca HTML vindo de dados).

export function elemento(tag, classe, texto) {
    const el = document.createElement(tag);
    if (classe) el.className = classe;
    if (texto !== undefined) el.textContent = texto;
    return el;
}

export function icone(nome) {
    const el = elemento('i', `fa-solid ${nome}`);
    el.setAttribute('aria-hidden', 'true');
    return el;
}

export function card({ titulo, cor, valor, detalhe, ajuda }) {
    const caixa = elemento('div', `painel card ${cor}`);
    caixa.append(elemento('p', 'card-titulo', titulo), elemento('p', 'card-valor', valor));
    if (detalhe) caixa.append(elemento('p', 'card-detalhe', detalhe));
    if (ajuda) caixa.append(elemento('p', 'card-ajuda', ajuda));
    return caixa;
}

// Uma linha de tabela; cada célula é um texto ou { texto, classe }.
export function linhaTabela(celulas, classe) {
    const linha = elemento('tr', classe);
    for (const celula of celulas) {
        const dados = typeof celula === 'object' ? celula : { texto: celula };
        linha.append(elemento('td', dados.classe, dados.texto));
    }
    return linha;
}
