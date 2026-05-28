# CICS Insurance — AI-Powered Insurance Assistant 🛡️🤝

CICS Insurance is an intelligent insurance management platform developed as part of academic and practical work at UTM. It combines a Django-based backend with a modern Next.js frontend to deliver policy management, claims handling, analytics, and an AI assistant for customer interactions.

🚀 Project Overview
-------------------
Insurance workflows are often fragmented across portals, CRMs, and manual processes. CICS Insurance provides a unified interface that streamlines policy lifecycle management, claims intake, and customer support using automation and AI-driven assistance.

The Problem
-----------
- Fragmented tools: Agents and customers switch between multiple systems to manage policies and claims.
- Slow claims processing: Manual steps increase turnaround time and introduce errors.
- Poor customer experience: Limited self-service and inconsistent responses from support.

The Solution
------------
An integrated web platform with automated APIs, an AI assistant for chat-based support, and analytics to help insurers reduce processing time and improve customer satisfaction.

✨ Key Features
---------------
- Policy Management: CRUD operations and version history for customer policies.
- Claims Intake: Structured forms, file uploads, and automated triage.
- AI Assistant: Chat API and assistant module for answering policy questions and guiding users.
- Analytics & Dashboards: Visual components for claim trends, policy distribution, and risk metrics.
- Secure Backend: Django REST APIs with migrations and data loaders for reproducible datasets.

🎨 Design Thinking Process
-------------------------
1. Empathize
	 - User Focus: Customers, agents, and underwriters who need fast, reliable information.
	 - Key Finding: Users want clarity, speed, and self-service options.
2. Define
	 - The Need: Reduce manual claims steps and provide consistent policy answers.
	 - The Goal: Improve response time and accuracy while enabling scalable self-service.

🛠️ Proposed Tech Stack
----------------------
- Frontend: Next.js (React, TypeScript)
- Backend: Django + Django REST Framework (Python)
- AI / Assistant: Custom assistant module and chat API endpoints (extendable to external LLMs)
- Database: PostgreSQL (recommended) / SQLite for local dev
- Dev tooling: pnpm/npm for frontend, pip/virtualenv for backend

YouTube demo
------------
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

