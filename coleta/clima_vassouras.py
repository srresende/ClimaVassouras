import csv
import sys
import requests
from datetime import datetime, timedelta
from pathlib import Path

LAT = -22.405
LON = -43.663
FUSO_HORARIO = "America/Sao_Paulo"

PASTA = Path(__file__).resolve().parent.parent / "dados"
ARQUIVO = PASTA / "clima_vassouras.csv"
TEMPORARIO = PASTA / "clima_vassouras.tmp"
BACKUP = PASTA / "clima_vassouras_backup.csv"

# None consulta automaticamente o dia anterior.
# Para consultar uma data específica, use "2026-10-14" ou None
DATA_DESEJADA = None

CABECALHO = [
    "data",
    "temperatura_minima",
    "temperatura_maxima",
    "chuva_mm",
    "umidade_media",
    "vento_maximo_kmh",
    "origem",
]


CAMPOS_NUMERICOS = [
    "temperatura_minima",
    "temperatura_maxima",
    "chuva_mm",
    "umidade_media",
    "vento_maximo_kmh",
]


def formatar_numero(valor):
    # Padrão brasileiro: vírgula decimal, sem zeros sobrando ("20,0" -> "20").
    if isinstance(valor, str):
        valor = valor.strip()
        if not valor:
            return ""
        valor = float(valor.replace(",", "."))

    texto = f"{float(valor):.2f}".rstrip("0").rstrip(".")
    return texto.replace(".", ",")


def normalizar_data(valor):
    valor = (valor or "").strip()

    for formato in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(valor, formato).date().isoformat()
        except ValueError:
            continue

    raise ValueError(f"Data inválida encontrada no CSV: {valor!r}")


def ler_historico():
    registros = {}

    if not ARQUIVO.exists():
        return registros

    with ARQUIVO.open("r", encoding="utf-8-sig", newline="") as arquivo:
        leitor = csv.DictReader(arquivo, delimiter=";")

        if not leitor.fieldnames:
            raise ValueError("O CSV está vazio ou sem cabeçalho.")

        leitor.fieldnames = [
            (nome or "").strip().lstrip("\ufeff")
            for nome in leitor.fieldnames
        ]

        faltantes = set(CABECALHO) - set(leitor.fieldnames)
        if faltantes:
            raise ValueError(
                "Colunas ausentes no CSV: " + ", ".join(sorted(faltantes))
            )

        for linha in leitor:
            valor_data = (linha.get("data") or "").strip()
            if not valor_data:
                continue

            data = normalizar_data(valor_data)

            registro = {
                campo: (linha.get(campo) or "").strip()
                for campo in CABECALHO
            }
            registro["data"] = data
            for campo in CAMPOS_NUMERICOS:
                registro[campo] = formatar_numero(registro[campo])
            registros[data] = registro

    return registros


def consultar_data():
    if DATA_DESEJADA:
        return datetime.strptime(DATA_DESEJADA, "%Y-%m-%d").date()

    resposta = requests.get(
        "https://api.open-meteo.com/v1/forecast",
        params={
            "latitude": LAT,
            "longitude": LON,
            "current": "temperature_2m",
            "timezone": FUSO_HORARIO,
        },
        timeout=30,
    )
    resposta.raise_for_status()

    hora = resposta.json().get("current", {}).get("time")

    if not hora:
        raise ValueError("A API não retornou a data atual.")

    hoje = datetime.strptime(hora[:10], "%Y-%m-%d").date()
    return hoje - timedelta(days=1)


def buscar_dados(data):
    resposta = requests.get(
        "https://archive-api.open-meteo.com/v1/archive",
        params={
            "latitude": LAT,
            "longitude": LON,
            "start_date": data.isoformat(),
            "end_date": data.isoformat(),
            "daily": (
                "temperature_2m_min,"
                "temperature_2m_max,"
                "precipitation_sum,"
                "relative_humidity_2m_mean,"
                "wind_speed_10m_max"
            ),
            "timezone": FUSO_HORARIO,
            "wind_speed_unit": "kmh",
        },
        timeout=60,
    )
    resposta.raise_for_status()

    diario = resposta.json().get("daily") or {}
    datas = diario.get("time") or []

    if data.isoformat() not in datas:
        raise ValueError(f"A API não retornou dados para {data}.")

    i = datas.index(data.isoformat())

    mapa = {
        "temperatura_minima": "temperature_2m_min",
        "temperatura_maxima": "temperature_2m_max",
        "chuva_mm": "precipitation_sum",
        "umidade_media": "relative_humidity_2m_mean",
        "vento_maximo_kmh": "wind_speed_10m_max",
    }

    valores = {}

    for campo, variavel in mapa.items():
        lista = diario.get(variavel)

        if lista is None or len(lista) <= i or lista[i] is None:
            raise ValueError(
                f"Dados ausentes para '{variavel}'. "
                "O histórico não será gravado."
            )

        valores[campo] = formatar_numero(lista[i])

    return valores


def gravar_historico(registros):
    # Cria o novo arquivo temporário antes de substituir o original.
    with TEMPORARIO.open("w", encoding="utf-8-sig", newline="") as arquivo:
        escritor = csv.DictWriter(
            arquivo,
            fieldnames=CABECALHO,
            delimiter=";",
            extrasaction="ignore",
        )
        escritor.writeheader()

        for data in sorted(registros):
            escritor.writerow(registros[data])

    TEMPORARIO.replace(ARQUIVO)


def main():
    # Faz uma cópia de segurança antes da primeira alteração.
    if not BACKUP.exists() and ARQUIVO.exists():
        import shutil
        shutil.copy2(ARQUIVO, BACKUP)
        print(f"Backup criado: {BACKUP}")

    registros = ler_historico()
    data = consultar_data()
    valores = buscar_dados(data)

    chave = data.isoformat()

    registros[chave] = {
        "data": chave,
        **valores,
        "origem": "Open-Meteo Archive",
    }

    gravar_historico(registros)

    print("Histórico atualizado com sucesso.")
    print(f"Data consultada: {chave}")
    print(f"Registros no CSV: {len(registros)}")
    print(f"Arquivo: {ARQUIVO}")


if __name__ == "__main__":
    try:
        main()
    except (
        requests.RequestException,
        ValueError,
        OSError,
        csv.Error,
    ) as erro:
        print(f"ERRO: {erro}")
        print("Verifique o arquivo e o backup antes de tentar novamente.")
        # Codigo diferente de zero avisa o .bat para nao publicar o CSV.
        sys.exit(1)