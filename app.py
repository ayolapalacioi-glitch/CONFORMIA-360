from __future__ import annotations

from datetime import datetime
from pathlib import Path

from flask import Flask, jsonify, render_template, request, send_from_directory, url_for


BASE_DIR = Path(__file__).resolve().parent
LOGO_FILENAME = "WhatsApp Image 2026-06-23 at 12.17.06 PM.jpeg"

app = Flask(__name__)


CAUSE_BUCKETS = ["Inventario", "Proveedores", "Proceso Interno"]


def iso_now() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def infer_bucket(case_data: dict) -> str:
    bucket = (case_data.get("cause_bucket") or "").strip()
    if bucket in CAUSE_BUCKETS:
        return bucket

    subcategory = (case_data.get("subcategory") or "").lower()
    category = (case_data.get("category") or "").lower()

    if "invent" in subcategory or "stock" in subcategory or "invent" in category:
        return "Inventario"
    if "prove" in subcategory or "prove" in category:
        return "Proveedores"
    return "Proceso Interno"


def make_learning_entry(case_data: dict) -> dict:
    return {
        "case_id": case_data["id"],
        "problem": case_data.get("description", ""),
        "root_cause": case_data.get("root_cause", ""),
        "action": case_data.get("action_title") or "Pendiente de accion",
        "impact": float(case_data.get("expected_impact", 0) or 0),
        "updated_at": iso_now(),
    }


    app.run(debug=True)
    entry = next((item for item in STATE["learning_library"] if item.get("case_id") == case_data["id"]), None)
    if entry is None:
        STATE["learning_library"].append(make_learning_entry(case_data))
        return

    entry["problem"] = case_data.get("description", "")
    entry["root_cause"] = case_data.get("root_cause", "")
    if case_data.get("action_title"):
        entry["action"] = case_data["action_title"]
    entry["impact"] = float(case_data.get("expected_impact", entry.get("impact", 0)) or 0)
    entry["updated_at"] = iso_now()


def refresh_case_status(case_data: dict) -> None:
    if case_data.get("prevented"):
        case_data["status"] = "Prevencion Activa"
    elif case_data.get("implemented"):
        case_data["status"] = "Accion Implementada"
    elif case_data.get("action_title"):
        case_data["status"] = "Accion de Mejora Generada"
    elif case_data.get("learning"):
        case_data["status"] = "Aprendizaje Registrado"
    elif case_data.get("root_cause"):
        case_data["status"] = "Causa Raiz Identificada"
    else:
        case_data["status"] = "En Analisis"


