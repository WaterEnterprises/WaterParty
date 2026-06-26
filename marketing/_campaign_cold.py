"""
Cold Lead Campaign — Send personalized emails to all emailable cold leads.
Calls send-mail.py via subprocess for each lead.
"""
import subprocess
import sys
import uuid
from pathlib import Path

MARKETING_DIR = Path(__file__).resolve().parent
SEND_MAIL = MARKETING_DIR / "send-mail.py"

import os

import sqlcipher3 as sqlite3

DB_PATH = MARKETING_DIR / "leads.db"

def get_db():
    db = sqlite3.connect(str(DB_PATH))
    db.row_factory = sqlite3.Row
    hex_key = os.environ["EMAIL_DB_PASSWORD"].encode().hex()
    db.execute(f"PRAGMA key=\"x'{hex_key}'\"")
    db.execute("PRAGMA journal_mode=WAL")
    return db

def log_outreach(lid, activity_type, notes, outcome=""):
    db = get_db()
    oid = str(uuid.uuid4())
    db.execute("INSERT INTO outreach_log (id, lead_id, activity_type, notes, outcome) VALUES (?, ?, ?, ?, ?)",
               (oid, lid, activity_type, notes, outcome))
    db.commit()
    db.close()

def update_status(lid, status, next_action, next_action_date):
    db = get_db()
    db.execute("UPDATE leads SET status=?, next_action=?, next_action_date=?, updated_at=datetime('now') WHERE id=?",
               (status, next_action, next_action_date, lid))
    db.commit()
    db.close()

def send_one(email, subject, body):
    result = subprocess.run(
        [sys.executable, str(SEND_MAIL),
         "--emails", email,
         "--subject", subject,
         "--body", body],
        capture_output=True, text=True, timeout=60,
        env=os.environ
    )
    return result.returncode == 0, result.stdout + result.stderr

# ─── EMAIL CONTENT ──────────────────────────────────────────────────────────

APP_URL = "https://waterparty-react-14hr.onrender.com"
LANDING_URL = "https://water-enterprises-landing.onrender.com"
GITHUB_URL = "https://github.com/StellariumFoundation/WaterParty-React"

