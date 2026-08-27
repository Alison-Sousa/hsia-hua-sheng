#!/usr/bin/env python3
"""Dados e regras da seção Livro do dashboard."""
from __future__ import annotations

import csv
from pathlib import Path
from typing import Any

BOOK_TITLE = "A Nova Economia Global: China, Mercado e Futuro do Sistema Financeiro"
MOTHER_QUESTION = (
    "Como a transformação da economia real chinesa, a evolução de seu sistema financeiro e a crescente "
    "integração com países como o Brasil estão criando as bases de uma arquitetura financeira internacional "
    "mais multipolar, eficiente e menos dependente de um único centro financeiro e de uma única moeda?"
)

CHAPTERS = [
    {"id": 1, "part": 1, "part_label": "Parte I", "title": "Multilateralismo, USD e transformação global", "question": "Como as mudanças no multilateralismo e no ambiente internacional favorecem um mercado financeiro mais multipolar e maior uso do RMB?"},
    {"id": 2, "part": 1, "part_label": "Parte I", "title": "Moedas digitais, stablecoins e tecnologia financeira", "question": "Como a digitalização das moedas e dos pagamentos cria espaço para uma nova infraestrutura financeira em RMB?"},
    {"id": 3, "part": 1, "part_label": "Parte I", "title": "Commodities físicas e transformação da economia real", "question": "Como a mudança do centro da demanda mundial de commodities em direção à China cria condições para maior utilização do RMB?"},
    {"id": 4, "part": 2, "part_label": "Parte II", "title": "Novo motor de crescimento chinês", "question": "Como a transição de imóveis/investimento tradicional para tecnologia e inovação obrigou o sistema financeiro chinês a mudar?"},
    {"id": 5, "part": 2, "part_label": "Parte II", "title": "Reforma bancária e mercado de capitais", "question": "Como bancos e mercados financeiros se adaptaram ao novo perfil de risco da economia chinesa?"},
    {"id": 6, "part": 3, "part_label": "Parte III", "title": "Mercado financeiro conectado à economia real", "question": "O sistema financeiro chinês constitui um modelo diferente do sistema mais financeirizado das economias ocidentais?"},
    {"id": 7, "part": 3, "part_label": "Parte III", "title": "Eficiência e integração financeira", "question": "As particularidades chinesas são ineficiências temporárias ou características de um modelo alternativo de integração financeira?"},
    {"id": 8, "part": 4, "part_label": "Parte IV", "title": "Câmbio / RMB", "question": "Como um regime cambial parcialmente controlado pode gerar estabilidade e, simultaneamente, permitir a internacionalização do RMB?"},
    {"id": 9, "part": 4, "part_label": "Parte IV", "title": "Juros e renda fixa", "question": "A influência estatal sobre juros reduz a eficiência ou cria outra forma de alocação de capital?"},
    {"id": 10, "part": 4, "part_label": "Parte IV", "title": "Ações", "question": "O mercado acionário chinês é ineficiente ou possui uma lógica diferente de formação de preços?"},
    {"id": 11, "part": 4, "part_label": "Parte IV", "title": "Commodities e metais", "question": "A China ainda é price taker ou está se tornando price maker?"},
    {"id": 12, "part": 4, "part_label": "Parte IV", "title": "Índices e ETFs", "question": "ETFs e índices representam integração financeira ou abertura controlada?"},
    {"id": 13, "part": 5, "part_label": "Parte V", "title": "Bonds e Panda Bonds", "question": "A China pode se tornar uma fonte relevante de financiamento internacional para empresas e governos estrangeiros?"},
    {"id": 14, "part": 5, "part_label": "Parte V", "title": "IPO e equity funding", "question": "Empresas estrangeiras poderão utilizar o mercado acionário chinês como fonte de capital?"},
    {"id": 15, "part": 5, "part_label": "Parte V", "title": "Hedge e gestão de riscos", "question": "Como administrar os riscos quando comércio, investimento e funding passam a ocorrer em RMB?"},
    {"id": 16, "part": 6, "part_label": "Parte VI", "title": "Brasil como laboratório China–Sul Global", "question": "A integração financeira Brasil–China pode servir como modelo para outros países emergentes?"},
    {"id": 17, "part": 6, "part_label": "Parte VI", "title": "Desafios e limites", "question": "O que ainda impede o mercado financeiro chinês de assumir papel internacional maior?"},
]

