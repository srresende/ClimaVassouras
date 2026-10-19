// Aba Calendário: um ano em grade de dias (uma coluna por semana), colorido por métrica.

import { NOMES_MESES, condicaoDoCodigo, dataCompleta, formatarNumero } from './dados.js';
import { elemento } from './dom.js';

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// Rampas de um tom só, do escuro (menos) ao claro (mais), validadas contra o fundo escuro.
const METRICAS = {
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

export const OPCOES_METRICA = Object.entries(METRICAS).map(([chave, m]) => [chave, m.nome]);

function faixaDe(metrica, valor) {
    return metrica.faixas.find(faixa => valor < faixa.ate);
}

function descrever(registro) {
    const partes = [
        `${DIAS_SEMANA[new Date(registro.ano, registro.mes, registro.dia).getDay()]}, ${dataCompleta(registro)}`,
        `Máx. ${formatarNumero(registro.tempMax, 1, '°C')}`,
        `Mín. ${formatarNumero(registro.tempMin, 1, '°C')}`,
        `Chuva ${formatarNumero(registro.chuva, 1, 'mm')}`,
    ];
    const condicao = condicaoDoCodigo(registro.condicao);
    if (condicao) partes.push(condicao.texto);
    return partes.join(' · ');
}

export function renderizarCalendario(registros, ano, chaveMetrica) {
    const metrica = METRICAS[chaveMetrica] || METRICAS.tempMax;
    const doAno = new Map(registros.filter(r => r.ano === ano).map(r => [`${r.mes}-${r.dia}`, r]));
    const deslocamento = new Date(ano, 0, 1).getDay();
    const diasNoAno = Math.round((new Date(ano + 1, 0, 1) - new Date(ano, 0, 1)) / 864e5);
    const info = document.getElementById('infoCalendario');

    const grade = elemento('div', 'calendario-grade');
    grade.setAttribute('role', 'img');
    grade.setAttribute('aria-label', `${metrica.nome} em cada dia de ${ano}`);

    // Nomes dos dias na primeira coluna (só Seg, Qua e Sex, como no GitHub).
    [1, 3, 5].forEach(diaSemana => {
        const rotulo = elemento('span', 'calendario-dia-semana', DIAS_SEMANA[diaSemana]);
        rotulo.style.gridRow = String(diaSemana + 2);
        grade.append(rotulo);
    });

    for (let i = 0; i < diasNoAno; i++) {
        const data = new Date(ano, 0, 1 + i);
        const coluna = Math.floor((i + deslocamento) / 7) + 2;

        if (data.getDate() === 1) {
            const rotulo = elemento('span', 'calendario-mes', NOMES_MESES[data.getMonth()].slice(0, 3));
            rotulo.style.gridColumn = `${coluna} / span 4`;
            grade.append(rotulo);
        }

        const registro = doAno.get(`${data.getMonth()}-${data.getDate()}`);
        const valor = registro ? registro[metrica.campo] : null;
        const celula = elemento('span', 'calendario-celula');
        celula.style.gridColumn = String(coluna);
        celula.style.gridRow = String(data.getDay() + 2);

        if (valor === null) {
            celula.classList.add('vazia');
        } else {
            celula.style.background = faixaDe(metrica, valor).cor;
            celula.title = descrever(registro);
            celula.dataset.descricao = celula.title;
        }
        grade.append(celula);
    }

    // Passar o mouse ou tocar num dia mostra os valores dele abaixo da grade.
    const mostrar = evento => {
        const descricao = evento.target.dataset && evento.target.dataset.descricao;
        if (descricao) info.textContent = descricao;
    };
    grade.addEventListener('pointerover', mostrar);
    grade.addEventListener('click', mostrar);

    document.getElementById('gradeCalendario').replaceChildren(grade);
    info.textContent = 'Passe o mouse ou toque num dia para ver os valores.';

    const legenda = metrica.faixas.map(faixa => {
        const item = elemento('span', 'legenda-item');
        const amostra = elemento('span', 'legenda-amostra');
        amostra.style.background = faixa.cor;
        item.append(amostra, faixa.rotulo);
        return item;
    });
    const semDado = elemento('span', 'legenda-item');
    semDado.append(elemento('span', 'legenda-amostra vazia'), 'sem dado');
    document.getElementById('legendaCalendario').replaceChildren(...legenda, semDado);
}
