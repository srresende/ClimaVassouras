from datetime import date, timedelta

import pytest
import requests

import coletar
from coletar import ErroColeta


def resposta_api(inicio, dias, nulos=None):
    """Monta um JSON como o da API; o valor de cada dia depende só da data."""
    nulos = nulos or {}
    dias_pedidos = [inicio + timedelta(days=i) for i in range(dias)]
    datas = [dia.isoformat() for dia in dias_pedidos]
    diario = {"time": datas}
    for n, variavel in enumerate(coletar.VARIAVEIS.values()):
        diario[variavel] = [10.0 + n + dia.day / 10 for dia in dias_pedidos]
    diario["weather_code"] = [3] * dias
    for chave, variaveis in nulos.items():
        for variavel in variaveis:
            diario[variavel][datas.index(chave)] = None
    return {"daily": diario}


class RespostaFalsa:
    def __init__(self, status=200, dados=None):
        self.status_code = status
        self.dados = dados

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"{self.status_code}", response=self)

    def json(self):
        return self.dados


class SessaoFalsa:
    """Responde com o período pedido; pode falhar nas primeiras chamadas."""

    def __init__(self, falhas=(), nulos=None):
        self.falhas = list(falhas)
        self.nulos = nulos
        self.chamadas = []

    def get(self, url, params, timeout):
        self.chamadas.append(params)
        if self.falhas:
            falha = self.falhas.pop(0)
            if isinstance(falha, Exception):
                raise falha
            return RespostaFalsa(falha)
        inicio = date.fromisoformat(params["start_date"])
        fim = date.fromisoformat(params["end_date"])
        return RespostaFalsa(200, resposta_api(inicio, (fim - inicio).days + 1, self.nulos))


@pytest.fixture
def config(tmp_path):
    caminho = tmp_path / "config.toml"
    caminho.write_text(
        "[local]\n"
        'nome = "Teste"\n'
        "latitude = -22.405\n"
        "longitude = -43.663\n"
        'fuso_horario = "America/Sao_Paulo"\n'
        "[coleta]\n"
        'arquivo_csv = "dados/clima.csv"\n'
        'inicio_historico = "2026-10-01"\n'
        "dias_revisao = 7\n",
        encoding="utf-8",
    )
    return caminho


def csv_do(config):
    return config.parent / "dados" / "clima.csv"


# --- formato ---------------------------------------------------------------


@pytest.mark.parametrize(
    "valor, esperado",
    [(20.0, "20"), (19.6, "19,6"), ("11,10", "11,1"), (0.0, "0"), (-0.0, "0"),
     (-1.25, "-1,25"), (63, "63"), ("", ""), (None, "")],
)
def test_formatar_numero(valor, esperado):
    assert coletar.formatar_numero(valor) == esperado


def test_le_csv_antigo_com_datas_brasileiras(tmp_path):
    arquivo = tmp_path / "antigo.csv"
    arquivo.write_text(
        "﻿data;temperatura_minima;temperatura_maxima;chuva_mm;umidade_media;"
        "vento_maximo_kmh;origem\r\n"
        "01/04/2026;19,6;26,8;11,1;90;20,6;Open-Meteo Archive\r\n",
        encoding="utf-8",
    )
    registros = coletar.ler_csv(arquivo)
    assert registros["2026-04-01"]["temperatura_minima"] == "19,6"
    assert registros["2026-04-01"]["condicao"] == ""


def test_le_csv_recusa_data_repetida(tmp_path):
    arquivo = tmp_path / "repetido.csv"
    linha = "2026-04-01;19,6;26,8;11,1;90;20,6;x\n"
    arquivo.write_text(
        "data;temperatura_minima;temperatura_maxima;chuva_mm;umidade_media;"
        "vento_maximo_kmh;origem\n" + linha + linha,
        encoding="utf-8",
    )
    with pytest.raises(ErroColeta, match="repetida"):
        coletar.ler_csv(arquivo)


def test_gravar_e_ler_mantem_os_dados(tmp_path):
    registros, _ = coletar.converter_resposta(resposta_api(date(2026, 10, 1), 3))
    arquivo = tmp_path / "clima.csv"
    coletar.gravar_csv(arquivo, registros)
    assert coletar.ler_csv(arquivo) == registros
    assert not arquivo.with_suffix(".tmp").exists()


