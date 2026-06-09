/**
 * Customer Domain — Barrel Export
 *
 * BFF does NOT own customer business data (Rule #1 from project-context.md).
 * Customer profile data lives in the Backend API.
 * This module is a thin pass-through: Controller → CQRS → Handler → PortRegistry → Adapter → Downstream.
 *
 * No domain entities, value objects, or repositories needed.
 */