def seed_state() -> dict:
    return {
        "active_case_id": 1255,
        "next_case_id": 1257,
        "cases": [
            {
                "id": 1254,
                "user": "Claudia Rios",
                "category": "Operaciones",
                "subcategory": "Inventario",
                "channel": "Portal",
                "priority": "Alta",
                "description": "Faltaron insumos criticos en la sede norte durante el turno de apertura.",
                "status": "Prevencion Activa",
                "why_tree": [
                    {"level": 1, "question": "Por que no habia stock?", "answer": "No se disparo la alerta minima."},
                    {"level": 2, "question": "Por que no se disparo la alerta?", "answer": "El umbral no estaba parametrizado en el sistema."},
                    {"level": 3, "question": "Por que no estaba parametrizado?", "answer": "El alta del articulo no paso por validacion de operaciones."},
                    {"level": 4, "question": "Por que no hubo validacion?", "answer": "No existia un checklist obligatorio de aprobacion."},
                    {"level": 5, "question": "Por que no habia checklist?", "answer": "El proceso se venia ejecutando de forma manual."},
                ],
                "root_cause": "Falta de alertas automaticas de inventario",
                "learning": "La trazabilidad de reposicion debe quedar parametrizada antes de habilitar un articulo critico.",
                "action_id": 1,
                "action_title": "Alertas automaticas de stock minimo",
                "action_leader": "Laura Gomez",
                "action_due_date": "2026-06-25",
                "expected_impact": 42,
                "milestones": ["Parametrizar umbral", "Validar correo multicanal", "Monitorear 7 dias"],
                "implemented": True,
                "prevented": True,
                "prevention": "Bloqueo preventivo y aviso automatico cuando el stock cae bajo el umbral.",
                "cause_bucket": "Inventario",
                "created_at": "2026-06-20T09:00:00Z",
                "updated_at": "2026-06-20T13:00:00Z",
            },
            {
                "id": 1255,
                "user": "Jorge Perez",
                "category": "Abastecimiento",
                "subcategory": "Proceso Interno",
                "channel": "App movil",
                "priority": "Media",
                "description": "La aprobacion de solicitudes sigue acumulando demora en la cola de validacion.",
                "status": "Causa Raiz Identificada",
                "why_tree": [
                    {"level": 1, "question": "Por que se demora la aprobacion?", "answer": "La revision es totalmente manual."},
                    {"level": 2, "question": "Por que es manual?", "answer": "No existe una regla de asignacion automatica."},
                    {"level": 3, "question": "Por que no existe la regla?", "answer": "El flujo actual no define SLA ni alertas de vencimiento."},
                    {"level": 4, "question": "Por que no hay SLA visible?", "answer": "Cada area administra la cola de forma independiente."},
                    {"level": 5, "question": "Por que se administra por area?", "answer": "El proceso fue escalado sin un disenio unico de operacion."},
                ],
                "root_cause": "Aprobacion manual sin SLA ni alertas de cola",
                "learning": "",
                "action_id": None,
                "action_title": "",
                "action_leader": "",
                "action_due_date": "",
                "expected_impact": 0,
                "milestones": [],
                "implemented": False,
                "prevented": False,
                "prevention": "",
                "cause_bucket": "Proceso Interno",
                "created_at": "2026-06-23T08:30:00Z",
                "updated_at": "2026-06-23T09:15:00Z",
            },
            {
                "id": 1256,
                "user": "Sofia Marin",
                "category": "Compras",
                "subcategory": "Proveedores",
                "channel": "Correo",
                "priority": "Alta",
                "description": "Se repite el retraso en la confirmacion de disponibilidad del proveedor principal.",
                "status": "Prevencion Activa",
                "why_tree": [
                    {"level": 1, "question": "Por que se repite el retraso?", "answer": "El proveedor responde fuera de ventana operativa."},
                    {"level": 2, "question": "Por que responde fuera de ventana?", "answer": "No habia una confirmacion automatica de recepcion."},
                    {"level": 3, "question": "Por que no habia confirmacion?", "answer": "La comunicacion dependia de mensajes manuales."},
                    {"level": 4, "question": "Por que dependia de mensajes manuales?", "answer": "No se habia integrado un canal de confirmacion estandar."},
                    {"level": 5, "question": "Por que no se integro?", "answer": "El proceso no tenia un responsable unico de seguimiento."},
                ],
                "root_cause": "Confirmacion tardia del proveedor sin canal automatizado",
                "learning": "Los proveedores criticos necesitan un canal de recepcion que deje evidencia y hora de confirmacion.",
                "action_id": 2,
                "action_title": "Canal automatico de confirmacion con proveedores",
                "action_leader": "Miguel Torres",
                "action_due_date": "2026-06-28",
                "expected_impact": 28,
                "milestones": ["Integrar plantilla", "Registrar acuse", "Medir tiempo de respuesta"],
                "implemented": True,
                "prevented": True,
                "prevention": "Se activo un acuse automatico y seguimiento diario de proveedores criticos.",
                "cause_bucket": "Proveedores",
                "created_at": "2026-06-21T10:45:00Z",
                "updated_at": "2026-06-22T16:20:00Z",
            },
        ],
        "actions": [
            {
                "id": 1,
                "case_id": 1254,
                "title": "Alertas automaticas de stock minimo",
                "leader": "Laura Gomez",
                "due_date": "2026-06-25",
                "expected_impact": 42,
                "milestones": ["Parametrizar umbral", "Validar correo multicanal", "Monitorear 7 dias"],
                "implemented": True,
                "created_at": "2026-06-20T11:00:00Z",
            },
            {
                "id": 2,
                "case_id": 1256,
                "title": "Canal automatico de confirmacion con proveedores",
                "leader": "Miguel Torres",
                "due_date": "2026-06-28",
                "expected_impact": 28,
                "milestones": ["Integrar plantilla", "Registrar acuse", "Medir tiempo de respuesta"],
                "implemented": True,
                "created_at": "2026-06-22T12:00:00Z",
            },
        ],
        "learning_library": [
            {
                "case_id": 1248,
                "problem": "Rotura de stock en insumos criticos",
                "root_cause": "Falta de alertas de inventario",
                "action": "Alertas automaticas y umbral minimo",
                "impact": 42,
                "updated_at": "2026-06-18T12:00:00Z",
            },
            {
                "case_id": 1249,
                "problem": "Reincidencia por proveedor sin confirmacion",
                "root_cause": "Falta de canal estandar de recepcion",
                "action": "Canal automatico de confirmacion",
                "impact": 28,
                "updated_at": "2026-06-19T09:00:00Z",
            },
            {
                "case_id": 1250,
                "problem": "Aprobacion de solicitudes tardia",
                "root_cause": "Proceso manual sin SLA visible",
                "action": "Tablero de cola y SLA operativo",
                "impact": 34,
                "updated_at": "2026-06-19T16:00:00Z",
            },
        ],
    }


