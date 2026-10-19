"""Coleta diária do clima de Vassouras (Open-Meteo Archive) para o CSV.

Sem parâmetros, faz a rotina diária: busca os dias que faltam até ontem e
rebusca os últimos dias para pegar revisões da API. Rodar duas vezes seguidas
deixa o CSV igual.

    python coleta/coletar.py
    python coleta/coletar.py --de 2020-01-01
    python coleta/coletar.py --de 2026-10-01 --ate 2026-10-15
"""

import argparse
import csv
import sys
import time
import tomllib
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import requests

PASTA = Path(__file__).resolve().parent
CONFIG = PASTA / "config.toml"

URL_ARCHIVE = "https://archive-api.open-meteo.com/v1/archive"
ORIGEM = "Open-Meteo Archive"

# Coluna do CSV -> variável diária da API, na ordem das colunas.
VARIAVEIS = {
    "temperatura_minima": "temperature_2m_min",
    "temperatura_maxima": "temperature_2m_max",
    "chuva_mm": "precipitation_sum",
    "umidade_media": "relative_humidity_2m_mean",
    "vento_maximo_kmh": "wind_speed_10m_max",
    "condicao": "weather_code",
    "sensacao_minima": "apparent_temperature_min",
    "sensacao_maxima": "apparent_temperature_max",
}

CABECALHO = ["data", *VARIAVEIS, "origem"]

# Colunas que todo CSV precisa ter; as demais podem faltar em arquivos antigos.
OBRIGATORIAS = [
    "data",
    "temperatura_minima",
    "temperatura_maxima",
    "chuva_mm",
    "umidade_media",
    "vento_maximo_kmh",
]

# Espera antes de cada nova tentativa, em segundos.
ESPERAS = (5, 15, 45)

# Um dia do CSV: coluna -> texto já formatado ("19,6"). Os registros são indexados pela data ISO.
Registro = dict[str, str]
Registros = dict[str, Registro]
Esperar = Callable[[float], None]


class ErroColeta(Exception):
    pass


@dataclass(frozen=True)
class Config:
    latitude: float
    longitude: float
    fuso_horario: str
    arquivo_csv: Path
    inicio_historico: date
    dias_revisao: int


def carregar_config(caminho: Path = CONFIG) -> Config:
    try:
        with open(caminho, "rb") as arquivo:
            bruto = tomllib.load(arquivo)
    except tomllib.TOMLDecodeError as erro:
        raise ErroColeta(f"config.toml inválido: {erro}") from erro

    try:
        local, coleta = bruto["local"], bruto["coleta"]
        config = Config(
            latitude=float(local["latitude"]),
            longitude=float(local["longitude"]),
            fuso_horario=str(local["fuso_horario"]),
            arquivo_csv=(Path(caminho).parent / coleta["arquivo_csv"]).resolve(),
            inicio_historico=date.fromisoformat(coleta["inicio_historico"]),
            dias_revisao=int(coleta["dias_revisao"]),
        )
        ZoneInfo(config.fuso_horario)
    # ZoneInfoNotFoundError é subclasse de KeyError: precisa vir antes.
    except (TypeError, ValueError, ZoneInfoNotFoundError) as erro:
        raise ErroColeta(f"config.toml com valor inválido: {erro}") from erro
    except KeyError as erro:
        raise ErroColeta(f"config.toml sem a chave {erro}") from erro

    if not (-90 <= config.latitude <= 90 and -180 <= config.longitude <= 180):
        raise ErroColeta("config.toml: latitude ou longitude fora do intervalo.")
    if config.dias_revisao < 1:
        raise ErroColeta("config.toml: dias_revisao precisa ser 1 ou mais.")
    return config


def formatar_numero(valor: float | int | str | None) -> str:
    # Padrão brasileiro: vírgula decimal, sem zeros sobrando ("20,0" -> "20").
    if valor is None:
        return ""
    if isinstance(valor, str):
        valor = valor.strip()
        if not valor:
            return ""
        valor = float(valor.replace(",", "."))

    texto = f"{float(valor):.2f}".rstrip("0").rstrip(".")
    if texto == "-0":
        texto = "0"
    return texto.replace(".", ",")


def normalizar_data(valor: str | None) -> str:
    valor = (valor or "").strip()

    for formato in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(valor, formato).date().isoformat()
        except ValueError:
            continue

    raise ErroColeta(f"Data inválida encontrada no CSV: {valor!r}")