def test_le_csv_recusa_numero_invalido_com_mensagem_clara(tmp_path):
    arquivo = tmp_path / "invalido.csv"
    arquivo.write_text(
        "data;temperatura_minima;temperatura_maxima;chuva_mm;umidade_media;"
        "vento_maximo_kmh;origem\n2026-04-01;abc;26,8;11,1;90;20,6;x\n",
        encoding="utf-8",
    )
    with pytest.raises(ErroColeta, match="2026-04-01.*temperatura_minima"):
        coletar.ler_csv(arquivo)


# --- configuração ----------------------------------------------------------

CONFIG_VALIDA = {
    "latitude": "-22.405",
    "longitude": "-43.663",
    "fuso_horario": '"America/Sao_Paulo"',
    "inicio_historico": '"2026-10-01"',
    "dias_revisao": "7",
}


def escrever_config(tmp_path, **trocas):
    valores = {**CONFIG_VALIDA, **trocas}
    linhas = ["[local]"]
    linhas += [f"{k} = {valores[k]}" for k in ("latitude", "longitude", "fuso_horario") if valores[k] is not None]
    linhas += ["[coleta]", 'arquivo_csv = "dados/clima.csv"']
    linhas += [f"{k} = {valores[k]}" for k in ("inicio_historico", "dias_revisao") if valores[k] is not None]
    caminho = tmp_path / "config.toml"
    caminho.write_text("\n".join(linhas) + "\n", encoding="utf-8")
    return caminho


def test_config_valida(tmp_path):
    config = coletar.carregar_config(escrever_config(tmp_path))
    assert config.dias_revisao == 7
    assert config.inicio_historico == date(2026, 10, 1)
    assert config.arquivo_csv == (tmp_path / "dados" / "clima.csv").resolve()


@pytest.mark.parametrize(
    "trocas, mensagem",
    [
        ({"dias_revisao": None}, "sem a chave"),
        ({"dias_revisao": "0"}, "dias_revisao"),
        ({"inicio_historico": '"01/10/2026"'}, "valor inválido"),
        ({"fuso_horario": '"Lugar/Inexistente"'}, "valor inválido"),
        ({"latitude": "-122.4"}, "fora do intervalo"),
    ],
)
def test_config_invalida_vira_erro_de_coleta(tmp_path, trocas, mensagem):
    with pytest.raises(ErroColeta, match=mensagem):
        coletar.carregar_config(escrever_config(tmp_path, **trocas))


def test_config_toml_malformado(tmp_path):
    caminho = tmp_path / "config.toml"
    caminho.write_text("[local\nlatitude = ", encoding="utf-8")
    with pytest.raises(ErroColeta, match="config.toml inválido"):
        coletar.carregar_config(caminho)


# --- período ---------------------------------------------------------------


def test_periodo_csv_vazio_comeca_no_inicio_do_historico():
    de, ate = coletar.periodo_rotina({}, date(2026, 10, 18), 7, date(2020, 1, 1))
    assert (de, ate) == (date(2020, 1, 1), date(2026, 10, 18))


def test_periodo_em_dia_rebusca_os_ultimos_dias():
    registros = {"2026-10-17": {}}
    de, ate = coletar.periodo_rotina(registros, date(2026, 10, 18), 7, date(2020, 1, 1))
    assert (de, ate) == (date(2026, 10, 12), date(2026, 10, 18))


def test_periodo_recupera_dias_perdidos():
    registros = {"2026-10-01": {}}
    de, _ = coletar.periodo_rotina(registros, date(2026, 10, 18), 7, date(2020, 1, 1))
    assert de == date(2026, 10, 2)


# --- resposta da API -------------------------------------------------------


def test_dias_finais_incompletos_ficam_pendentes():
    dados = resposta_api(date(2026, 10, 16), 3, nulos={"2026-10-18": ["weather_code"]})
    registros, pendentes = coletar.converter_resposta(dados)
    assert sorted(registros) == ["2026-10-16", "2026-10-17"]
    assert pendentes == ["2026-10-18"]


