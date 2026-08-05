from django.urls import path
from . import views

urlpatterns = [
    # # path('chat/', views.chat),  # Changed from ask-gemini to chat
    # path('analyze-doc/', views.analyze_doc),  # Changed from analyze-doc to analyze-doc

    # # Gemini
    # path('gemini-chat/', views.gemini_chat),
    
    # DeepSeek
    # path('deepseek-chat/', deepseek_chat),
    
    # OpenAI
    path('openai-chat/', views.openai_assistant_chat),
    path('openai-file/', views.analyze_with_assistant),
    path('analyze-policies/', views.analyze_policies),
    path('personal-details', views.personal_details),
    
    path('duplicate-policies/', views.check_duplicated_policies),
    path('emergency-rag-chat/', views.emergency_rag_chat),

    # Family Vault RBAC (Supabase-authenticated)
    path('family-vault/subprofiles/', views.family_subprofiles),
    path('family-vault/policies/', views.family_policies),
    path('family-vault/shares/', views.family_policy_shares),
]