campaigns = [
    # 1. AMBEV — Strategic Sponsor
    {
        "lid": "7ea1b4dd-2826-45ca-bf1c-3419bcf240c2",
        "email": "marketing@ambev.com.br",
        "subject": "Parceria WaterParty x AMBEV: Patrocínio Categoria Cerveja no App",
        "body": f"""Olá, equipe AMBEV!

Meu nome é John Victor, founder do WaterParty — um aplicativo de descoberta social de festas e eventos que está saindo do forno e pronto para lançar em Recife.

O QUE É O WATERPARTY?
Um Tinder para festas: deslize -> confirme presença -> converse com anfitrião -> pague gorjeta/crowdfunding, tudo em um app. Detecção automática de moeda via GPS. Cross-platform iOS + Android.

Links:
- App funcional: {APP_URL}
- Landing Page: {LANDING_URL}
- GitHub: {GITHUB_URL}

OPORTUNIDADE DE PATROCÍNIO
Queremos oferecer à AMBEV a Categoria Exclusiva de Cerveja dentro do WaterParty:
- Branding em todos os cards de eventos
- Integração de produtos nos eventos cadastrados
- Ativações em festas universitárias via app
- Dados de comportamento do público jovem 18-35 em Recife (4M habitantes, 100K+ universitários)
- Piloto estimado: ~R$15K/mês por 3 meses em Recife

TRACTION
MVP funcional em produção com React 19, Bun, Turso, Stripe Connect. Stripe tipping + crowdfunding implementados e testados. Pronto para escalar.

Além disso: O 100+ Accelerator (AB InBev) está com inscrições abertas para Cohort 8 até 10/07/2026. Já estamos nos preparando para aplicar!

ASK: Gostaria de agendar uma call de 15 min para apresentar a proposta completa de patrocínio exclusivo.

Atenciosamente,
John Victor
Founder & CEO, Water Enterprises
water.enterprises.org@gmail.com
{APP_URL}""",
    },
    # 2. Porto Digital — Incubation
    {
        "lid": "d72c1210-0042-49d9-af7b-70464cb398d2",
        "email": "portodigital@portodigital.org",
        "subject": "WaterParty — Candidatura Programa de Incubação Porto Digital",
        "body": f"""Prezados, Porto Digital,

Meu nome é John Victor, founder do WaterParty (Water Enterprises). Somos uma startup de tecnologia sediada em Recife construindo o maior app de descoberta de festas e eventos do Brasil.

O PRODUTO
WaterParty é um app cross-platform (iOS + Android via Capacitor) que unifica a jornada do jovem: descobrir eventos -> ver amigos presentes -> confirmar presença -> conversar com anfitrião -> pagar gorjeta/crowdfunding via Stripe. Detecção automática de moeda via GPS.

Links:
- App: {APP_URL}
- Landing: {LANDING_URL}
- GitHub: {GITHUB_URL}

POR QUE PORTO DIGITAL?
Recife é nossa cidade de lançamento. 4M de habitantes, 100K+ universitários. Buscamos incubação para networking, mentoria, benefícios fiscais e conexão com investidores.

TRACTION: React 19 + TypeScript + Bun + Turso + Stripe Connect. WebSockets. Produção ativa.

ASK: Gostaria de candidatar o WaterParty aos programas de incubação. Podemos agendar uma visita ou call?

Atenciosamente,
John Victor
Founder & CEO, Water Enterprises
water.enterprises.org@gmail.com""",
    },
    # 3. FACEPE — Grant
    {
        "lid": "472b0c49-6919-47cc-8f1b-2b058aa5fe6b",
        "email": "facepe@facepe.br",
        "subject": "WaterParty — Consulta Editais Inovação FACEPE (Startup Recife/PE)",
        "body": f"""Prezados, FACEPE,

Meu nome é John Victor, founder do WaterParty, startup pernambucana de tecnologia.

SOBRE: WaterParty é um app cross-platform de descoberta social de eventos. MVP funcional em produção com React 19, Bun, Turso, Stripe Connect. Detecção de moeda via GPS.

Links: {APP_URL} | {LANDING_URL}

Recife-based, tech innovation, mercado de US$150B global. Acreditamos que nos enquadramos em linhas de subvenção à inovação e programas de apoio a startups do estado.

ASK: Há editais abertos ou previstos para 2026/2027 para startups de base tecnológica em Pernambuco?

Atenciosamente,
John Victor
water.enterprises.org@gmail.com""",
    },
    # 4. FINEP Tecnova — URGENT (launched Jun 16!)
    {
        "lid": "d89d96d0-57be-44e7-96ed-5d75e46bf7de",
        "email": "chamada-tecnova@fapesp.br",
        "subject": "WaterParty — Interesse Programa Tecnova 2026/2027 (Subvenção Inovação)",
        "body": f"""Prezados,

Meu nome é John Victor, founder do WaterParty — startup brasileira de tecnologia.

SOBRE: WaterParty é um app de descoberta social de eventos (Tinder para festas) com pagamentos integrados (Stripe), chat em tempo real e detecção de moeda via GPS. Cross-platform iOS + Android. MVP funcional em produção.

Links: {APP_URL} | {LANDING_URL} | {GITHUB_URL}

Tomamos conhecimento do lançamento do Tecnova 2026/2027 em 16/06/2026 (R$360M em subvenção, prazo 03/08/2026). WaterParty se enquadra como projeto de inovação tecnológica com risco tecnológico significativo e enorme oportunidade de mercado (indústria global de life noturna: US$150B).

ASK: Gostaria de orientações sobre como submeter o WaterParty ao Tecnova 2026/2027. Podemos enviar projeto detalhado.

Atenciosamente,
John Victor
Founder & CEO, Water Enterprises
water.enterprises.org@gmail.com
{APP_URL}""",
    },
    # 5. BNDES Garagem
    {
        "lid": "f05438ed-8f28-408d-bb23-5cf7e169c6ae",
        "email": "bndesgaragem@quintessa.org.br",
        "subject": "WaterParty — Candidatura BNDES Garagem (Negócio de Impacto)",
        "body": f"""Prezados, BNDES Garagem,

Meu nome é John Victor, founder do WaterParty — startup brasileira conectando jovens a experiências reais, combatendo o isolamento digital.

O PRODUTO: WaterParty é um app de descoberta social de festas (Tinder para festas): deslize, confirme presença, veja amigos, converse com anfitrião, pague via Stripe. Detecção de moeda via GPS.

Links: {APP_URL} | {LANDING_URL}

IMPACTO SOCIAL: Conexão presencial, economia local, oportunidades para pequenos hosts, sistema de reputação para segurança.

TRACTION: MVP em produção. Stack moderna. 103 leads. Pronto para Recife.

ASK: Gostaria de candidatar o WaterParty ao BNDES Garagem como negócio de impacto. Podemos apresentar o pitch?

Atenciosamente,
John Victor
water.enterprises.org@gmail.com""",
    },
    # 6. CNPq
    {
        "lid": "466a102c-d757-48e5-ad74-c0ac3aec86b5",
        "email": "directoria@cnpq.br",
        "subject": "WaterParty — Consulta Programa RHAE / Bolsas Inovação CNPq",
        "body": f"""Prezados, CNPq,

WaterParty é uma startup pernambucana desenvolvendo app inovador de descoberta social de eventos com tecnologia de GPS currency detection e sistema de reputação.

Links: {APP_URL} | {LANDING_URL}

ASK: Há editais abertos ou previsão para 2026/2027 do Programa RHAE ou similares para startups de base tecnológica?

John Victor
water.enterprises.org@gmail.com""",
    },
    # 7. SEBRAE
    {
        "lid": "b0ecdf05-a677-4b18-bd88-1c7092551866",
        "email": "sebraepe@sebrae.com.br",
        "subject": "WaterParty — Consulta Programas SEBRAE Startups PE",
        "body": f"""Prezados, SEBRAE PE,

WaterParty é uma startup pernambucana de tecnologia (app de descoberta social de eventos, MVP funcional em produção).

Links: {APP_URL} | {LANDING_URL}

ASK: Há programas do SEBRAE para startups de base tecnológica em Pernambuco?

John Victor
water.enterprises.org@gmail.com""",
    },
    # 8. Google for Startups
    {
        "lid": "fa92cc68-d9f9-45e8-8594-1bf46d2ddaf9",
        "email": "googleforstartups@google.com",
        "subject": "WaterParty — Application Google for Startups Brazil",
        "body": f"""Dear Google for Startups Team,

I'm John Victor, founder of WaterParty — a social discovery platform for nightlife and events.

THE PRODUCT: Tinder-like discovery app for parties. Swipe -> RSVP -> chat with hosts -> pay tips/crowdfunding via Stripe. GPS-based currency detection. iOS + Android.

Links:
- Live app: {APP_URL}
- Landing: {LANDING_URL}
- GitHub: {GITHUB_URL}

TECH STACK: React 19 + TypeScript + Bun + Turso + Stripe Connect + WebSockets. Cloud-native, Google Cloud ready.

MARKET: Launching in Recife, Brazil (4M pop, 100K+ students). Expanding across LatAm. Global nightlife industry: $150B.

ASK: Applying for Google for Startups Brazil — seeking $50K-100K cloud credits and mentorship.

Best regards,
John Victor
Founder & CEO, Water Enterprises
water.enterprises.org@gmail.com""",
    },
    # 9. 4Equity — Media for Equity
    {
        "lid": "908b0b11-697a-40fb-88c5-698a87714b32",
        "email": "hatab@4equity.com.br",
        "subject": "WaterParty — Proposta Media for Equity (Social Discovery, US$150B Market)",
        "body": f"""Olá Felipe,

Meu nome é John Victor, founder do WaterParty. Acompanhei o trabalho da 4Equity — acredito que temos um fit excelente para Media for Equity.

WATERPARTY: App de descoberta social de festas (Tinder para festas). Deslize, confirme presença, veja amigos, converse, pague via Stripe. Detecção de moeda via GPS. iOS + Android.

Links: {APP_URL} | {LANDING_URL} | {GITHUB_URL}

TRACTION: MVP em produção. React 19 + Bun + Turso + Stripe Connect. Stripe tipping + crowdfunding. 103 leads de parceiros.

MERCADO: US$150B global, R$50B Brasil. Sem player digital dominante.

OPORTUNIDADE M4E: Trocar mídia digital/OTT/influenciadores por equity no WaterParty. App pronto, Recife como mercado de prova, 21 leads frios para aquecer com mídia.

ASK: Vamos conversar sobre um deal de Media for Equity?

Atenciosamente,
John Victor
water.enterprises.org@gmail.com
{APP_URL}""",
    },
    # 10. Nexpon — Media for Equity
    {
        "lid": "ef70d1dc-12eb-4073-bf1b-b211df0c0190",
        "email": "contato@nexpon.com.br",
        "subject": "WaterParty — Proposta Media for Equity (Expansão NE Brasil)",
        "body": f"""Olá, equipe Nexpon,

WaterParty é um app de descoberta social de festas (Tinder para festas). MVP funcional. Pagamentos via Stripe. Detecção de moeda via GPS.

Links: {APP_URL} | {LANDING_URL}

Sei que a Nexpon atua com M4E no Sul, mas o Nordeste é um mercado gigante para entretenimento noturno. Proponho um deal de Media for Equity.

ASK: Vamos conversar?

John Victor
water.enterprises.org@gmail.com""",
    },
    # 11. Bold Comunicação — Marketing Partnership
    {
        "lid": "e5816bf7-40d3-439b-8b1f-07e0953c73c7",
        "email": "halisson@boldcomunicacao.com.br",
        "subject": "Parceria WaterParty x Bold Comunicação — Lançamento App Recife",
        "body": f"""Olá Halisson,

WaterParty é um app pernambucano de descoberta social de festas (Tinder para festas). MVP funcional. Vamos lançar em Recife.

Links: {APP_URL} | {LANDING_URL}

Precisamos de agência de marketing digital para o lançamento: redes sociais, tráfego pago, influenciadores, campanhas universitárias.

ASK: Interesse em apresentar proposta de parceria?

John Victor
water.enterprises.org@gmail.com""",
    },
    # 12. Agência Cósmica — Marketing Partnership
    {
        "lid": "58a53400-d709-4236-9595-478b3f75e5a1",
        "email": "contato@agenciacosmica.com.br",
        "subject": "Parceria WaterParty x Agência Cósmica — Lançamento App Recife",
        "body": f"""Olá, equipe Cósmica,

WaterParty é um app pernambucano de descoberta social de festas. MVP funcional. Lançamento em Recife.

Links: {APP_URL} | {LANDING_URL}

Buscamos agência parceira para marketing digital de lançamento.

ASK: Interesse em apresentar proposta?

John Victor
water.enterprises.org@gmail.com""",
    },
    # 13. VDB Conecta — Influencer Agency
    {
        "lid": "b3f3985d-4d8d-4f22-a2c9-126bb6f6f911",
        "email": "contato@vdbconecta.com.br",
        "subject": "Parceria WaterParty x VDB Conecta — Influenciadores NE para Lançamento",
        "body": f"""Olá, equipe VDB Conecta,

WaterParty é um app de descoberta social de festas que vai lançar em Recife. MVP funcional.

Links: {APP_URL} | {LANDING_URL}

A VDB é referência em casting nordestino. Precisamos de influenciadores de Recife para o lançamento.

ASK: Proponho parceria — casting/gestão de influenciadores por exposição + participação. Vamos conversar?

John Victor
water.enterprises.org@gmail.com""",
    },
]

