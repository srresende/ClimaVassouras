import csv
import requests
from datetime import date, timedelta
from pathlib import Path

# Localização: Vassouras, RJ
LAT = -22.405
LON = -43.663
FUSO_HORARIO = "America/Sao_Paulo"

PASTA = Path(r"D:\Projects\CapturaClima")
ARQUIVO_SAIDA = PASTA / "clima_vassouras_historico_abril_outubro_2026.csv"

# Período solicitado
DATA_INICIAL = date(2026, 4, 1)

# Usa ontem como data final.
DATA_FINAL = date.today() - timedelta(days=1)

URL = "https://archive-api.open-meteo.com/v1/archive"

CABECALHO = [
    "data",
    "temperatura_minima",
    "temperatura_maxima",
    "chuva_mm",
    "umidade_media",
    "vento_maximo_kmh",
]


def buscar_historico():
    parametros = {
        "latitude": LAT,
        "longitude": LON,
        "start_date": DATA_INICIAL.isoformat(),
        "end_date": DATA_FINAL.isoformat(),
        "daily": (
            "temperature_2m_min,"
            "temperature_2m_max,"
            "precipitation_sum,"
            "relative_humidity_2m_mean,"
            "wind_speed_10m_max"
        ),
        "timezone": FUSO_HORARIO,
        "wind_speed_unit": "kmh",
    }

    resposta = requests.get(URL, params=parametros, timeout=120)
    resposta.raise_for_status()
    dados = resposta.json()

    diario = dados.get("daily")
    if not diario or not diario.get("time"):
        raise ValueError("A API não retornou dados diários.")

    campos_api = {
        "temperatura_minima": "temperature_2m_min",
        "temperatura_maxima": "temperature_2m_max",
        "chuva_mm": "precipitation_sum",
        "umidade_media": "relative_humidity_2m_mean",
        "vento_maximo_kmh": "wind_speed_10m_max",
    }

    registros = []

    for i, data in enumerate(diario["time"]):
        registro = {"data": data}

        for campo, variavel in campos_api.items():
            valores = diario.get(variavel)

            if valores is None or len(valores) <= i:
                raise ValueError(
                    f"Campo ausente na resposta da API: {variavel}"
                )

            valor = valores[i]

            if valor is None:
                raise ValueError(
                    f"Valor ausente para {variavel} na data {data}"
                )

            registro[campo] = valor

        registro["origem"] = "Open-Meteo Archive"
        registros.append(registro)

    return registros


def salvar_csv(registros):
    PASTA.mkdir(parents=True, exist_ok=True)

    # Inclui origem como a sétima coluna do formato atual.
    cabecalho_completo = CABECALHO + ["origem"]

    # Grava primeiro em arquivo temporário para evitar saída parcial.
    temporario = ARQUIVO_SAIDA.with_suffix(".tmp")

    try:
        with temporario.open(
            "w", encoding="utf-8-sig", newline=""
        ) as arquivo:
            escritor = csv.DictWriter(
                arquivo,
                fieldnames=cabecalho_completo,
                delimiter=";",
            )
            escritor.writeheader()
            escritor.writerows(registros)

        temporario.replace(ARQUIVO_SAIDA)

    except Exception:
        if temporario.exists():
            temporario.unlink()
        raise


def main():
    if DATA_FINAL < DATA_INICIAL:
        raise ValueError("A data final é anterior à data inicial.")

    print(f"Consultando de {DATA_INICIAL} até {DATA_FINAL}...")

    registros = buscar_historico()

    dias_esperados = (DATA_FINAL - DATA_INICIAL).days + 1

    if len(registros) != dias_esperados:
        raise ValueError(
            f"Esperados {dias_esperados} dias, "
            f"mas a API retornou {len(registros)}."
        )

    salvar_csv(registros)

    print("Importação concluída.")
    print(f"Data inicial: {registros[0]['data']}")
    print(f"Data final: {registros[-1]['data']}")
    print(f"Total de registros: {len(registros)}")
    print(f"Arquivo gerado: {ARQUIVO_SAIDA}")


if __name__ == "__main__":
    try:
        main()
    except (requests.RequestException, ValueError, OSError) as erro:
        print(f"ERRO: {erro}")
        print("O CSV original não foi alterado.")