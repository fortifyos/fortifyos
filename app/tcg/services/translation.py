from __future__ import annotations

from app.tcg.schemas import NormalizedEvent


JP_TRANSLATIONS = {
    "ゲンガー マスターボールミラー 151": ("Master Ball Gengar supply appears to be thinning", 0.91),
    "切手box ピカチュウ": ("Stamp Box Pikachu remains firm in Japan", 0.9),
    "ナミ prb alt": ("PRB Nami Alt is rising in creator attention", 0.86),
}


def attach_translation(event: NormalizedEvent) -> NormalizedEvent:
    if event.language != "jp":
        return event
    if not event.text:
        return event
    translated, confidence = JP_TRANSLATIONS.get(event.text, (event.text, 0.62))
    event.translated_text = translated
    event.metrics["translation_confidence"] = confidence
    return event

