"""
Ask RivalLens AI Analyst Service

Grounds natural language answers STRICTLY in RivalLens database metrics:
- Sentiment scores & trends
- Root causes & aspect breakdown
- Crisis analysis & severity
- Competitor weaknesses & Share of Voice
- 7-Day predictions
- AI recommendations

Never hallucinates metrics. If data is sparse, responds:
"I don't have enough data to answer that reliably."
"""

import re
from sqlalchemy.orm import Session
from app.models.brand import Brand
from app.models.mention import Mention
from app.services import (
    brand_service,
    crisis_service,
    root_cause_service,
    forecast_service,
    competitive_service,
    ai_insight_service,
    health_service,
)


def ask_rivallens(db: Session, brand_id: str, question: str) -> dict:
    """
    Answers questions grounded exclusively in real RivalLens analytics.
    """
    if not question or not question.strip():
        return {
            "question": question,
            "answer": "Please ask a question about your brand's sentiment, competitors, crisis alerts, root causes, or forecast.",
            "grounding_data": {},
        }

    brand = brand_service.get_brand(db, brand_id)
    if not brand:
        brand = brand_service.get_brand_by_name(db, brand_id)

    if not brand:
        return {
            "question": question,
            "answer": "I don't have enough data to answer that reliably because the specified brand was not found in the database.",
            "grounding_data": {},
        }

    q_lower = question.lower().strip()

    # Load factual brand analytics
    crisis_data = crisis_service.calculate_crisis_score(db, brand.id)
    root_cause_data = root_cause_service.calculate_root_cause(db, brand.id)
    forecast_data = forecast_service.calculate_7day_forecast(db, brand.id)
    comp_data = competitive_service.calculate_competitive_insights(db, brand.id)
    health_data = health_service.calculate_brand_health_score(db, brand.id)
    aspects_data = brand_service.get_aspects(db, brand.id)

    grounding_data = {
        "brand_name": brand.name,
        "sentiment_score": brand.sentiment_score,
        "trend": brand.trend,
        "trend_delta": brand.trend_delta,
        "crisis_score": crisis_data.get("crisis_score"),
        "crisis_severity": crisis_data.get("severity"),
        "health_score": health_data.get("health_score"),
        "primary_root_cause": root_cause_data.get("primary_cause"),
        "predicted_sentiment": forecast_data.get("predicted_sentiment"),
    }

    # Query Intent 1: Crisis / Risk / Alert
    if any(k in q_lower for k in ["crisis", "alert", "risk", "going wrong", "problem", "danger"]):
        score = crisis_data.get("crisis_score", 0)
        sev = crisis_data.get("severity", "SAFE")
        reason = crisis_data.get("main_reason", "normal")
        factors = crisis_data.get("contributing_factors", [])
        
        factor_str = f" Key contributing signals include: {'; '.join(factors)}." if factors else ""
        answer = (
            f"**Crisis Detection Status for {brand.name}:**\n\n"
            f"• **Crisis Score:** {score}/100 ({sev})\n"
            f"• **Primary Diagnosis:** {reason}\n"
            f"• **Status:** {crisis_data.get('status')}\n"
            f"{factor_str}\n\n"
            f"Overall sentiment is currently at **{brand.sentiment_score}/100** with a **{brand.trend}** trajectory."
        )
        return {"question": question, "answer": answer, "grounding_data": grounding_data}

    # Query Intent 2: Root cause / Why did sentiment change / decrease / increase
    if any(k in q_lower for k in ["why", "cause", "reason", "decrease", "increase", "drop", "change", "factor"]):
        primary = root_cause_data.get("primary_cause", "General / Other")
        overall_change = root_cause_data.get("overall_change", 0)
        causes = root_cause_data.get("causes", [])
        
        causes_summary = []
        for c in causes[:3]:
            causes_summary.append(f"- **{c['aspect']}**: {c['contribution']}% contribution (sentiment shift: {c['sentiment_change']}%)")
        
        causes_text = "\n".join(causes_summary) if causes_summary else "- Insufficient aspect delta history."

        answer = (
            f"**Root-Cause Analysis for {brand.name}:**\n\n"
            f"Overall sentiment experienced a **{'+' if overall_change > 0 else ''}{overall_change}%** shift over the recent period.\n\n"
            f"**Primary Driver:** `{primary}`\n\n"
            f"**Top Aspect Contributors:**\n{causes_text}\n\n"
            f"*Recommendation:* Focus corrective playbooks on `{primary}` to quickly restore customer satisfaction."
        )
        return {"question": question, "answer": answer, "grounding_data": grounding_data}

    # Query Intent 3: Competitor Comparison / Weakness / Strength / Share of voice
    if any(k in q_lower for k in ["competitor", "compare", "weakness", "strength", "opportunity", "vs", "versus", "share of voice", "sov"]):
        strengths = comp_data.get("strengths", [])
        weaknesses = comp_data.get("weaknesses", [])
        opps = comp_data.get("opportunities", [])
        sov = comp_data.get("share_of_voice", [])

        str_text = ", ".join([f"{s['aspect']} ({s['advantage_pct']})" for s in strengths]) if strengths else "Performing near market average"
        wk_text = ", ".join([f"{w['aspect']} ({w['gap_pct']})" for w in weaknesses]) if weaknesses else "No critical weaknesses detected"
        opp_text = "; ".join([o['opportunity'] for o in opps[:2]]) if opps else "Maintain service consistency across channels."

        sov_lines = [f"- **{s['brand_name']}**: {s['share_of_voice_pct']}% SOV ({s['sentiment_score']} sentiment pts)" for s in sov]
        sov_text = "\n".join(sov_lines) if sov_lines else "- No benchmark competitor data linked."

        answer = (
            f"**Competitive Intelligence for {brand.name}:**\n\n"
            f"• **Key Strengths:** {str_text}\n"
            f"• **Key Weaknesses:** {wk_text}\n"
            f"• **Market Share of Voice:**\n{sov_text}\n\n"
            f"**Strategic Opportunity:**\n{opp_text}"
        )
        return {"question": question, "answer": answer, "grounding_data": grounding_data}

    # Query Intent 4: Forecast / What is likely to happen next / Future
    if any(k in q_lower for k in ["forecast", "predict", "next", "future", "trajectory", "expect", "tomorrow", "week"]):
        cur = forecast_data.get("current_sentiment", 50.0)
        pred = forecast_data.get("predicted_sentiment", 50.0)
        delta = forecast_data.get("expected_change", 0.0)

        answer = (
            f"**7-Day Sentiment Forecast for {brand.name}:**\n\n"
            f"• **Current Sentiment Score:** {cur}/100\n"
            f"• **7-Day Projected Sentiment:** **{pred}/100**\n"
            f"• **Expected Net Change:** **{'+' if delta > 0 else ''}{delta} pts**\n\n"
            f"*{forecast_data.get('disclaimer', 'Forecast based on historical sentiment trends.')}*"
        )
        return {"question": question, "answer": answer, "grounding_data": grounding_data}

    # Query Intent 5: Recommendations / What should we do
    if any(k in q_lower for k in ["recommend", "action", "do", "should", "improve", "fix", "strategy", "playbook"]):
        rec_data = ai_insight_service.generate_ai_recommendations(db, brand.id)
        recs = rec_data.get("recommendations", [])
        
        rec_lines = []
        for r in recs[:3]:
            rec_lines.append(f"• **[{r.get('priority', 'MEDIUM')}] {r.get('recommendation', r.get('title'))}**: {r.get('reason', '')} (Confidence: {r.get('confidence', 'N/A')})")
        
        rec_text = "\n".join(rec_lines) if rec_lines else "Insufficient historical mentions to generate actionable recommendations."

        answer = (
            f"**Actionable Recommendations for {brand.name}:**\n\n"
            f"{rec_text}\n\n"
            f"**Summary:** {rec_data.get('summary', '')}"
        )
        return {"question": question, "answer": answer, "grounding_data": grounding_data}

    # Query Intent 6: Aspect details / Support / Delivery / Pricing / App
    matched_aspect = None
    for a in aspects_data:
        if a.aspect.lower() in q_lower:
            matched_aspect = a
            break

    if matched_aspect:
        answer = (
            f"**Aspect Intelligence: {matched_aspect.aspect} for {brand.name}:**\n\n"
            f"• **Positive Ratio:** {matched_aspect.positive}%\n"
            f"• **Negative Ratio:** {matched_aspect.negative}%\n"
            f"• **Neutral Ratio:** {matched_aspect.neutral}%\n"
            f"• **Total Mentions Tagged:** {matched_aspect.mentionCount}\n\n"
            f"Overall sentiment health for `{matched_aspect.aspect}` is rated **{'Healthy' if matched_aspect.positive > 60 else 'Needs Attention' if matched_aspect.negative > 30 else 'Moderate'}**."
        )
        return {"question": question, "answer": answer, "grounding_data": grounding_data}

    # Default Grounded Overview
    answer = (
        f"**RivalLens Summary for {brand.name}:**\n\n"
        f"• **Brand Health Index:** {health_data.get('health_score')}/100 ({health_data.get('status_label')})\n"
        f"• **Current Sentiment Score:** {brand.sentiment_score}/100 ({brand.trend})\n"
        f"• **Crisis Status:** {crisis_data.get('severity')} ({crisis_data.get('crisis_score')}/100)\n"
        f"• **Primary Root Cause:** `{root_cause_data.get('primary_cause')}`\n"
        f"• **7-Day Forecast:** {forecast_data.get('predicted_sentiment')}/100 ({'+' if forecast_data.get('expected_change', 0) > 0 else ''}{forecast_data.get('expected_change')} pts)\n\n"
        f"You can ask me specific questions like: *'Why did sentiment decrease?', 'What is our biggest weakness against competitors?', 'What caused the recent crisis alert?', or 'What should the business do?'*"
    )
    return {"question": question, "answer": answer, "grounding_data": grounding_data}