PARTS = [
    {"id": 1, "label": "Parte I", "chapters": [1, 2, 3]},
    {"id": 2, "label": "Parte II", "chapters": [4, 5]},
    {"id": 3, "label": "Parte III", "chapters": [6, 7]},
    {"id": 4, "label": "Parte IV", "chapters": [8, 9, 10, 11, 12]},
    {"id": 5, "label": "Parte V", "chapters": [13, 14, 15]},
    {"id": 6, "label": "Parte VI", "chapters": [16, 17]},
]


def read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return [{key: (value or "").strip() for key, value in row.items()} for row in csv.DictReader(handle)]


def as_int(value: Any, default: int = 0) -> int:
    try:
        return int(float(str(value).replace(",", ".")))
    except (TypeError, ValueError):
        return default


def as_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(str(value).replace(",", "."))
    except (TypeError, ValueError):
        return default


def build_book_payload(items_path: Path, nlp_path: Path, updates_path: Path) -> dict[str, Any]:
    item_rows = read_csv(items_path)
    items: dict[str, dict[str, Any]] = {}
    for row in item_rows:
        item_id = row.get("item_id", "")
        if not item_id or item_id in items:
            continue
        items[item_id] = {
            "item_id": item_id,
            "title": row.get("titulo", ""),
            "year": row.get("ano", "") or row.get("data_publicacao", "")[:4],
            "publication_date": row.get("data_publicacao", ""),
            "publication_type": row.get("tipo_publicacao", "") or row.get("categoria_painel", ""),
            "source": row.get("fonte", ""),
            "url": row.get("url_original", "") or row.get("url_principal", ""),
        }

    relations: list[dict[str, Any]] = []
    for row in read_csv(nlp_path):
        item_id = row.get("item_id", "")
        chapter = as_int(row.get("capitulo"))
        if item_id not in items or not 1 <= chapter <= 17:
            continue
        nlp_classification = row.get("classificacao", "").lower()
        if nlp_classification not in {"exclusivo", "compartilhado"}:
            nlp_classification = "compartilhado"
        relations.append({
            "relation_id": f"nlp:{chapter}:{item_id}",
            "item_id": item_id,
            "chapter": chapter,
            "classification": nlp_classification,
            "active": True,
            "observation": "",
            "source": "nlp",
            "nlp_chapter": chapter,
            "nlp_classification": nlp_classification,
            "adherence": as_float(row.get("aderencia_semantica_pct")),
            "ranking": as_int(row.get("ranking_no_capitulo")),
            "justification": row.get("justificativa_relevancia", "") or row.get("justificativa_curta", ""),
            "contribution": row.get("contribuicao_para_pergunta", ""),
        })

    updates: list[dict[str, Any]] = []
    for order, row in enumerate(read_csv(updates_path), 1):
        item_id = row.get("item_id", "")
        chapter = as_int(row.get("capitulo"))
        if item_id not in items or not 1 <= chapter <= 17:
            continue
        updates.append({
            "update_id": f"dado:{chapter}:{item_id}:{order}",
            "item_id": item_id,
            "chapter": chapter,
            "original_value": row.get("dado_original", ""),
            "data_year": row.get("ano_dado", ""),
            "context": row.get("trecho_contexto", ""),
            "indicator_type": row.get("tipo_indicador", ""),
            "can_update": row.get("pode_atualizar", ""),
            "priority": row.get("prioridade", ""),
            "reason": row.get("motivo_atualizacao", ""),
            "source": row.get("fonte_original", ""),
            "url": row.get("url_original", ""),
        })

    return {
        "book": {"title": BOOK_TITLE, "mother_question": MOTHER_QUESTION},
        "parts": PARTS,
        "chapters": CHAPTERS,
        "items": items,
        "relations": relations,
        "updates": updates,
        "meta": {
            "total_chapters": len(CHAPTERS),
            "total_relations": len(relations),
            "total_items": len({relation["item_id"] for relation in relations}),
            "total_updatable_data": len(updates),
        },
    }