STATE = seed_state()


def get_case(case_id: int) -> dict | None:
    return next((case_data for case_data in STATE["cases"] if case_data["id"] == case_id), None)


def active_case() -> dict:
    case_data = get_case(STATE["active_case_id"])
    return case_data or STATE["cases"][0]


def calculate_metrics() -> dict:
    cases_received = len(STATE["cases"])
    root_causes_identified = sum(1 for case_data in STATE["cases"] if case_data.get("root_cause"))
    knowledge_identified = len(STATE["learning_library"])
    actions_generated = sum(1 for action in STATE["actions"] if action.get("title"))
    implemented_improvements = sum(1 for action in STATE["actions"] if action.get("implemented"))
    problems_prevented = sum(1 for case_data in STATE["cases"] if case_data.get("prevented"))

    iao = round((implemented_improvements / cases_received) * 100, 1) if cases_received else 0.0
    if iao <= 30:
        band = "red"
        interpretation = "Estado reactivo"
        narrative = "Se resuelven casos, pero el aprendizaje organizacional aun es bajo."
    elif iao <= 70:
        band = "yellow"
        interpretation = "Estado intermedio"
        narrative = "Hay aprendizaje parcial, pero persisten oportunidades de prevencion y estandarizacion."
    else:
        band = "green"
        interpretation = "Madurez organizacional"
        narrative = "El ciclo de aprendizaje esta consolidado y empieza a prevenir reincidencias."

    cause_distribution = []
    for bucket in CAUSE_BUCKETS:
        cause_distribution.append({"label": bucket, "value": sum(1 for case_data in STATE["cases"] if case_data.get("cause_bucket") == bucket)})

    top_bucket = max(cause_distribution, key=lambda item: item["value"], default={"label": "Inventario", "value": 0})
    recommendations = [
        f"Priorizar la causa {top_bucket['label']} porque concentra la mayor recurrencia observada.",
    ]
    if iao < 30:
        recommendations.append("Cerrar un ciclo completo de aprendizaje antes de abrir nuevos frentes para evitar dispersar la capacidad del equipo.")
    elif iao < 71:
        recommendations.append("Convertir cada hallazgo en una accion estandarizada con responsable, fecha y evidencia de prevencion.")
    else:
        recommendations.append("Escalar el patron exitoso como norma operativa y reforzar auditorias ligeras para sostener el aprendizaje.")

    active = active_case()
    if not active.get("learning"):
        recommendations.append("Documentar el aprendizaje del caso activo para que el analisis deje un activo reutilizable.")
    if not active.get("action_title"):
        recommendations.append("Definir la accion preventiva del caso activo con impacto estimado y lider tecnico asignado.")

    if len(recommendations) < 3:
        recommendations.append("Revisar semanalmente la biblioteca de aprendizajes para detectar patrones repetidos.")

    return {
        "cases_received": cases_received,
        "root_causes_identified": root_causes_identified,
        "knowledge_identified": knowledge_identified,
        "actions_generated": actions_generated,
        "implemented_improvements": implemented_improvements,
        "problems_prevented": problems_prevented,
        "iao": iao,
        "band": band,
        "interpretation": interpretation,
        "narrative": narrative,
        "cause_distribution": cause_distribution,
        "recommendations": recommendations[:4],
    }


