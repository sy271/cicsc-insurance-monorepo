# PolicySense — AI-Assisted Family Insurance Manager 🏠🔍

PolicySense is an AI-assisted insurance management platform focused on post-purchase family policy management (not policy selling). It centralizes family policies, extracts structured details from long insurance PDFs, detects overlap/gaps in coverage, and provides emergency, policy-grounded chatbot guidance for claims preparation. The product is designed for multi-generational households where younger family members help manage parents’ insurance safely.

The Problem
-----------
- App & Document Fatigue: Families struggle to keep track of various insurance policies scattered across different folders or provider portals.
- Hidden Coverage Gaps & Overlaps: Long, jargon-heavy PDFs make it difficult to identify when families are paying for duplicate coverage or lacking necessary protection.
- Emergency Confusion: During an emergency, family members often lack immediate, clear guidance on what is covered and how to prepare a claim quickly.

Core value
----------
- Centralize family policies in one place for multi-member households.
- Extract key details from long insurance PDFs automatically (coverage, limits, exclusions, dates).
- Detect overlap and gaps in coverage to reduce wasted premiums.
- Provide emergency, policy-grounded chatbot guidance to prepare claims effectively.

Tech Stack Used
---------------
- Frontend: Next.js (React, TypeScript), Tailwind UI components
- Backend: Django + Django REST Framework
- Database/Auth: Supabase PostgreSQL, Supabase Auth, JWT verification
- AI Extraction: Google Gemini (`gemini-1.5-flash`) for structured policy extraction
- PDF Processing: PyMuPDF
- RAG Embeddings: Hugging Face `all-MiniLM-L6-v2`
- Vector Store: Supabase `pgvector`
- RAG Response Model: Llama via Hugging Face Inference API
- Logic Engine: Deterministic Python rule-based checks for overlap/gap signals


Design Thinking Process
-------------------------
1. Empathize
	 - User Focus: Multi-generational households, specifically younger family members assisting their parents with managing insurance safely.
	 - Key Finding: Users feel overwhelmed by lengthy insurance documents and lack confidence in knowing exactly what is covered during an emergency.
2. Define
	 - The Need: A centralized vault that automatically extracts crucial policy details and acts as a reliable guide during the stress of preparing a claim.
	 - The Goal: Automate policy analysis to prevent wasted premiums (overlaps) and reduce claims-related anxiety through an intelligent, retrieval-grounded assistant.

YouTube demo
-------------------------
Watch a demo of the project here:

https://youtu.be/14KYDqM__t8

<!-- Quick start (high level)
------------------------
- Backend (quick):

	1. cd insurance-backend-main/backend
	2. python -m venv .venv
	3. .venv\Scripts\activate   (Windows) or source .venv/bin/activate (macOS/Linux)
	4. pip install -r requirements.txt
	5. python manage.py migrate
	6. python manage.py runserver

- Frontend (quick):

	1. cd mega-frontend-main
	2. pnpm install   (or `npm install`)
	3. pnpm dev       (or `npm run dev`)

If you provide the real YouTube demo URL, I will update the README accordingly or expand setup instructions. -->

