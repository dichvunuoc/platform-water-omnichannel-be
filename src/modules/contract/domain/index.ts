/**
 * Contract Domain — Barrel Export
 *
 * BFF does NOT own contract business data (Rule #1 from project-context.md).
 * Contract data (terms, pricing, versions, PDFs) lives in the Backend API.
 * This module is a thin pass-through: Controller → CQRS → Handler → PortRegistry → Adapter → Downstream.
 *
 * No domain entities, value objects, or repositories needed.
 */