def build_workflow(case_data: dict) -> list[dict]:
    steps = [
        {
            "index": 1,
            "label": "Inconformidad",
            "detail": "Recepcion y tipificacion del reclamo.",
            "done": True,
        },
        {
            "index": 2,
            "label": "Registro del Caso",
            "detail": f"Ticket #{case_data['id']} con metadatos y estado inicial.",
            "done": True,
        },
        {
            "index": 3,
            "label": "Analisis de Causa Raiz",
            "detail": "Desglose interactivo de los 5 Porques.",
            "done": bool(case_data.get("root_cause")),
        },
        {
            "index": 4,
            "label": "Aprendizaje",
            "detail": "Hallazgo documentado en la biblioteca.",
            "done": bool(case_data.get("learning")),
        },
        {
            "index": 5,
            "label": "Accion de Mejora",
            "detail": "Propuesta correctiva y preventiva con lider asignado.",
            "done": bool(case_data.get("action_title")),
        },
        {
            "index": 6,
            "label": "Prevencion",
            "detail": "Bloqueo o mitigacion de la reincidencia.",
            "done": bool(case_data.get("prevented")),
        },
        {
            "index": 7,
            "label": "Medicion",
            "detail": "Recálculo del IAO y de los indicadores macro.",
            "done": True,
        },
    ]

    current_step = next((step["index"] for step in steps if not step["done"]), 7)
    for step in steps:
        step["current"] = step["index"] == current_step
    return steps


@app.route("/")
def index():
    return render_template(
        "index.html",
        brand_logo_url=url_for("brand_logo"),
        app_title="CONFORMIA 360",
    )


@app.route("/brand-logo")
def brand_logo():
    return send_from_directory(BASE_DIR, LOGO_FILENAME)


@app.route("/api/cases", methods=["GET", "POST"])
def api_cases():
    if request.method == "GET":
        current = active_case()
        return jsonify(
            {
                "cases": STATE["cases"],
                "active_case_id": STATE["active_case_id"],
                "active_case": current,
                "workflow": build_workflow(current),
            }
        )

    payload = request.get_json(silent=True) or {}
    required_fields = ["user", "category", "subcategory", "channel", "priority", "description"]
    missing_fields = [field for field in required_fields if not str(payload.get(field, "")).strip()]
    if missing_fields:
        return jsonify({"error": f"Faltan campos obligatorios: {', '.join(missing_fields)}"}), 400

    new_case = {
        "id": STATE["next_case_id"],
        "user": str(payload["user"]).strip(),
        "category": str(payload["category"]).strip(),
        "subcategory": str(payload["subcategory"]).strip(),
        "channel": str(payload["channel"]).strip(),
        "priority": str(payload["priority"]).strip(),
        "description": str(payload["description"]).strip(),
        "status": "En Analisis",
        "why_tree": [],
        "root_cause": "",
        "learning": "",
        "action_id": None,
        "action_title": "",
        "action_leader": "",
        "action_due_date": "",
        "expected_impact": 0,
        "milestones": [],
        "implemented": False,
        "prevented": False,
        "prevention": "",
        "cause_bucket": infer_bucket(payload),
        "created_at": iso_now(),
        "updated_at": iso_now(),
    }

    STATE["cases"].insert(0, new_case)
    STATE["active_case_id"] = new_case["id"]
    STATE["next_case_id"] += 1
    return jsonify(
        {
            "message": "Caso registrado correctamente.",
            "case": new_case,
            "active_case_id": new_case["id"],
            "workflow": build_workflow(new_case),
            "metrics": calculate_metrics(),
        }
    ), 201


