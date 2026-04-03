#!/usr/bin/env python3
"""
infra/sync-env-uat.py
Copia automaticamente as env vars das funções PRD para as UAT.

O que este script faz:
  1. Lê as env vars de cada função PRD via `gcloud functions describe`
  2. Remove WEBHOOK_SECRET e SUPABASE_SCHEMA (já gerenciados pelo CI)
  3. Corrige SEND_WHATSAPP_URL para apontar para send-whatsapp-uat
  4. Aplica as vars via `gcloud run services update` (sem redeploy de código)

Uso:
  python3 infra/sync-env-uat.py
"""

import subprocess
import json
import sys
import os
import shutil

PROJECT = "elite-portal-forms"


def find_gcloud() -> str:
    """Localiza o executável gcloud no sistema."""
    # 1. Tenta via shutil (respeita o PATH do processo)
    path = shutil.which("gcloud")
    if path:
        return path

    # 2. Tenta via shell (herda o PATH completo do shell do usuário)
    result = subprocess.run("which gcloud", shell=True, capture_output=True, text=True)
    if result.returncode == 0 and result.stdout.strip():
        return result.stdout.strip()

    # 3. Caminhos comuns no macOS
    candidates = [
        os.path.expanduser("~/google-cloud-sdk/bin/gcloud"),
        "/usr/local/bin/gcloud",
        "/opt/homebrew/bin/gcloud",
        "/usr/lib/google-cloud-sdk/bin/gcloud",
        "/snap/bin/gcloud",
    ]
    for p in candidates:
        if os.path.isfile(p):
            return p

    print("❌  gcloud não encontrado. Verifique se o Google Cloud SDK está instalado.")
    print("    Instale em: https://cloud.google.com/sdk/docs/install")
    sys.exit(1)


GCLOUD = find_gcloud()
REGION  = "us-central1"

# Vars gerenciadas pelo CI ou configuradas manualmente por ambiente — não sobrescrever
SKIP_KEYS = {"WEBHOOK_SECRET", "SUPABASE_SCHEMA", "SPREADSHEET_ID"}

# URL correta para UAT
SEND_WHATSAPP_UAT_URL = (
    "https://us-central1-elite-portal-forms.cloudfunctions.net/send-whatsapp-uat"
)

# Mapeamento PRD → UAT (mesma ordem de dependência)
MAPPING = [
    ("send-whatsapp",            "send-whatsapp-uat"),
    ("messenger-service",        "messenger-service-uat"),
    ("sync-elite-leads",         "sync-elite-leads-uat"),
    ("lead-qualifier",           "lead-qualifier-uat"),
    ("whatsapp-scheduler",       "whatsapp-scheduler-uat"),
    ("followup-scheduler",       "followup-scheduler-uat"),
]


def describe_function(name: str) -> dict:
    result = subprocess.run(
        [
            GCLOUD, "functions", "describe", name,
            "--gen2", f"--region={REGION}", f"--project={PROJECT}",
            "--format=json",
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip())
    return json.loads(result.stdout)


def update_env_vars(uat_name: str, env_vars: dict) -> None:
    """
    Atualiza as env vars do Cloud Run service correspondente à função UAT.
    Usa `gcloud run services update --update-env-vars` que apenas atualiza
    a configuração do serviço SEM fazer redeploy do código fonte.
    """
    if not env_vars:
        return

    # SERVICE_ACCOUNT_PRIVATE_KEY contém newlines — setamos separado
    # para isolar o valor e evitar problemas na montagem da string CSV.
    private_key = env_vars.pop("SERVICE_ACCOUNT_PRIVATE_KEY", None)

    # Vars normais — uma única chamada ao Cloud Run
    if env_vars:
        env_string = ",".join(f"{k}={v}" for k, v in env_vars.items())
        result = subprocess.run(
            [
                GCLOUD, "run", "services", "update", uat_name,
                f"--region={REGION}", f"--project={PROJECT}",
                "--update-env-vars", env_string,
            ],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            raise RuntimeError(f"Erro nas vars normais:\n{result.stderr.strip()}")

    # Private key — chamada separada (valor com newlines)
    if private_key:
        result = subprocess.run(
            [
                GCLOUD, "run", "services", "update", uat_name,
                f"--region={REGION}", f"--project={PROJECT}",
                "--update-env-vars", f"SERVICE_ACCOUNT_PRIVATE_KEY={private_key}",
            ],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            raise RuntimeError(f"Erro no private key:\n{result.stderr.strip()}")


def main() -> None:
    errors = []

    for prd_name, uat_name in MAPPING:
        print(f"\n{'─' * 55}")
        print(f"🔄  {prd_name}  →  {uat_name}")

        # 1. Ler env vars da função PRD
        try:
            data = describe_function(prd_name)
        except RuntimeError as e:
            msg = f"❌  Erro ao ler {prd_name}: {e}"
            print(msg)
            errors.append(msg)
            continue

        env_vars = data.get("serviceConfig", {}).get("environmentVariables", {})

        # 2. Filtrar vars gerenciadas pelo CI
        filtered = {k: v for k, v in env_vars.items() if k not in SKIP_KEYS}

        # 3. Corrigir SEND_WHATSAPP_URL
        if "SEND_WHATSAPP_URL" in filtered:
            filtered["SEND_WHATSAPP_URL"] = SEND_WHATSAPP_UAT_URL

        if not filtered:
            print("⚠️   Sem variáveis para copiar — pulando.")
            continue

        keys_display = ", ".join(filtered.keys())
        print(f"📝  {len(filtered)} vars: {keys_display}")

        # 4. Aplicar na função UAT
        try:
            update_env_vars(uat_name, dict(filtered))  # cópia para não mutar filtered
            print(f"✅  {uat_name} atualizado com sucesso!")
        except RuntimeError as e:
            msg = f"❌  Erro ao atualizar {uat_name}: {e}"
            print(msg)
            errors.append(msg)

    print(f"\n{'═' * 55}")
    if errors:
        print(f"⚠️  Concluído com {len(errors)} erro(s):")
        for e in errors:
            print(f"   • {e}")
        sys.exit(1)
    else:
        print("🎉  Todas as funções UAT atualizadas com sucesso!")


if __name__ == "__main__":
    main()