def test_dia_incompleto_no_meio_e_erro():
    dados = resposta_api(date(2026, 10, 16), 3, nulos={"2026-10-17": ["precipitation_sum"]})
    with pytest.raises(ErroColeta, match="2026-10-17"):
        coletar.converter_resposta(dados)


def test_variavel_ausente_e_erro():
    dados = resposta_api(date(2026, 10, 16), 2)
    del dados["daily"]["apparent_temperature_max"]
    with pytest.raises(ErroColeta, match="apparent_temperature_max"):
        coletar.converter_resposta(dados)


# --- validação e mesclagem -------------------------------------------------


def test_validar_recusa_minima_maior_que_maxima():
    registros, _ = coletar.converter_resposta(resposta_api(date(2026, 10, 1), 1))
    registros["2026-10-01"]["temperatura_minima"] = "40"
    with pytest.raises(ErroColeta, match="Mínima"):
        coletar.validar(registros)


def test_validar_recusa_buraco():
    registros, _ = coletar.converter_resposta(resposta_api(date(2026, 10, 1), 3))
    del registros["2026-10-02"]
    with pytest.raises(ErroColeta, match="faltando"):
        coletar.validar(registros)


def test_mesclar_conta_novos_e_alterados():
    antigos, _ = coletar.converter_resposta(resposta_api(date(2026, 10, 1), 2))
    novos, _ = coletar.converter_resposta(resposta_api(date(2026, 10, 2), 2))
    novos["2026-10-02"]["chuva_mm"] = "99"
    registros, incluidos, alterados = coletar.mesclar(antigos, novos)
    assert (len(registros), incluidos, alterados) == (3, 1, 1)


# --- tentativas ------------------------------------------------------------


def test_tenta_de_novo_em_erro_503():
    sessao = SessaoFalsa(falhas=[503, requests.ConnectionError("rede")])
    esperas = []
    params = {"start_date": "2026-10-01", "end_date": "2026-10-01"}
    dados = coletar.requisitar(sessao, params, esperar=esperas.append)
    assert dados["daily"]["time"] == ["2026-10-01"]
    assert esperas == [5, 15]


def test_desiste_depois_das_tentativas():
    sessao = SessaoFalsa(falhas=[503, 503, 503, 503])
    with pytest.raises(ErroColeta, match="4 tentativas"):
        coletar.requisitar(sessao, {}, esperar=lambda s: None)


def test_erro_400_nao_tenta_de_novo():
    sessao = SessaoFalsa(falhas=[400])
    with pytest.raises(requests.HTTPError):
        coletar.requisitar(sessao, {}, esperar=lambda s: None)
    assert len(sessao.chamadas) == 1


# --- execução completa -----------------------------------------------------


def test_primeira_execucao_cria_o_historico(config):
    sessao = SessaoFalsa()
    coletar.executar(["--config", str(config)], sessao, hoje=date(2026, 10, 19))
    registros = coletar.ler_csv(csv_do(config))
    assert (min(registros), max(registros)) == ("2026-10-01", "2026-10-18")


def test_rodar_duas_vezes_nao_muda_o_csv(config):
    hoje = date(2026, 10, 19)
    coletar.executar(["--config", str(config)], SessaoFalsa(), hoje=hoje)
    primeira = csv_do(config).read_bytes()
    coletar.executar(["--config", str(config)], SessaoFalsa(), hoje=hoje)
    assert csv_do(config).read_bytes() == primeira


def test_rotina_recupera_dias_perdidos(config):
    coletar.executar(["--config", str(config)], SessaoFalsa(), hoje=date(2026, 10, 10))
    sessao = SessaoFalsa()
    coletar.executar(["--config", str(config)], sessao, hoje=date(2026, 10, 19))
    # Último registro em 09/10: começa no dia seguinte, antes da janela de revisão.
    assert sessao.chamadas[0]["start_date"] == "2026-10-10"
    assert max(coletar.ler_csv(csv_do(config))) == "2026-10-18"


def test_ate_nunca_passa_de_ontem(config):
    sessao = SessaoFalsa()
    coletar.executar(
        ["--config", str(config), "--de", "2026-10-01", "--ate", "2026-12-31"],
        sessao,
        hoje=date(2026, 10, 19),
    )
    assert sessao.chamadas[0]["end_date"] == "2026-10-18"