@app.route("/api/cases/<int:case_id>", methods=["PUT"])
def api_case_update(case_id: int):
    case_data = get_case(case_id)
    if case_data is None:
        return jsonify({"error": "Caso no encontrado."}), 404

    payload = request.get_json(silent=True) or {}
    step = str(payload.get("step", "")).strip().lower()

    # Paso 3 y 4: el analisis convierte los 5 Porques en aprendizaje indexado.
    if step == "analysis":
        whys = payload.get("whys") or []
        case_data["why_tree"] = [
            {
                "level": index + 1,
                "question": f"Por que {index + 1}?",
                "answer": str(why).strip(),
            }
            for index, why in enumerate(whys[:5])
            if str(why).strip()
        ]
        if str(payload.get("root_cause", "")).strip():
            case_data["root_cause"] = str(payload["root_cause"]).strip()
        if str(payload.get("learning", "")).strip():
            case_data["learning"] = str(payload["learning"]).strip()
        if str(payload.get("cause_bucket", "")).strip() in CAUSE_BUCKETS:
            case_data["cause_bucket"] = str(payload["cause_bucket"]).strip()

        if case_data.get("learning"):
            upsert_learning_entry(case_data)

        refresh_case_status(case_data)
        case_data["updated_at"] = iso_now()
        return jsonify(
            {
                "message": "Analisis actualizado.",
                "case": case_data,
                "workflow": build_workflow(case_data),
                "metrics": calculate_metrics(),
            }
        )

    # Paso 6: prevencion y cierre del riesgo recurrente dentro del ecosistema.
    if step == "prevention":
        case_data["prevention"] = str(payload.get("prevention", case_data.get("prevention", ""))).strip()
        case_data["prevented"] = bool(payload.get("prevented", True))
        refresh_case_status(case_data)
        case_data["updated_at"] = iso_now()
        if case_data.get("learning"):
            upsert_learning_entry(case_data)
        return jsonify(
            {
                "message": "Prevencion actualizada.",
                "case": case_data,
                "workflow": build_workflow(case_data),
                "metrics": calculate_metrics(),
            }
        )

    # Fallback seguro: permite actualizar campos directos sin romper el flujo.
    for key in ["root_cause", "learning", "prevention", "cause_bucket"]:
        if key in payload and str(payload.get(key, "")).strip():
            case_data[key] = str(payload[key]).strip()
    refresh_case_status(case_data)
    case_data["updated_at"] = iso_now()
    if case_data.get("learning"):
        upsert_learning_entry(case_data)

    return jsonify(
        {
            "message": "Caso actualizado.",
            "case": case_data,
            "workflow": build_workflow(case_data),
            "metrics": calculate_metrics(),
        }
    )


@app.route("/api/actions", methods=["POST"])
def api_actions():
    payload = request.get_json(silent=True) or {}
    case_id = payload.get("case_id")
    if case_id is None:
        return jsonify({"error": "case_id es obligatorio."}), 400

    case_data = get_case(int(case_id))
    if case_data is None:
        return jsonify({"error": "Caso no encontrado."}), 404

    title = str(payload.get("title", "")).strip()
    leader = str(payload.get("leader", "")).strip()
    due_date = str(payload.get("due_date", "")).strip()
    if not title or not leader or not due_date:
        return jsonify({"error": "Titulo, lider y fecha limite son obligatorios."}), 400

    milestones_raw = payload.get("milestones") or []
    if isinstance(milestones_raw, str):
        milestones = [item.strip() for item in milestones_raw.split(";") if item.strip()]
    else:
        milestones = [str(item).strip() for item in milestones_raw if str(item).strip()]

    expected_impact = float(payload.get("expected_impact") or 0)
    implemented = bool(payload.get("implemented", True))
    prevention_note = str(payload.get("prevention", "")).strip()
    prevent_now = bool(payload.get("prevented", False))

    action = {
        "id": len(STATE["actions"]) + 1,
        "case_id": case_data["id"],
        "title": title,
        "leader": leader,
        "due_date": due_date,
        "expected_impact": expected_impact,
        "milestones": milestones,
        "implemented": implemented,
        "created_at": iso_now(),
    }

    STATE["actions"].insert(0, action)
    case_data["action_id"] = action["id"]
    case_data["action_title"] = title
    case_data["action_leader"] = leader
    case_data["action_due_date"] = due_date
    case_data["expected_impact"] = expected_impact
    case_data["milestones"] = milestones
    case_data["implemented"] = implemented
    if prevent_now:
        case_data["prevented"] = True
        case_data["prevention"] = prevention_note or case_data.get("prevention", "")

    refresh_case_status(case_data)
    case_data["updated_at"] = iso_now()
    if case_data.get("learning"):
        upsert_learning_entry(case_data)

    # Paso 5 y 6: la accion formulada alimenta la medida preventiva y deja lista la medicion.
    return jsonify(
        {
            "message": "Accion de mejora guardada.",
            "action": action,
            "case": case_data,
            "workflow": build_workflow(case_data),
            "metrics": calculate_metrics(),
        }
    ), 201


@app.route("/api/metrics", methods=["GET"])
def api_metrics():
    metrics = calculate_metrics()
    return jsonify(
        {
            "metrics": metrics,
            "active_case_id": STATE["active_case_id"],
            "active_case": active_case(),
            "cause_distribution": metrics["cause_distribution"],
            "learning_library": STATE["learning_library"],
            "knowledge_identified": metrics["knowledge_identified"],
            "recommendations": metrics["recommendations"],
        }
    )


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(debug=True)