# ─── SEND ───────────────────────────────────────────────────────────────────

def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--send", action="store_true", help="Actually send emails")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be sent")
    args = parser.parse_args()

    print("=" * 60)
    print("  WATERPARTY — COLD LEAD EMAIL CAMPAIGN")
    print(f"  Total: {len(campaigns)} personalized emails")
    print("=" * 60)

    print("\nCAMPAIGN PREVIEW:\n")
    for i, c in enumerate(campaigns, 1):
        subj_preview = c["subject"][:70]
        print(f"  {i:2d}. [{c['email']}] {subj_preview}...")

    if not args.send and not args.dry_run:
        print("\n  Use --dry-run to preview or --send to send")
        return

    if args.dry_run:
        print("\n  DRY RUN — no emails sent")
        for i, c in enumerate(campaigns, 1):
            print(f"\n  [{i}/{len(campaigns)}] To: {c['email']}")
            print(f"       Subject: {c['subject']}")
            print(f"       Body preview: {c['body'][:100]}...")
        return

    if args.send:
        sent = 0
        errors = 0
        for i, c in enumerate(campaigns, 1):
            print(f"\n  [{i}/{len(campaigns)}] Sending to {c['email']}...", end=" ")
            sys.stdout.flush()
            ok, output = send_one(c["email"], c["subject"], c["body"])
            if ok:
                log_outreach(c["lid"], "email",
                             f"Cold campaign outreach",
                             f"Sent to {c['email']}")
                update_status(c["lid"], "contacted", "Monitorar reply", "2026-06-27")
                sent += 1
                print("OK")
            else:
                errors += 1
                print(f"FAIL: {output[:200]}")

        print(f"\n{'=' * 60}")
        print(f"  CAMPAIGN COMPLETE")
        print(f"  Sent: {sent} | Errors: {errors}")
        print(f"{'=' * 60}")

        remaining = ["Influency.me", "HypeAuditor", "Lessie AI",
                     "TikTok Creator Marketplace", "Instagram Creator Marketplace",
                     "100 Open Startups", "LAVCA", "Made Assessoria"]
        print("\n  Remaining cold leads (need platform signup, not email):")
        for name in remaining:
            print(f"    - {name}")

if __name__ == "__main__":
    main()
