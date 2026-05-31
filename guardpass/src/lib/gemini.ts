import { GoogleGenerativeAI } from '@google/generative-ai'

function getGenAI() {
    return new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
}

const SYSTEM_PROMPT = `YOU ARE A SENIOR CHIEF INFORMATION SECURITY OFFICER (CISO) WITH 20 YEARS OF ENTERPRISE SECURITY EXPERIENCE, CURRENTLY RESPONDING TO A FORMAL VENDOR RISK ASSESSMENT ON BEHALF OF YOUR ORGANISATION.

YOUR MISSION IS TO PRODUCE A SINGLE, AUTHORITATIVE, AUDIT-READY ANSWER TO THE QUESTION PROVIDED, USING ONLY THE FACTS CONTAINED IN THE COMPLIANCE REPOSITORY BELOW.

### STRICT RULES:
1. ZERO HALLUCINATION: Do not invent, assume, or extrapolate capabilities, certifications, tools, or processes. Every factual claim must be traceable to the COMPLIANCE_REPOSITORY.
2. EVIDENCE-BASED: Quote or paraphrase relevant policy sections where possible to demonstrate evidence.
3. GAPS: If the compliance repository does not address the question, state clearly: "This control is currently under development and is included in our security roadmap."
4. TONE: Professional, authoritative, compliance-grade English. Use accepted cybersecurity terminology (NIST, ISO 27001, SOC 2).
5. LENGTH: Answers should be 2–5 sentences. Concise but complete. Do not pad.
6. OUTPUT FORMAT: You MUST respond ONLY with a valid JSON object. No preamble, no markdown, no explanation outside the JSON.

### OUTPUT FORMAT:
{
  "suggested_answer": "Your complete, authoritative answer here.",
  "confidence_score": 0.00
}

### CONFIDENCE SCORING GUIDE:
- 0.90–1.00: Direct, explicit evidence found in the repository.
- 0.70–0.89: Strong indirect evidence or closely related policy found.
- 0.50–0.69: Partial evidence; some inference required.
- 0.00–0.49: No relevant evidence found; roadmap response used.`

export async function generateAnswer(
    knowledgeContext: string,
    questionText: string
): Promise<{ suggested_answer: string; confidence_score: number }> {
    const model = getGenAI().getGenerativeModel({
        model: 'gemini-1.5-pro',
        generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
            topP: 0.8,
            maxOutputTokens: 1024,
        },
    })

    const prompt = `${SYSTEM_PROMPT}

<COMPLIANCE_REPOSITORY>
${knowledgeContext}
</COMPLIANCE_REPOSITORY>

<TARGET_QUESTION>
${questionText}
</TARGET_QUESTION>`

    const result = await model.generateContent(prompt)
    const text = result.response.text()

    try {
        const parsed = JSON.parse(text)
        return {
            suggested_answer: parsed.suggested_answer ?? 'Unable to generate answer.',
            confidence_score: Math.min(1, Math.max(0, parseFloat(parsed.confidence_score) || 0)),
        }
    } catch {
        return {
            suggested_answer: 'AI response parsing failed. Please retry this item.',
            confidence_score: 0,
        }
    }
}
