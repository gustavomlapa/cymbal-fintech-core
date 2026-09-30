# Guia de Configuração e Execução do CodeMender no GitHub Actions

Este documento orienta a configuração do **CodeMender (`cm`)** integrado ao GitHub Actions no repositório `cymbal-fintech-core`. 

A integração adota a arquitetura recomendada pelo Google Cloud de **autenticação sem chaves (Keyless via Workload Identity Federation / OIDC)**. Dessa forma, nenhuma chave privada (JSON) é criada, armazenada ou exposta no repositório ou no GitHub.

---

## 1. Visão Geral da Arquitetura

```
+-------------------------------------------------------------+
| GitHub Actions Runner (Ubuntu Linux)                        |
|                                                             |
|  1. OIDC Token (actions.github.com)                         |
|     |                                                       |
|  2. Google Auth Action (google-github-actions/auth@v2)      |
|     |                                                       |
|     +---> GCP Workload Identity Federation (WIF)            |
|           Impersonates 'codemender-runner' Service Account  |
|                                                             |
|  3. Download & Install 'cm' CLI binary                      |
|                                                             |
|  4. cm init --verify                                        |
|  5. cm find .                                               |
|  6. For each finding:                                       |
|        - cm verify <id>                                     |
|        - cm fix <id>                                        |
|                                                             |
|  7. Export Reports & Upload Artifacts                       |
|  8. Open Pull Request for Human Review (No auto-merge)      |
+-------------------------------------------------------------+
```

---

## 2. Pré-requisitos

1. **Google Cloud SDK (`gcloud`)** instalado e autenticado na sua máquina local com permissões de administrador do projeto (`roles/owner` ou `roles/resourcemanager.projectIamAdmin` + `roles/iam.workloadIdentityPoolAdmin`).
2. Permissão de administrador no repositório GitHub para cadastrar **Variables** em **Settings > Secrets and variables > Actions**.

---

## 3. Provisionamento Automatizado no GCP

Disponibilizamos um script idempotente em [`scripts/setup-codemender-gcp.sh`](../scripts/setup-codemender-gcp.sh) que provisiona tudo com um único comando.

Execute no terminal:

```bash
chmod +x scripts/setup-codemender-gcp.sh
./scripts/setup-codemender-gcp.sh
```

### O que o script realiza:
1. **Habilita as APIs Google Cloud necessárias**:
   - `aiplatform.googleapis.com` (Vertex AI API para o raciocínio dos agentes Gemini)
   - `iamcredentials.googleapis.com` (Geração de tokens OIDC de curta duração)
   - `cloudresourcemanager.googleapis.com` (Metadados do projeto)
   - `artifactregistry.googleapis.com` (Download dos binários do CodeMender)
2. **Cria a Service Account**: `codemender-runner@${PROJECT_ID}.iam.gserviceaccount.com`.
3. **Concede o papel mínimo**: `roles/aiplatform.user` no projeto.
4. **Cria o Workload Identity Pool**: `codemender-pool`.
5. **Cria o Provider OIDC**: `github-provider` com o issuer `https://token.actions.githubusercontent.com` restrito estritamente ao repositório `gustavomlapa/cymbal-fintech-core`.
6. **Vincula a Service Account**: Permite a impersonação apenas para execuções originadas do repositório autorizado.

---

## 4. Configuração das Variáveis no GitHub

Ao término da execução do script, serão impressos no terminal os valores para cadastro.

Acesse o GitHub no seu navegador:
👉 **Repositório > Settings > Secrets and variables > Actions > Variables** (aba *Variables*, não precisa ser Secrets pois são identificadores de recursos públicos):

Cadastre as seguintes 3 variáveis (Repository variables):

| Nome da Variável | Exemplo de Valor | Descrição |
| :--- | :--- | :--- |
| `GCP_PROJECT_ID` | `meu-projeto-gcp` | ID do seu projeto Google Cloud |
| `GCP_WIF_PROVIDER` | `projects/123456789/locations/global/workloadIdentityPools/codemender-pool/providers/github-provider` | Resource name completo do Provider WIF |
| `GCP_WIF_SERVICE_ACCOUNT` | `codemender-runner@meu-projeto-gcp.iam.gserviceaccount.com` | E-mail da Service Account criada |

> [!TIP]
> Caso prefira manter como **Secrets**, o workflow também é compatível com `${{ secrets.GCP_PROJECT_ID }}`, etc.

---

## 5. Como Executar o Workflow

O workflow está configurado no arquivo [`.github/workflows/codemender.yml`](../.github/workflows/codemender.yml).

### Disparo Manual (On-Demand):
1. No GitHub, vá até a aba **Actions**.
2. No menu lateral esquerdo, selecione **CodeMender Security Audit & Remediation**.
3. Clique no menu dropdown **Run workflow**.
4. (Opcional) Ajuste os parâmetros se desejar:
   - Branch base para aplicar o PR.
   - Ativação ou desativação do auto-fix.
5. Clique no botão verde **Run workflow**.

---

## 6. Revisão do Pull Request

Quando o CodeMender detectar vulnerabilidades e sintetizar correções bem-sucedidas com `cm fix`:

1. O workflow abrirá automaticamente um **Pull Request** intitulado:
   `fix(security): CodeMender automated remediation`
2. **Nenhuma alteração é aprovada ou mesclada automaticamente**. O PR aguardará a conferência de um engenheiro de software.
3. No corpo do PR, você encontrará:
   - A tabela com as vulnerabilidades detectadas, status de reprodução do exploit (`cm verify`) e aplicação do patch (`cm fix`).
   - O link direto para o resumo da execução e download dos **Artifacts** (relatórios SARIF v2.1.0 e logs de execução).
4. O time pode revisar o diff dos arquivos, validar os testes unitários da aplicação e efetuar o merge com total confiança e rastreabilidade.
