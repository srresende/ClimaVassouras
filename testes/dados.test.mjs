// Testes do site/js/dados.js:  node --test "testes/*.test.mjs"
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    ANOS_REFERENCIA, classificarDia, condicaoDoCodigo, diasNoMes, extremo, formatarNumero,
    formatarVariacao, lerCsv, media, referenciaMensal, resumirMeses, total,
} from '../site/js/dados.js';

const CABECALHO = 'data;temperatura_minima;temperatura_maxima;chuva_mm;umidade_media;'
    + 'vento_maximo_kmh;condicao;sensacao_minima;sensacao_maxima;origem';

// Um mês inteiro com valores previsíveis: mínima = dia, máxima = dia + 10, chuva = 1 mm.
function mesCompleto(ano, mes) {
    const dias = diasNoMes(ano, mes - 1);
    const linhas = [];
    for (let dia = 1; dia <= dias; dia++) {
        const iso = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        linhas.push(`${iso};${dia};${dia + 10};1;80;10;3;${dia};${dia + 12};x`);
    }
    return linhas;
}

test('lê as colunas pelo nome, em qualquer ordem', () => {
    const csv = '﻿chuva_mm;data;temperatura_maxima;temperatura_minima\r\n5,5;2026-01-01;30;20\r\n';
    const [registro] = lerCsv(csv);
    assert.equal(registro.iso, '2026-01-01');
    assert.equal(registro.chuva, 5.5);
    assert.equal(registro.tempMin, 20);
    assert.equal(registro.condicao, null); // coluna ausente
});

test('célula vazia vira null e fica fora das médias e somas', () => {
    const registros = lerCsv(`${CABECALHO}\n2026-01-01;;30;;80;10;3;;;x\n2026-01-02;10;20;4;80;10;3;;;x\n`);
    assert.equal(registros[0].tempMin, null);
    assert.equal(media(registros, 'tempMin'), 10);
    assert.equal(total(registros, 'chuva'), 4);
    assert.equal(media(registros, 'sensMin'), null);
});

test('ignora linhas sem data ISO e ordena por data', () => {
    const registros = lerCsv(`${CABECALHO}\n2026-01-02;1;2;0;1;1;0;1;2;x\nlixo;1;2\n2026-01-01;1;2;0;1;1;0;1;2;x\n`);
    assert.deepEqual(registros.map(r => r.iso), ['2026-01-01', '2026-01-02']);
});

test('recusa CSV sem as colunas obrigatórias', () => {
    assert.throws(() => lerCsv('data;chuva_mm\n2026-01-01;1\n'), /Colunas ausentes/);
});

test('extremo devolve o primeiro em caso de empate e ignora nulos', () => {
    const registros = [{ iso: 'a', v: null }, { iso: 'b', v: 3 }, { iso: 'c', v: 3 }, { iso: 'd', v: 1 }];
    assert.equal(extremo(registros, 'v', 'max').iso, 'b');
    assert.equal(extremo(registros, 'v', 'min').iso, 'd');
    assert.equal(extremo([], 'v', 'max'), null);
});

test('resumo mensal marca mês parcial e conta dias quentes e frios', () => {
    const registros = lerCsv([CABECALHO, ...mesCompleto(2025, 2), ...mesCompleto(2025, 3).slice(0, 10)].join('\n'));
    const [fevereiro, marco] = resumirMeses(registros);

    assert.equal(fevereiro.completo, true);
    assert.equal(fevereiro.dias, 28);
    assert.equal(fevereiro.chuva, 28);
    assert.equal(fevereiro.frios, 13);   // mínima 1 a 13 < 14
    assert.equal(fevereiro.quentes, 10); // máxima 29 a 38 (dias 19 a 28) > 28
    assert.equal(fevereiro.minimo.dia, 1);
    assert.equal(fevereiro.maximo.dia, 28);

    assert.equal(marco.completo, false);
    assert.equal(marco.dias, 10);
});

test('referência usa só meses completos dos anos de referência', () => {
    const linhas = [CABECALHO];
    for (let ano = ANOS_REFERENCIA.inicio; ano <= ANOS_REFERENCIA.fim; ano++) {
        linhas.push(...mesCompleto(ano, 1));
    }
    // Janeiro de um ano fora da referência, com chuva bem maior: não pode entrar.
    linhas.push(...mesCompleto(ANOS_REFERENCIA.fim + 1, 1).map(l => l.replace(/;1;80;/, ';50;80;')));
    // Fevereiro parcial dentro da referência: também não entra.
    linhas.push(...mesCompleto(ANOS_REFERENCIA.inicio, 2).slice(0, 5));

    const referencia = referenciaMensal(resumirMeses(lerCsv(linhas.join('\n'))));
    assert.equal(referencia[0].anos, ANOS_REFERENCIA.fim - ANOS_REFERENCIA.inicio + 1);
    assert.equal(referencia[0].chuva, 31);
    assert.equal(referencia[1].anos, 0);
    assert.equal(referencia[1].chuva, null);
});

test('formatação em português, com traço para dado ausente', () => {
    assert.equal(formatarNumero(19.65, 1, '°C'), '19,7 °C');
    assert.equal(formatarNumero(null, 1, 'mm'), '—');
    assert.equal(formatarVariacao(150, 100), '+50%');
    assert.equal(formatarVariacao(80, 100), '−20%');
    assert.equal(formatarVariacao(100, 100), '0%');
    assert.equal(formatarVariacao(10, null), '—');
    assert.equal(formatarVariacao(10, 0), '—');
});

test('condição do dia e classificação', () => {
    assert.equal(condicaoDoCodigo(63).texto, 'Chuva');
    assert.equal(condicaoDoCodigo(0).texto, 'Ensolarado');
    assert.equal(condicaoDoCodigo(71).texto, 'Outra');
    assert.equal(condicaoDoCodigo(null), null);
    assert.equal(classificarDia({ tempMin: 20, tempMax: 30 }), 'quente');
    assert.equal(classificarDia({ tempMin: 10, tempMax: 30 }), 'quente');
    assert.equal(classificarDia({ tempMin: 10, tempMax: 20 }), 'frio');
    assert.equal(classificarDia({ tempMin: null, tempMax: null }), 'agradavel');
});

test('dias no mês considera ano bissexto', () => {
    assert.equal(diasNoMes(2024, 1), 29);
    assert.equal(diasNoMes(2025, 1), 28);
});