def book_with_revision_items(book: dict[str, Any], revisions: dict[str, Any]) -> dict[str, Any]:
    """Inclui no catálogo do livro as publicações ativas criadas pela revisão aberta."""
    merged = dict(book)
    items = {key: dict(value) for key, value in book.get("items", {}).items()}
    removed = {
        str(entry.get("manifestacao_id", "") if isinstance(entry, dict) else entry)
        for entry in revisions.get("removed", [])
    }
    for raw in revisions.get("added", []):
        if not isinstance(raw, dict) or str(raw.get("manifestacao_id", "")) in removed:
            continue
        item_id = str(raw.get("item_id", "") or raw.get("manifestacao_id", "")).strip()
        if not item_id:
            continue
        current = items.get(item_id, {})
        publication_date = str(raw.get("data_publicacao", "") or current.get("publication_date", ""))
        items[item_id] = {
            **current,
            "item_id": item_id,
            "title": raw.get("titulo", "") or current.get("title", ""),
            "year": raw.get("ano", "") or publication_date[:4] or current.get("year", ""),
            "publication_date": publication_date,
            "publication_type": raw.get("tipo_publicacao", "") or raw.get("categoria_painel", "") or current.get("publication_type", ""),
            "source": raw.get("fonte", "") or current.get("source", ""),
            "url": raw.get("url_original", "") or raw.get("url_principal", "") or current.get("url", ""),
        }
    merged["items"] = items
    return merged


def resolve_book_relations(book: dict[str, Any], revisions: dict[str, Any]) -> list[dict[str, Any]]:
    relations = [dict(relation) for relation in book.get("relations", [])]
    by_id = {relation["relation_id"]: relation for relation in relations}
    for raw in revisions.get("book_relations", []):
        if not isinstance(raw, dict):
            continue
        relation_id = str(raw.get("relation_id", "")).strip()
        item_id = str(raw.get("item_id", "")).strip()
        if not relation_id or item_id not in book.get("items", {}):
            continue
        if relation_id in by_id:
            target = by_id[relation_id]
            for field in ("chapter", "classification", "justification", "contribution", "observation", "active", "source", "nlp_chapter", "nlp_classification", "reviewer", "edited_at"):
                if field in raw:
                    target[field] = raw[field]
        else:
            chapter = as_int(raw.get("chapter"))
            if not 1 <= chapter <= 17:
                continue
            target = {
                "relation_id": relation_id,
                "item_id": item_id,
                "chapter": chapter,
                "classification": raw.get("classification", "exclusivo"),
                "active": raw.get("active", True) is not False,
                "observation": raw.get("observation", ""),
                "source": raw.get("source", "manual"),
                "nlp_chapter": raw.get("nlp_chapter", ""),
                "nlp_classification": raw.get("nlp_classification", ""),
                "adherence": 0.0,
                "ranking": 0,
                "justification": raw.get("justification", ""),
                "contribution": raw.get("contribution", ""),
                "reviewer": raw.get("reviewer", ""),
                "edited_at": raw.get("edited_at", ""),
            }
            relations.append(target)
            by_id[relation_id] = target
    return relations


def book_export_rows(book: dict[str, Any], revisions: dict[str, Any]) -> list[dict[str, Any]]:
    book = book_with_revision_items(book, revisions)
    chapters = {chapter["id"]: chapter for chapter in book.get("chapters", [])}
    items = book.get("items", {})
    update_counts: dict[tuple[str, int], int] = {}
    for update in book.get("updates", []):
        key = (update.get("item_id", ""), as_int(update.get("chapter")))
        update_counts[key] = update_counts.get(key, 0) + 1
    rows = []
    for relation in resolve_book_relations(book, revisions):
        chapter_id = as_int(relation.get("chapter"))
        chapter = chapters.get(chapter_id, {})
        item = items.get(relation.get("item_id", ""), {})
        count = update_counts.get((relation.get("item_id", ""), chapter_id), 0)
        rows.append({
            "capitulo": chapter_id,
            "parte": chapter.get("part_label", ""),
            "pergunta": chapter.get("question", ""),
            "item_id": relation.get("item_id", ""),
            "titulo": item.get("title", ""),
            "classificacao_atual": relation.get("classification", ""),
            "capitulo_nlp_original": relation.get("nlp_chapter", ""),
            "classificacao_nlp_original": relation.get("nlp_classification", ""),
            "aderencia_nlp": relation.get("adherence", ""),
            "justificativa": relation.get("justification", ""),
            "contribuicao_para_pergunta": relation.get("contribution", ""),
            "fonte": item.get("source", ""),
            "url": item.get("url", ""),
            "observacao_editorial": relation.get("observation", ""),
            "dado_atualizavel": f"sim ({count})" if count else "nao",
            "status": "ativo" if relation.get("active", True) is not False else "arquivado",
        })
    return sorted(rows, key=lambda row: (as_int(row["capitulo"]), row["status"] != "ativo", -as_float(row["aderencia_nlp"]), str(row["titulo"]).casefold()))