def ler_csv(arquivo: Path) -> Registros:
    registros: Registros = {}

    if not arquivo.exists():
        return registros

    # utf-8-sig já remove o BOM do início do arquivo.
    with arquivo.open("r", encoding="utf-8-sig", newline="") as entrada:
        leitor = csv.DictReader(entrada, delimiter=";")

        if not leitor.fieldnames:
            raise ErroColeta("O CSV está vazio ou sem cabeçalho.")

        leitor.fieldnames = [(nome or "").strip() for nome in leitor.fieldnames]

        faltantes = set(OBRIGATORIAS) - set(leitor.fieldnames)
        if faltantes:
            raise ErroColeta(
                "Colunas ausentes no CSV: " + ", ".join(sorted(faltantes))
            )

        for linha in leitor:
            valor_data = (linha.get("data") or "").strip()
            if not valor_data:
                continue

            chave = normalizar_data(valor_data)
            if chave in registros:
                raise ErroColeta(f"Data repetida no CSV: {chave}")

            registro = {campo: (linha.get(campo) or "").strip() for campo in CABECALHO}
            registro["data"] = chave
            for campo in VARIAVEIS:
                try:
                    registro[campo] = formatar_numero(registro[campo])
                except ValueError:
                    raise ErroColeta(
                        f"Número inválido no CSV em {chave}, coluna {campo}: {registro[campo]!r}"
                    ) from None
            registros[chave] = registro

    return registros


def gravar_csv(arquivo: Path, registros: Registros) -> None:
    arquivo.parent.mkdir(parents=True, exist_ok=True)
    temporario = arquivo.with_suffix(".tmp")

    # Grava primeiro no temporário para nunca deixar o CSV pela metade.
    try:
        with temporario.open("w", encoding="utf-8-sig", newline="") as saida:
            escritor = csv.DictWriter(
                saida, fieldnames=CABECALHO, delimiter=";", extrasaction="ignore"
            )
            escritor.writeheader()
            for chave in sorted(registros):
                escritor.writerow(registros[chave])

        temporario.replace(arquivo)
    except BaseException:
        temporario.unlink(missing_ok=True)
        raise


def hoje_local(fuso: str) -> date:
    return datetime.now(ZoneInfo(fuso)).date()


def periodo_rotina(
    registros: Registros, ontem: date, dias_revisao: int, inicio_historico: date
) -> tuple[date, date]:
    # Do dia seguinte ao último registro (ou dos últimos dias, o que vier antes).
    if not registros:
        return inicio_historico, ontem

    ultimo = date.fromisoformat(max(registros))
    revisao = ontem - timedelta(days=dias_revisao - 1)
    return min(ultimo + timedelta(days=1), revisao), ontem


def requisitar(
    sessao: requests.Session, parametros: dict[str, Any], esperar: Esperar = time.sleep
) -> dict[str, Any]:
    for tentativa in range(len(ESPERAS) + 1):
        try:
            resposta = sessao.get(URL_ARCHIVE, params=parametros, timeout=120)
        except (requests.ConnectionError, requests.Timeout) as erro:
            falha: Exception = erro
        else:
            if resposta.status_code == 429 or resposta.status_code >= 500:
                falha = requests.HTTPError(
                    f"{resposta.status_code} na API Open-Meteo", response=resposta
                )
            else:
                resposta.raise_for_status()
                return resposta.json()

        if tentativa == len(ESPERAS):
            raise ErroColeta(
                f"API indisponível após {tentativa + 1} tentativas: {falha}"
            ) from falha

        espera = ESPERAS[tentativa]
        print(f"Falha na API ({falha}); nova tentativa em {espera} s.")
        esperar(espera)

    raise AssertionError("inalcançável")


def converter_resposta(dados: dict[str, Any] | None) -> tuple[Registros, list[str]]:
    diario = (dados or {}).get("daily") or {}
    datas = diario.get("time") or []

    for variavel in VARIAVEIS.values():
        if len(diario.get(variavel) or []) != len(datas):
            raise ErroColeta(f"Variável ausente na resposta da API: {variavel}")

    registros: Registros = {}
    pendentes: list[tuple[str, list[str]]] = []

    for i, chave in enumerate(datas):
        valores = {campo: diario[variavel][i] for campo, variavel in VARIAVEIS.items()}
        faltando = [campo for campo, valor in valores.items() if valor is None]

        if faltando:
            pendentes.append((chave, faltando))
            continue

        if pendentes:
            # Um dia completo depois de um incompleto: buraco no meio dos dados.
            chave_pendente, campos = pendentes[0]
            raise ErroColeta(
                f"Dados ausentes em {chave_pendente}: {', '.join(campos)}"
            )

        try:
            formatados = {campo: formatar_numero(valor) for campo, valor in valores.items()}
        except ValueError:
            raise ErroColeta(f"Valor não numérico na resposta da API em {chave}.") from None

        registros[chave] = {"data": chave, **formatados, "origem": ORIGEM}

    # Dias finais incompletos ainda não foram publicados pela API: ficam para depois.
    return registros, [chave for chave, _ in pendentes]


