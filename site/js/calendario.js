// @ts-check
// Aba Calendário: um ano em grade de dias (uma coluna por semana), colorido por métrica.

import { NOMES_MESES, condicaoDoCodigo, dataCompleta, formatarNumero } from './dados.js';
import { elemento } from './dom.js';
import { METRICAS } from './metricas.js';

/** @typedef {import('./dados.js').Registro} Registro */

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DIAS_SEMANA_EXTENSO = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

// Na grade, linhas são dias da semana e colunas são semanas: ↑↓ andam 1 dia, ←→ andam 7.
/** @type {Record<string, number>} */
const PASSOS = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 };

/** @param {import('./metricas.js').Metrica} metrica @param {number} valor */
function faixaDe(metrica, valor) {
    return metrica.faixas.find(faixa => valor < faixa.ate);
}

/** @param {Registro} registro */
function descrever(registro) {
    const partes = [
        `${DIAS_SEMANA_EXTENSO[new Date(registro.ano, registro.mes, registro.dia).getDay()]}, ${dataCompleta(registro)}`,
        `máx. ${formatarNumero(registro.tempMax, 1, '°C')}`,
        `mín. ${formatarNumero(registro.tempMin, 1, '°C')}`,
        `chuva ${formatarNumero(registro.chuva, 1, 'mm')}`,
    ];
    const condicao = condicaoDoCodigo(registro.condicao);
    if (condicao) partes.push(condicao.texto.toLowerCase());
    return partes.join(' · ');
}

/**
 * @param {Registro[]} registros
 * @param {number} ano
 * @param {string} chaveMetrica
 */
export function renderizarCalendario(registros, ano, chaveMetrica) {
    const metrica = METRICAS[chaveMetrica] || METRICAS.tempMax;
    const doAno = new Map(registros.filter(r => r.ano === ano).map(r => [`${r.mes}-${r.dia}`, r]));
    const deslocamento = new Date(ano, 0, 1).getDay();
    const diasNoAno = Math.round((new Date(ano + 1, 0, 1).getTime() - new Date(ano, 0, 1).getTime()) / 864e5);
    const info = /** @type {HTMLElement} */ (document.getElementById('infoCalendario'));

    const grade = elemento('div', 'calendario-grade');
    grade.setAttribute('role', 'group');
    grade.setAttribute('aria-label', `${metrica.nome} em cada dia de ${ano}. Use as setas para andar entre os dias.`);

    // Nomes dos dias na primeira coluna (só Seg, Qua e Sex, como no GitHub).
    [1, 3, 5].forEach(diaSemana => {
        const rotulo = elemento('span', 'calendario-dia-semana', DIAS_SEMANA[diaSemana]);
        rotulo.setAttribute('aria-hidden', 'true');
        rotulo.style.gridRow = String(diaSemana + 2);
        grade.append(rotulo);
    });

    /** @type {HTMLElement[]} */
    const celulas = [];
    let ultimoComDado = 0;

    for (let i = 0; i < diasNoAno; i++) {
        const data = new Date(ano, 0, 1 + i);
        const coluna = Math.floor((i + deslocamento) / 7) + 2;

        if (data.getDate() === 1) {
            const rotulo = elemento('span', 'calendario-mes', NOMES_MESES[data.getMonth()].slice(0, 3));
            rotulo.setAttribute('aria-hidden', 'true');
            rotulo.style.gridColumn = `${coluna} / span 4`;
            grade.append(rotulo);
        }

        const registro = doAno.get(`${data.getMonth()}-${data.getDate()}`);
        const valor = registro ? registro[metrica.campo] : null;
        const celula = elemento('span', 'calendario-celula');
        celula.style.gridColumn = String(coluna);
        celula.style.gridRow = String(data.getDay() + 2);
        celula.setAttribute('role', 'img');
        celula.tabIndex = -1;

        let descricao;
        if (registro && valor !== null) {
            celula.style.background = faixaDe(metrica, valor).cor;
            descricao = descrever(registro);
            ultimoComDado = i;
        } else {
            celula.classList.add('vazia');
            descricao = `${String(data.getDate()).padStart(2, '0')}/${String(data.getMonth() + 1).padStart(2, '0')}/${ano}: sem dado`;
        }
        celula.title = descricao;
        celula.setAttribute('aria-label', descricao);
        celula.dataset.indice = String(i);
        celulas.push(celula);
        grade.append(celula);
    }

    // Foco móvel: só um dia recebe Tab; as setas movem o foco entre os dias.
    let atual = ultimoComDado;
    celulas[atual].tabIndex = 0;

    /** @param {number} indice */
    const focar = indice => {
        celulas[atual].tabIndex = -1;
        atual = Math.max(0, Math.min(celulas.length - 1, indice));
        celulas[atual].tabIndex = 0;
        celulas[atual].focus();
        info.textContent = celulas[atual].title;
    };

    grade.addEventListener('keydown', evento => {
        let destino;
        if (Object.hasOwn(PASSOS, evento.key)) destino = atual + PASSOS[evento.key];
        else if (evento.key === 'Home') destino = 0;
        else if (evento.key === 'End') destino = celulas.length - 1;
        else return;
        evento.preventDefault();
        focar(destino);
    });

    // Mouse e toque só mostram os valores; não mexem no foco do teclado.
    /** @param {Event} evento */
    const mostrar = evento => {
        const alvo = /** @type {HTMLElement} */ (evento.target);
        if (alvo.dataset && alvo.dataset.indice) info.textContent = alvo.title;
    };
    grade.addEventListener('pointerover', mostrar);
    grade.addEventListener('click', mostrar);

    /** @type {HTMLElement} */ (document.getElementById('gradeCalendario')).replaceChildren(grade);
    info.textContent = 'Passe o mouse, toque num dia ou use as setas do teclado para ver os valores.';

    const legenda = metrica.faixas.map(faixa => {
        const item = elemento('span', 'legenda-item');
        const amostra = elemento('span', 'legenda-amostra');
        amostra.style.background = faixa.cor;
        item.append(amostra, faixa.rotulo);
        return item;
    });
    const semDado = elemento('span', 'legenda-item');
    semDado.append(elemento('span', 'legenda-amostra vazia'), 'sem dado');
    /** @type {HTMLElement} */ (document.getElementById('legendaCalendario')).replaceChildren(...legenda, semDado);
}
