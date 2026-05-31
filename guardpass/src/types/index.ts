export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'inactive'
export type QuestionnaireStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type ItemStatus = 'pending' | 'processing' | 'answered' | 'approved' | 'skipped'

export interface Profile {
    id: string
    company_name: string
    stripe_customer_id: string | null
    stripe_subscription_id: string | null
    stripe_subscription_status: SubscriptionStatus
    stripe_price_id: string | null
    current_period_end: string | null
    ai_answers_this_month: number
    created_at: string
    updated_at: string
}

export interface KnowledgeDocument {
    id: string
    profile_id: string
    file_name: string
    file_size: number | null
    file_type: string | null
    storage_path: string
    parsed_text: string | null
    token_count: number | null
    created_at: string
}

export interface Questionnaire {
    id: string
    profile_id: string
    title: string
    original_filename: string | null
    status: QuestionnaireStatus
    total_items: number
    completed_items: number
    created_at: string
    updated_at: string
}

export interface QuestionnaireItem {
    id: string
    questionnaire_id: string
    row_number: number | null
    question_text: string
    suggested_answer: string | null
    user_edited_answer: string | null
    confidence_score: number | null
    status: ItemStatus
    is_approved: boolean
    created_at: string
    updated_at: string
}

export interface GeminiResponse {
    suggested_answer: string
    confidence_score: number
}

export interface TenantConfig {
    profile_id: string
    brand_name: string
    brand_logo_url: string | null
    primary_color: string
    custom_domain: string | null
}