def buscar(
    sessao: requests.Session, config: Config, de: date, ate: date, esperar: Esperar = time.sleep
) -> tuple[Registros, list[str]]:
    dados = requisitar(
        sessao,
        {
            "latitude": config.latitude,
            "longitude": config.longitude,
            "start_date": de.isoformat(),
            "end_date": ate.isoformat(),
            "daily": ",".join(VARIAVEIS.values()),
            "timezone": config.fuso_horario,
            "wind_speed_unit": "kmh",
        },
        esperar,
    )
    return converter_resposta(dados)


def mesclar(existentes: Registros, novos: Registros) -> tuple[Registros, int, int]:
    registros = dict(existentes)
    incluidos = alterados = 0

    for chave, registro in novos.items():
        anterior = registros.get(chave)
        if anterior is None:
            incluidos += 1
        elif any(anterior.get(campo) != registro[campo] for campo in CABECALHO):
            alterados += 1
        registros[chave] = registro

    return registros, incluidos, alterados


def numero(texto: str) -> float | None:
    return float(texto.replace(",", ".")) if texto else None


def validar(registros: Registros) -> None:
    for chave, registro in registros.items():
        minima = numero(registro["temperatura_minima"])
        maxima = numero(registro["temperatura_maxima"])
        if minima is not None and maxima is not None and minima > maxima:
            raise ErroColeta(f"Mínima maior que a máxima em {chave}.")

    datas = sorted(registros)
    for anterior, atual in zip(datas, datas[1:]):
        esperado = date.fromisoformat(anterior) + timedelta(days=1)
        if date.fromisoformat(atual) != esperado:
            raise ErroColeta(f"Dias faltando no CSV entre {anterior} e {atual}.")


def ler_argumentos(argv: Sequence[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--de", type=date.fromisoformat, help="data inicial (AAAA-MM-DD)")
    parser.add_argument("--ate", type=date.fromisoformat, help="data final (AAAA-MM-DD)")
    parser.add_argument("--config", type=Path, default=CONFIG, help=argparse.SUPPRESS)
    return parser.parse_args(argv)


def executar(
    argv: Sequence[str] | None = None,
    sessao: requests.Session | None = None,
    hoje: date | None = None,
    esperar: Esperar = time.sleep,
) -> None:
    argumentos = ler_argumentos(argv)
    config = carregar_config(argumentos.config)
    arquivo = config.arquivo_csv

    ontem = (hoje or hoje_local(config.fuso_horario)) - timedelta(days=1)
    existentes = ler_csv(arquivo)

    if argumentos.de or argumentos.ate:
        de = argumentos.de or config.inicio_historico
        ate = min(argumentos.ate or ontem, ontem)
    else:
        de, ate = periodo_rotina(existentes, ontem, config.dias_revisao, config.inicio_historico)

    if de > ate:
        raise ErroColeta(f"Período inválido: {de} a {ate}.")

    print(f"Buscando de {de} a {ate}...")
    novos, pendentes = buscar(sessao or requests.Session(), config, de, ate, esperar)
    registros, incluidos, alterados = mesclar(existentes, novos)
    if not registros:
        raise ErroColeta("A API não retornou nenhum dia completo.")
    validar(registros)

    if incluidos or alterados or not arquivo.exists():
        gravar_csv(arquivo, registros)

    print(f"Dias recebidos: {len(novos)} | novos: {incluidos} | alterados: {alterados}")
    if pendentes:
        print(f"Ainda sem dados na API (ficam para a próxima): {', '.join(pendentes)}")
    print(f"Registros no CSV: {len(registros)} ({min(registros)} a {max(registros)})")
    print(f"Arquivo: {arquivo}")


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    try:
        executar()
    except (ErroColeta, requests.RequestException, OSError, csv.Error) as erro:
        print(f"ERRO: {erro}")
        print("O CSV não foi alterado.")
        # Código diferente de zero avisa quem chamou (Actions ou .bat) para não publicar.
        sys.exit(1)


if __name__ == "__main__":
    main()
